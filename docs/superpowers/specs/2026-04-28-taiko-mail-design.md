# Taiko Mail — Design Spec

**Date:** 2026-04-28
**Status:** Draft for review

---

## Context

Email on Web2 is a centralized, opt-in, spam-saturated medium. EtherMail and similar projects have shown there is appetite for wallet-native messaging, but their actual on-wire protocols aren't openly specified. Taiko Mail aims to be a *trustless, address-native messaging primitive* on Taiko: any EVM address can receive mail without opt-in, recipients price their attention via an anti-spam fee, encryption is optional but supported by default when a recipient has published a key, and clients run locally to avoid trusting any hosted service with delegate keys.

The intended outcome of this spec is a single, immutable smart contract deployed on Taiko mainnet, an IPFS payload schema for mail content, a native macOS reference client, and a reference indexer.

---

## Goals

- Address-native identity: an EVM address *is* a mailbox; no opt-in to receive.
- Recipient-priced attention: anti-spam fee in ETH, paid directly to the recipient.
- Optional encryption with deterministic, recoverable key material derived from the wallet itself.
- Batch sends with a single transaction, per-mail events, atomic-or-best-effort modes.
- One-click client setup via funded delegate addresses, scoped per client install.
- Clients are local-first; the protocol does not depend on any hosted service.

## Non-Goals

- Mobile clients (out of scope for v1).
- On-chain spam filtering beyond fee + whitelist.
- Contract upgradeability or governance.
- Read receipts, delivery confirmations, on-chain threading state.
- Hosted inbox or centralized indexer as a hard dependency.
- Hoodi testnet rollout (deploying directly to mainnet; rigor moves into testing/audit).

---

## High-Level Architecture

```
+------------------+         +-----------------------+         +----------------+
|  TaikoMail.app   | <-----> | Taiko mainnet         | <-----> | Reference      |
|  (Tauri 2 +      |  RPC    | TaikoMail.sol         |  logs   | indexer        |
|  SwiftUI shell + |         | (immutable)           |         | (Ponder + PG)  |
|  TS core)        |         +-----------------------+         +----------------+
|                  |                                                ^
|                  |         +-----------------------+              |
|                  | <-----> | IPFS (Pinata / any)   | <------------+
+------------------+ HTTP    | mail payload          |  optional gateway
                             +-----------------------+
```

Four artifacts:

1. **`TaikoMail.sol`** — single contract, immutable, on Taiko mainnet.
2. **`taikomail-core`** — TypeScript library (crypto, encoding, contract bindings, IPFS, sync).
3. **`TaikoMail.app`** — native macOS app (Tauri 2 + SwiftUI), depends on `taikomail-core`.
4. **Reference indexer** — Ponder service, optional; clients fall back to RPC.

---

## Smart Contract Design

### Constants

```solidity
uint32 public immutable MAX_FEE_GWEI;          // set in constructor; recommend 10_000_000 (0.01 ETH)
```

### Storage

```solidity
struct EncKey {
    uint32  keyNonce;       // strictly monotonic per address
    uint64  publishedAt;    // block.timestamp
    bytes32 pub;            // x25519 pubkey
}

mapping(address => EncKey[2])                       internal _keys;          // 2 newest
mapping(address => uint32)                          public   feeGwei;        // 0 = no fee
mapping(address => mapping(address => bool))        public   trusts;         // recipient => sender => trusted
mapping(address => address)                         public   delegateOwner;  // delegate => owner (0x0 if none)
mapping(address => bytes32)                         public   delegateClient; // delegate => clientId
```

### External functions

```solidity
// Encryption keys
function publishKey(uint32 keyNonce, bytes32 pub) external;
function getKeys(address owner) external view returns (EncKey[2] memory);

// Anti-spam fee
function setFee(uint32 valueGwei) external;        // requires valueGwei <= MAX_FEE_GWEI

// Whitelist
function trust(address[] calldata senders) external;
function untrust(address[] calldata senders) external;

// Delegates
function registerDelegate(address delegate, bytes32 clientId) external payable;  // forwards msg.value to delegate
function revokeDelegate(address delegate) external;        // sender-side revocation
function revokeMyself() external;                          // delegate-side revocation

// Sending
struct MailIntent {
    address recipient;
    uint32  valueGwei;
    bytes32 contentRef;     // IPFS multihash digest (CIDv1, raw codec, sha256)
}
function sendBatch(MailIntent[] calldata mails, bool atomic) external payable;

// View helpers
struct InboxView {
    uint32     feeGwei;
    EncKey[2]  keys;
}
function getInbox(address addr) external view returns (InboxView memory);
function getInboxes(address[] calldata addrs) external view returns (InboxView[] memory);
```

### Events

```solidity
event KeyPublished      (address indexed owner, uint32 keyNonce, bytes32 pub);
event FeeUpdated        (address indexed recipient, uint32 valueGwei);
event Trusted           (address indexed recipient, address indexed sender, bool trusted);
event DelegateRegistered(address indexed owner, address indexed delegate, bytes32 clientId);
event DelegateRevoked   (address indexed owner, address indexed delegate);
event MailSent          (address indexed sender, address indexed recipient, bytes32 contentRef, uint32 valueGwei);
```

### Send semantics

For each `MailIntent` in a batch:

1. `effectiveSender` = `delegateOwner[msg.sender]` if non-zero, else `msg.sender`.
2. `requiredFee` = `trusts[recipient][effectiveSender] ? 0 : feeGwei[recipient]`.
3. Validate `valueGwei >= requiredFee`. (No upper cap on `valueGwei` — sender voluntarily pays for priority.)
4. Forward `valueGwei * 1 gwei` from the `msg.value` budget to `recipient` via low-level `call`.
5. Emit `MailSent(effectiveSender, recipient, contentRef, valueGwei)`.

Modes:

- **`atomic = true`**: any failure reverts the entire transaction.
- **`atomic = false`** (best-effort): a failed mail (insufficient `valueGwei`, transfer revert) is **skipped silently** and its `valueGwei` is refunded with the rest of any unspent ETH at the end of the call.
- After the loop: the contract refunds any unspent ETH (unsent budget + skipped values + over-payment) to `msg.sender` via a single `call`.

The contract emits *only* `MailSent` events from `sendBatch`; no state variable is written by the send path. The only writers are key/fee/trust/delegate management functions.

### Constructor

```solidity
constructor(uint32 maxFeeGwei) {
    MAX_FEE_GWEI = maxFeeGwei;   // recommend 10_000_000
}
```

---

## Encryption & Key Derivation

### x25519 keypair derivation

EIP-712 typed-data hash:

```
domain  = { name: "TaikoMail", version: "1", chainId: <Taiko mainnet>, verifyingContract: <TaikoMail.sol address> }
types   = { Key: [{ name: "keyNonce", type: "uint32" }] }
message = { keyNonce: <n> }
```

- `signature = wallet.signTypedData(domain, types, message)`  (65-byte secp256k1 signature)
- `seed = sha256(signature)`
- `privateKey_x25519 = clampScalar(seed[0..32])`  (RFC 7748 §5)
- `publicKey = X25519.scalarMultBase(privateKey_x25519)` (32 bytes — fits `bytes32`)
- Publish: `TaikoMail.publishKey(keyNonce, publicKey)`

The domain separator binds the derivation to a specific chain + contract — replay-safe across chains.

Old keys are *not lost* when overwritten on-chain; the user can always re-derive any historical private key by signing the typed data with the historical `keyNonce`. The on-chain 2-slot registry is purely a sender-side convenience cache for picking the newest key.

### Lockbox encryption

For each recipient of a logical mail:

1. Generate a fresh ephemeral x25519 keypair `(ephSk, ephPub)`.
2. `shared = X25519(ephSk, recipientPub)`.
3. `wrapKey = HKDF-SHA256(salt = ephPub || recipientPub, ikm = shared, info = "taikomail.lockbox.v1")`.
4. `wrappedContentKey = XChaCha20-Poly1305-encrypt(wrapKey, nonce_kx, contentKey)`.
5. Emit one lockbox entry `{ rcpt, keyNonce, wrapped: ephPub || nonce_kx || wrappedContentKey }`.

The `contentKey` is a single 32-byte symmetric key, fresh per logical mail, used to encrypt the JSON payload via XChaCha20-Poly1305 with a single 24-byte nonce.

---

## IPFS Payload Format

The on-chain `contentRef` is a 32-byte sha256 multihash. Off-chain we treat it as `CIDv1, raw codec, sha256-256`. Clients reconstruct the full CID before fetching.

### Plaintext payload (`scheme` absent → plaintext)

```json
{
  "v": 1,
  "kind": "mail",
  "from": "0xSender",
  "to":   ["0xAlice", "0xBob"],
  "cc":   [],
  "date": 1735689600,
  "msgId": "uuid-or-hash",
  "inReplyTo": "<parent-msgId>",
  "references": ["<root>", "<parent>"],
  "subject": "string",
  "body": { "text": "...", "html": "..." },
  "attachments": [
    { "name": "foo.pdf", "cid": "bafy...", "size": 12345, "mime": "application/pdf" }
  ]
}
```

### Encrypted payload (`scheme` present → encrypted lockbox)

```json
{
  "v": 1,
  "scheme": 1,
  "nonce": "base64-24",
  "lockboxes": [
    { "rcpt": "0xAlice", "keyNonce": 3, "wrapped": "base64..." },
    { "rcpt": "0xBob",   "keyNonce": 1, "wrapped": "base64..." }
  ],
  "ct": "base64..."
}
```

`ct` is the XChaCha20-Poly1305 ciphertext of the plaintext payload (the schema above, without the outer envelope). The receiver locates their `lockboxes[i]` by `rcpt`, regenerates the private key for `keyNonce` from their wallet, unwraps `contentKey`, then decrypts `ct`.

`scheme = 1` denotes x25519 + XChaCha20-Poly1305 + HKDF-SHA256 + CIDv1/raw/sha256 multihash. Higher values are reserved for future schemes.

### Attachments

- Inline (base64 in payload) if total payload < 256 KB.
- Otherwise external: each attachment is its own IPFS object, encrypted independently with a fresh `contentKey` derived from a per-attachment lockbox embedded in the parent payload.

---

## Send / Receive Flows

### Direct send

1. Client calls `TaikoMail.getInbox(recipient)` → `(feeGwei, keys)`.
2. Client builds the payload, encrypts via lockbox if `keys[newest].pub != 0`, else plaintext.
3. Client pins payload to Pinata, gets `contentRef`.
4. The user's wallet signs and broadcasts `sendBatch([{ recipient, valueGwei, contentRef }], atomic = true)` with `msg.value = valueGwei * 1 gwei`.

### Delegate send (one-click client setup, then frictionless sends)

1. **Setup (once per install):** the client generates a fresh secp256k1 keypair (the delegate). The user's wallet calls `registerDelegate(delegate, clientId)` payable, with funding (e.g., 0.01 ETH). Funds are forwarded to the delegate address in-tx.
2. **Send:** the client signs `sendBatch(...)` directly with the delegate key (no wallet popup). The contract resolves `effectiveSender = delegateOwner[msg.sender]`. Fees are paid out of the delegate's ETH balance.
3. **Top-up:** the user can transfer ETH directly to the delegate address whenever needed — the delegate is just an EOA, no contract function required.
4. **Revocation:** either the owner (`revokeDelegate`) or the delegate itself (`revokeMyself`) can clear the binding. After revocation, the delegate EOA remains a normal address — it can still call `sendBatch`, but as its own `effectiveSender = msg.sender`, no longer on behalf of the prior owner.

### Receive

1. The client subscribes to `MailSent` events filtered by `recipient = self`. Default: paginated `eth_getLogs` over a configurable lookback window. Optional: indexer GraphQL.
2. For each event, fetch `contentRef` from the IPFS gateway.
3. If the payload contains `scheme`, locate the lockbox entry where `rcpt = self`, re-derive the x25519 private key for that entry's `keyNonce`, unwrap `contentKey`, and decrypt `ct`. Else, render plaintext directly.
4. **Priority bucketing (client-side, not protocol):**
   - `valueGwei == requiredFee` → **low**
   - `2 * requiredFee <= valueGwei < 3 * requiredFee` → **medium**
   - `valueGwei >= 3 * requiredFee` → **high**
   - For whitelisted senders (`requiredFee = 0`), all incoming default to **low**.

---

## Reference Client (TaikoMail.app)

### Stack

- **Tauri 2** wrapper, native macOS bundle.
- **SwiftUI** views for the main surfaces (inbox, compose, settings, key/delegate management).
- **`taikomail-core`** (TypeScript): all crypto, contract bindings (`viem`), IPFS client, payload encoders, MailSource interface.
- **macOS Keychain** (via the Tauri Keychain plugin) for the delegate private key — encrypted at rest, accessed via Touch ID / system password gate.

### Configuration (per-install, persisted)

- RPC endpoint (default: Taiko mainnet public RPC).
- IPFS gateway URL (default: Pinata gateway).
- Pinata API JWT (user-provided; never embedded in build).
- Max anti-spam fee willing to send (default: `MAX_FEE_GWEI`).
- Indexer endpoint (optional).

### MailSource interface

```ts
interface MailSource {
  listInbox(address: Address, since?: bigint, limit?: number): Promise<Mail[]>;
  listOutbox(address: Address, since?: bigint, limit?: number): Promise<Mail[]>;
  getInbox(address: Address): Promise<InboxView>;
  subscribe(address: Address, on: (mail: Mail) => void): Unsubscribe;
}
```

Two implementations ship:

- **`RpcMailSource`** (default): paginated `eth_getLogs`. No external dependency.
- **`IndexerMailSource`** (opt-in): GraphQL/HTTP to a Ponder indexer.

---

## Reference Indexer

### Stack

- **Ponder** (TypeScript) framework, Postgres backing store, GraphQL API.
- Self-hostable as a single Docker image. A reference hosted instance is *optional*; clients always work without it.

### Indexed entities

- `mails(id, sender, recipient, contentRef, valueGwei, blockNumber, blockTimestamp, txHash)`
- `keys(address, keyNonce, pub, publishedAt)` — full history.
- `feeUpdates(address, valueGwei, blockTimestamp)` — full history.
- `trusts(recipient, sender, trusted, blockTimestamp)` — full history.
- `delegates(delegate, owner, clientId, registeredAt, revokedAt)`

### API surface

- GraphQL with filters by `sender`/`recipient`/`blockTimestamp`.
- WebSocket subscription for live mail.
- Health endpoint exposing the current sync block.

The indexer is purely additive: any client can ignore it and rely on RPC. Multiple independent indexers can coexist.

---

## Deployment Plan

1. **Foundry setup.** Repo skeleton with `forge` + `viem`. Lock toolchain versions.
2. **Contract development & test.**
   - Unit tests for every function and revert path.
   - Property/fuzz tests for batch send accounting (`sum(values) == msg.value - refund`, etc.).
   - Tests for delegate dual-revocation, key rotation slot logic, fee cap enforcement.
3. **Independent audit.** Required before mainnet deploy — skipping testnet means no public shakedown.
4. **Mainnet deploy.** Single deployment; record the address in `deployments/mainnet.json`. Verify on Taikoscan.
5. **`taikomail-core` library publish** to npm.
6. **`TaikoMail.app` first release** via GitHub Releases + Sparkle update channel.
7. **Reference indexer** ships as a Docker image; the reference hosted instance is optional.

---

## Testing Strategy

Going straight to mainnet means we lose the public testnet rehearsal. Compensating measures:

- **Foundry test coverage** ≥ 95% line / 100% branch on `TaikoMail.sol`, including:
  - Atomic vs. best-effort branch correctness with mixed success/failure.
  - Refund accounting under all paths.
  - Delegate dual-revocation.
  - Key slot rotation invariant: slots always hold the two newest published nonces.
  - Fee cap enforcement at `setFee`.
- **Invariant tests** (Foundry): "no state changes from `sendBatch`" assertion.
- **Fork tests** against the Taiko mainnet RPC (gas profiling + integration sanity).
- **End-to-end client test:** scripted `TaikoMail.app` build sends/receives encrypted mail through a local Anvil chain.
- **Independent third-party audit** before mainnet deploy.
- **Bug bounty** (Immunefi or similar) for the first six months post-launch.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Direct mainnet without testnet exposes users to bugs we can't patch (immutable contract). | Audit + bug bounty + extensive Foundry testing. Bug fixes ship as v2 contract; client supports both. |
| Pinata centralization for default pinning. | Client supports any IPFS pinning service; user supplies own JWT. Doc explicitly recommends self-hosted IPFS for high-value users. |
| Delegate key compromise on a user's macOS install. | Stored in Keychain, system-gated. Funding is small (≈0.01 ETH default). Both owner and delegate can revoke. A compromised delegate cannot withdraw owner funds — only spend its own pre-funded balance on mail sends. |
| Recipient address is a contract that reverts on `receive`. | Best-effort batch skips and refunds; atomic batch reverts. Behavior documented. |
| Sender pays unbounded `valueGwei` by mistake. | Client enforces a "max anti-spam fee to send" config; UI confirmation for fees above threshold. |
| Fee griefing: recipient sets max fee right before someone sends. | Sender always reads fee just-in-time; the tx still succeeds if `valueGwei >= fee`. Client may warn if fee changed since compose. |
| Dropped IPFS content (no pinning enforcement). | Doc emphasizes sender's responsibility; client has "rehost / re-pin" tooling. |

---

## Out of Scope (this spec)

- Mobile client (iOS / Android).
- Read receipts, delivery confirmations.
- On-chain spam filtering beyond fee + whitelist.
- Contract upgradeability or governance.
- Hoodi testnet phase.
- Mailing-list / multicast / group-chat primitives.
- Forward-secrecy ratchet.

## Open Questions / Future Work

- WebAuthn / passkey-bound delegate key unlock (replaces passphrase, follow-up).
- Federation / discovery layer for multiple reference indexers.
- ENS-name resolution for the `to:` field in the compose UI.
- Optional second scheme: post-quantum hybrid lockbox (X25519 + ML-KEM-768).

---

## Verification

End-to-end checks at completion of implementation:

1. Foundry tests pass: `forge test -vvv` with coverage at the thresholds above.
2. Static analysis: `slither .` clean (or documented exceptions).
3. Mainnet fork test: send a mail, decrypt via lockbox, confirm event emitted with correct fields.
4. `taikomail-core` Vitest suite green for crypto round-trips, payload encode/decode, lockbox unwrap with rotated keys.
5. `TaikoMail.app` smoke flow on Anvil: register delegate → send encrypted batch → receive on a second wallet → decrypt → reply with priority `medium` (2× fee).
6. Audit report addressed; all High/Critical findings fixed before deploy.

---

## Critical files (to be created — greenfield)

- `contracts/TaikoMail.sol`
- `contracts/test/TaikoMail.t.sol`
- `contracts/script/Deploy.s.sol`
- `core/src/{crypto,payload,contract,ipfs,source}/*` — TypeScript core
- `core/test/*` — Vitest
- `app/{src-tauri,src,swift}/*` — Tauri shell + SwiftUI views
- `indexer/{ponder.config.ts,schema.graphql,src/*}`
- `deployments/mainnet.json`
