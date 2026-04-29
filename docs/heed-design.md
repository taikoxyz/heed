# Heed — Design Spec

**Date:** 2026-04-29
**Status:** Live (unaudited) — contract deployed to Taiko mainnet at [`0x08f32278…5678`](https://taikoscan.io/address/0x08f32278B2CFD962444ae9541122eD84cc745678) at block `6091023`.

---

## Context

Email on Web2 is a centralized, opt-in, spam-saturated medium. AI agents increasingly act on behalf of humans (releases, alerts, account changes, routine asks) and have no inbox to deliver into without screen-scraping or onboarding to whatever messaging stack each human happens to use. Heed is a **trustless, address-native channel from AI agents to humans**: any EVM address is a mailbox; the recipient prices their attention via an anti-spam fee paid directly to them in ETH; payloads are encrypted with deterministic, recoverable key material derived from the wallet itself; and clients run locally to avoid trusting any hosted service with private keys.

The deployed v1 ships three artifacts: an immutable `Heed.sol` on Taiko mainnet, a TypeScript protocol library (`@heed/core`), and two reference clients — `heed-cli` for agents and `@heed/web` for the human side. An IPFS-pinned envelope schema carries AI-shaped metadata (sender identity claims, urgency, optional CTA, threading).

---

## Anchor scenario: AI agents → human attention

The v1 product anchor is an **open marketplace** where any AI agent can pay to reach any wallet. This sharpens the protocol along three axes that fall out of existing primitives:

1. **Recipient-priced attention.** The fee mechanism in `Heed.sol` makes attention an auctionable resource. Agents pay; recipients keep the ETH. Spam economics flip: the more wallets a sender targets, the more it costs them.
2. **Address-native delivery.** Agents own wallets; humans own wallets. No new identifier, no opt-in handshake, no platform onboarding.
3. **Self-claimed agent identity.** Agents declare their identity in the envelope (`name`, `owner_url`, optional `uri`); the recipient's inbox renders the claim and binds it to the sending wallet via a signature. Identity registries (ERC-8004, ENS, DIDs, plain HTTPS) live outside the protocol — Heed defines the envelope; renderers interpret URI schemes.

Other use cases (own-agent companion, intra-org notifications, dapp/DAO alerts) are future-compatible but explicitly not v1 targets.

---

## Goals

- Address-native identity: an EVM address *is* a mailbox; no opt-in to receive.
- Recipient-priced attention: anti-spam fee in ETH, paid directly to the recipient.
- AI-shaped envelope: structured metadata agents emit (title, body, urgency, optional CTA, threading, identity claims).
- Self-claimed agent identity, signature-bound to the sending wallet; identity registries are out-of-protocol.
- Optional encryption with deterministic, recoverable key material derived from the wallet.
- Batch sends with a single transaction, per-mail events, atomic-or-best-effort modes.
- Clients are local-first; the protocol does not depend on any hosted service.

## Non-Goals

- MCP server in v1 (CLI is sufficient — works for shell-out agents, cron, CI, and modern AI agent frameworks).
- Push, native, or email notifications.
- Mobile clients.
- On-chain spam filtering beyond fee + whitelist.
- Contract upgradeability or governance.
- Read receipts, delivery confirmations, on-chain threading state.
- Hosted inbox or centralized indexer as a hard dependency.
- Web2 (Gmail/Yahoo) interop — pure protocol, no SMTP bridge.
- Agent reputation UI; paid-reply / bounty mechanics.

---

## Envelope schema (v1)

The on-chain `MailSent` event carries a `contentRef` (32-byte sha256 multihash) pointing at an IPFS payload. The payload is an encrypted lockbox wrapping the envelope JSON.

```
{
  v: 1,
  kind: "agent",
  from: { name, owner_url, logo_cid?, uri?, sig },
  title,            // ≤120 chars, plaintext
  body,             // markdown, ≤16KB before attachments
  urgency,          // "low" | "normal" | "high" — UI hint only
  action_url?,      // https only, rendered as primary CTA
  reply_to?,        // 32-byte content ref of the message being replied to
  sent_at           // unix seconds, sender-claimed
}
```

`sig` is a **per-field EIP-712 typed-data signature** over the envelope's signed portion — EIP-712's own canonicalization is the canonicalization, no app-level canonical JSON. Domain matches the existing key-derivation domain: `{ name: "Heed", version: "1", chainId, verifyingContract }`. PrimaryType is `Envelope` with nested `EnvelopeFrom`. Snake_case wire fields map to camelCase EIP-712 names; absent optionals default to empty string / zero `bytes32`.

The signature binds the envelope to the sending wallet. **That is the only verified property at the protocol layer.** Everything else in `from` (`name`, `owner_url`, `uri`) is self-claimed; renderers display them as such and may decorate them with verification affordances based on the `uri` scheme.

`@heed/core`'s envelope module exposes `encodeEnvelopeV1`, `decodeEnvelopeV1`, `signEnvelope`, `verifyEnvelope`. The codec validates length limits, https-only `action_url`, and hex-only `sig` / `reply_to`. Bytes-level `encodeEncryptedBytes` / `decodeEncryptedBytes` and a `decodePayload` dispatcher (`envelope | mail | unknown`) sit on top. The legacy `PlaintextPayload` and `encodeEncrypted` / `decodeEncrypted` from the pre-pivot release are retained for backward compatibility.

---

## Identity model

The protocol defines the message envelope. Identity registries live outside the protocol.

`from.uri` is a single free-form string (≤256 chars). Heed does not parse it. Inbox renderers interpret recognized schemes per a pluggable resolver registry; unknown schemes render as raw URI text.

Recommended schemes (non-normative):

- `erc8004:<chain>:<id>` — ERC-8004 agent registry. On-chain registry lookup; on success, render a "verified via 8004" affordance.
- `https://...` — best-effort favicon + page title fetch.
- `did:...`, `ens:...`, anything else — supported per-renderer; unknown schemes render the raw URI.

**The web inbox ships with `erc8004:` and `https:` resolvers in v1.** New schemes can be added without changing the resolver shape. **`@heed/core` does not resolve URIs.** It hands the raw string to consumers; resolution lives in renderers.

Heed itself does not register agents on any external registry. Operators bring their own URI from their own tooling and pass it to `heed agent set-uri`.

---

## High-Level Architecture

```
                 +-----------------------+         +----------------+
                 | Taiko mainnet         | <-----> | Reference      |
   web reader -->| Heed.sol              |  logs   | indexer        |
   heed-cli  --->| (immutable)           |         | (Ponder + PG,  |
                 +-----------------------+         |  optional)     |
                                ^                  +----------------+
                                |                      ^
                                +----------------------+
                                |
                 +-----------------------+
                 | IPFS (Pinata / any)   |
                 | encrypted envelope    |
                 +-----------------------+
```

Three artifacts ship; clients consume the same `@heed/core` library — no duplicated crypto or protocol code.

1. **`Heed.sol`** — single contract, immutable, on Taiko mainnet.
2. **`@heed/core`** — TypeScript library: envelope codec, crypto, contract bindings, IPFS, mail sources. The deliverable for any client.
3. **`heed-cli`** — the agent-side CLI (binary `heed`). Thin wrapper over `@heed/core` for shell-out agents, cron, CI, and modern AI agent frameworks.
4. **`@heed/web`** — envelope-aware read-only web inbox. Wallet connect, in-browser key derivation (no persistence), envelope rendering with pluggable URI resolvers.

A reference indexer (Ponder + Postgres) is supported but optional; clients fall back to `eth_getLogs` over RPC.

---

## Smart Contract Design

The contract is **immutable**; all sections in this document describe the deployed bytecode. Address: [`0x08f32278…5678`](https://taikoscan.io/address/0x08f32278B2CFD962444ae9541122eD84cc745678). Deploy block: `6091023`.

> **Note.** The deployed contract additionally exposes `registerDelegate`/`revokeDelegate`/`revokeMyself` and a delegate-aware `effectiveSender` resolution path. These are **not part of the v1 client surface** and are intentionally undocumented here; v1 clients always send as `msg.sender`.

### Constants

```solidity
uint32 public immutable MAX_FEE_GWEI;          // set in constructor; deployed value 10_000_000 (0.01 ETH)
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
event MailSent          (address indexed sender, address indexed recipient, bytes32 contentRef, uint32 valueGwei);
```

### Send semantics

For each `MailIntent` in a batch:

1. `requiredFee` = `trusts[recipient][msg.sender] ? 0 : feeGwei[recipient]`.
2. Validate `valueGwei >= requiredFee`. (No upper cap on `valueGwei` — sender voluntarily pays for priority.)
3. Forward `valueGwei * 1 gwei` from the `msg.value` budget to `recipient` via low-level `call`.
4. Emit `MailSent(msg.sender, recipient, contentRef, valueGwei)`.

Modes:

- **`atomic = true`**: any failure reverts the entire transaction.
- **`atomic = false`** (best-effort): a failed mail (insufficient `valueGwei`, transfer revert) is **skipped silently** and its `valueGwei` is refunded with the rest of any unspent ETH at the end of the call.
- After the loop: the contract refunds any unspent ETH (unsent budget + skipped values + over-payment) to `msg.sender` via a single `call`.

The contract emits *only* `MailSent` events from `sendBatch`; no state variable is written by the send path. The only writers are key/fee/trust management functions.

### Constructor

```solidity
constructor(uint32 maxFeeGwei) {
    MAX_FEE_GWEI = maxFeeGwei;   // deployed with 10_000_000
}
```

---

## Encryption & Key Derivation

### x25519 keypair derivation

EIP-712 typed-data hash:

```
domain  = { name: "Heed", version: "1", chainId: <Taiko mainnet>, verifyingContract: <Heed.sol address> }
types   = { Key: [{ name: "keyNonce", type: "uint32" }] }
message = { keyNonce: <n> }
```

- `signature = wallet.signTypedData(domain, types, message)`  (65-byte secp256k1 signature)
- `seed = sha256(signature)`
- `privateKey_x25519 = clampScalar(seed[0..32])`  (RFC 7748 §5)
- `publicKey = X25519.scalarMultBase(privateKey_x25519)` (32 bytes — fits `bytes32`)
- Publish: `Heed.publishKey(keyNonce, publicKey)`

The domain separator binds the derivation to a specific chain + contract — replay-safe across chains.

Old keys are *not lost* when overwritten on-chain; the user can always re-derive any historical private key by signing the typed data with the historical `keyNonce`. The on-chain 2-slot registry is purely a sender-side convenience cache for picking the newest key.

### Lockbox encryption

For each recipient of a logical mail:

1. Generate a fresh ephemeral x25519 keypair `(ephSk, ephPub)`.
2. `shared = X25519(ephSk, recipientPub)`.
3. `wrapKey = HKDF-SHA256(salt = ephPub || recipientPub, ikm = shared, info = "heed.lockbox.v1")`.
4. `wrappedContentKey = XChaCha20-Poly1305-encrypt(wrapKey, nonce_kx, contentKey)`.
5. Emit one lockbox entry `{ rcpt, keyNonce, wrapped: ephPub || nonce_kx || wrappedContentKey }`.

The `contentKey` is a single 32-byte symmetric key, fresh per logical mail, used to encrypt the envelope payload via XChaCha20-Poly1305 with a single 24-byte nonce.

---

## IPFS Payload Format

The on-chain `contentRef` is a 32-byte sha256 multihash. Off-chain we treat it as `CIDv1, raw codec, sha256-256`. Clients reconstruct the full CID before fetching.

### Encrypted payload (v1)

```json
{
  "v": 1,
  "scheme": 1,
  "nonce": "base64-24",
  "lockboxes": [
    { "rcpt": "0xAlice", "keyNonce": 3, "wrapped": "base64..." }
  ],
  "ct": "base64..."
}
```

`ct` is the XChaCha20-Poly1305 ciphertext of the envelope JSON (schema above, without the outer transport envelope). The receiver locates their `lockboxes[i]` by `rcpt`, regenerates the private key for `keyNonce` from their wallet, unwraps `contentKey`, then decrypts `ct`.

`scheme = 1` denotes x25519 + XChaCha20-Poly1305 + HKDF-SHA256 + CIDv1/raw/sha256 multihash. Higher values are reserved for future schemes.

### Plaintext payload

For ad-hoc traffic where encryption is unnecessary (rare in v1), `scheme` is absent and the payload bytes are the envelope JSON directly.

### Attachments

- Inline (base64 in payload) if total payload < 256 KB.
- Otherwise external: each attachment is its own IPFS object, encrypted independently with a fresh `contentKey` derived from a per-attachment lockbox embedded in the parent payload.

(Attachment UX is post-v1 in the reference clients.)

---

## Send / Receive Flows

### Direct send

1. Client calls `Heed.getInbox(recipient)` → `(feeGwei, keys)`.
2. Client builds the envelope (signing with the sender wallet's EIP-712 typed-data signer), encrypts it via lockbox if `keys[newest].pub != 0` else plaintext.
3. Client pins payload to Pinata (or any IPFS pinning service), gets `contentRef`.
4. The sender wallet signs and broadcasts `sendBatch([{ recipient, valueGwei, contentRef }], atomic = true)` with `msg.value = valueGwei * 1 gwei`.

### Receive

1. The client subscribes to `MailSent` events filtered by `recipient = self`. Default: paginated `eth_getLogs` over a configurable lookback window. Optional: indexer GraphQL.
2. For each event, fetch `contentRef` from the IPFS gateway.
3. If the payload contains `scheme`, locate the lockbox entry where `rcpt = self`, re-derive the x25519 private key for that entry's `keyNonce`, unwrap `contentKey`, and decrypt `ct`. Else, render plaintext directly.
4. **Decode** via `@heed/core`'s `decodePayload` dispatcher: returns `envelope | mail | unknown`. For envelopes, verify the signature and check it matches the on-chain sender (`signerMatchesSender`); render the verification status in the UI.
5. **Priority bucketing (client-side, not protocol):**
   - `valueGwei == requiredFee` → **low**
   - `2 * requiredFee <= valueGwei < 3 * requiredFee` → **medium**
   - `valueGwei >= 3 * requiredFee` → **high**
   - For whitelisted senders (`requiredFee = 0`), all incoming default to **low**.

---

## Reference Clients

### `heed-cli` — agent-side CLI

The v1 shipping artifact for agents. Binary: `heed`. Thin wrapper over `@heed/core`.

**Commands:**

- `heed setup` — generate or import a wallet, derive the X25519 encryption key, optionally publish on-chain via `Heed.publishKey`. Flags: `--import-private-key`, `--rpc-url`, `--no-publish`, `--force`, `--keystore`.
- `heed send <to>` — build envelope → sign → encrypt → pin to IPFS → `sendBatch`, paying the recipient's on-chain fee. Required `--title`; optional `--body` / `--body-from-stdin`, `--urgency`, `--action-url`, `--reply-to`, `--rpc-url`, `--dry-run`. Pinning requires `HEED_PINATA_JWT`.
- `heed inbox` — `listInbox` → fetch CID → decrypt → `decodePayload` → render. Flags: `--since-block`, `--limit`, `--json`, `--watch`, `--rpc-url`, `--gateway`.
- `heed agent {set-name|set-owner-url|set-uri|set-logo-cid|show}` — manage envelope identity claims stored locally in config.
- `heed key show` — print the wallet address derived from the loaded private key.
- `heed config {get|set|path}` — read/write CLI configuration (network, identity, key nonce).

**Key storage:** file-based by default at `$XDG_CONFIG_HOME/heed/wallet.json` (or `~/.config/heed/wallet.json`), mode 0600. Override the config home with `HEED_HOME=<dir>`. `HEED_PRIVATE_KEY` env-var override for headless agents / CI / sandboxed environments — auto-selected when set, no persistence. Selectable per-command via `--keystore auto|file|env`. Native OS keychain integration is intentionally deferred to a follow-up; the file + env-var pattern matches `~/.aws/credentials` and `gh auth`.

### `@heed/web` — envelope-aware web inbox

Goal: zero-install proof-of-protocol. Any wallet sees its Heed inbox in a browser, send messages, and decrypt encrypted mail, without trusting a server with secrets.

**Stack**

- React + Vite, served as static assets. No backend (queries RPC / indexer directly from the browser).
- `@heed/core` for all protocol logic.
- Wallet connect via WalletConnect / injected (Frame, Rabby, MetaMask).
- Encrypted mail: when the user wants to decrypt, the wallet signs the EIP-712 typed data (one signature per `keyNonce`); the derived x25519 private key lives in browser memory only — never persisted, never sent off-machine.

**Tabs**

- **Inbox** — lists mail received by the connected wallet. Each message is decrypted, decoded, and rendered as an `EnvelopeCard` or legacy `MailCard`.
- **Sent** — lists mail sent by the connected wallet (outbox).
- **Compose** — compose and send a new message. Looks up the recipient's fee and published encryption key; encrypts if the recipient has a key, sends as plaintext otherwise. Requires a Pinata JWT configured in Settings.
- **Settings** — configure RPC endpoint, IPFS gateway, indexer URL, Pinata JWT, max anti-spam fee. Persisted to localStorage; overrides Vite env defaults at runtime.

**Envelope rendering**

- `EnvelopeCard` renders sender identity (claimed `name` + `owner_url` hostname link + URI badge), urgency, body, action CTA, fee, reply-to, and live signer-vs-sender verification (`signerMatchesSender`).
- `MailCard` is a dispatcher (`envelope | legacy mail | unknown`).
- Pluggable URI resolver registry under `web/src/lib/uri/`. Built-ins: `erc8004:` and `https:`. Unknown schemes render as raw URI captions.
- Legacy `PlaintextPayload` mail still renders via the same dispatcher for backward compatibility.

**Out-of-scope:** tap-to-reply inline composer, thread view by `reply_to` chain. The inbox currently surfaces `reply_to` in the card header but does not group threads or offer an inline reply button.

### Configuration (per-install, persisted)

- RPC endpoint (default: Taiko mainnet public RPC).
- IPFS gateway URL (default: Pinata gateway).
- Pinata API JWT (user-provided; never embedded in build) — required for sends; reading does not need it.
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

### API surface

- GraphQL with filters by `sender`/`recipient`/`blockTimestamp`.
- WebSocket subscription for live mail.
- Health endpoint exposing the current sync block.

The indexer is purely additive: any client can ignore it and rely on RPC. Multiple independent indexers can coexist.

---

## Deployment

### What shipped

1. **Foundry repo** with `forge` + `viem`. Toolchain locked.
2. **Contract** developed and tested: ≥ 95% line / 100% branch coverage on `Heed.sol`. Property/fuzz tests on batch-send accounting; tests for key rotation, fee cap.
3. **Mainnet deploy** at block `6091023`. Address `0x08f32278…5678`. Verified on Taikoscan and Blockscout. Deployment record: [`deployments/mainnet.json`](../deployments/mainnet.json).
4. **`@heed/core`** TypeScript library (envelope codec, X25519 lockbox, IPFS, mail sources, write client) — 67 tests passing. **Not yet on npm.**
5. **`heed-cli`** package (binary `heed`) — 80 tests passing. **Not yet on npm.**
6. **`@heed/web`** envelope-aware inbox — 18 tests passing.

### Open / post-merge

- **Audit.** Contract is currently unaudited. An external review is required before any wider distribution.
- **npm publish** for `@heed/core` and `heed-cli`.
- **Mainnet smoke** (release-only): documented in [`docs/release-smoke.md`](./release-smoke.md). Two real wallets, one real send, one real reply, recorded against each release tag.
- **Reference indexer** (Ponder) — schema and Docker image not yet shipped; clients work without it via `RpcMailSource`.
- **`heed-web` hosted deployment** — public URL still TBD; will land in `DEPLOYED.md` when live.

### v1 follow-ups (out of this design's scope, on the v1 backlog)

- W3 phase 2: tap-to-reply + thread view in the web inbox.
- W3 phase 3: AI-first landing copy / positioning rewrite for the web SPA.
- npm publish of `heed-cli` + `@heed/core`.

---

## Testing Strategy

The contract is immutable; testing rigor compensates for the absence of a public testnet rehearsal.

- **Foundry test coverage** ≥ 95% line / 100% branch on `Heed.sol`, including:
  - Atomic vs. best-effort branch correctness with mixed success/failure.
  - Refund accounting under all paths.
  - Key slot rotation invariant: slots always hold the two newest published nonces.
  - Fee cap enforcement at `setFee`.
- **Invariant tests** (Foundry): "no state changes from `sendBatch`" assertion.
- **Fork tests** against Taiko mainnet RPC (gas profiling + integration sanity).
- **TypeScript unit tests** across `@heed/core`, `heed-cli`, `@heed/web` — 165 tests at v1.
- **Anvil-fork e2e** (`scripts/e2e.sh`): redeploys `Heed.sol` to an anvil fork of Taiko mainnet; drives `heed-cli` end-to-end (setup → publishKey → send → inbox); enables the Playwright test in `web/e2e/inbox.spec.ts` to load the inbox against the fork and assert envelope card rendering.
- **Manual mainnet smoke** before each release tag — see [`docs/release-smoke.md`](./release-smoke.md). Two real wallets, send + reply, tx hashes recorded.
- **Independent third-party audit** — required before npm publish or wider distribution.
- **Bug bounty** — planned post-audit.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Direct mainnet without testnet exposes users to bugs we can't patch (immutable contract). | Audit pending; Foundry coverage and the anvil-fork e2e are the current line of defense. Bug fixes ship as v2 contract; clients support both. |
| Pinata centralization for default pinning. | Client supports any IPFS pinning service; user supplies own JWT. Doc explicitly recommends self-hosted IPFS for high-value users. |
| Self-claimed envelope identity could mislead recipients. | Inbox UI distinguishes the verified property (signing wallet) from claimed properties (name, owner_url, uri). URI resolvers can decorate with verification affordances when the operator opts into a registry. |
| Recipient address is a contract that reverts on `receive`. | Best-effort batch skips and refunds; atomic batch reverts. Behavior documented. |
| Sender pays unbounded `valueGwei` by mistake. | Client enforces a "max anti-spam fee to send" config; UI confirmation for fees above threshold. |
| Fee griefing: recipient sets max fee right before someone sends. | Sender always reads fee just-in-time; the tx still succeeds if `valueGwei >= fee`. Client may warn if fee changed since compose. |
| Dropped IPFS content (no pinning enforcement). | Doc emphasizes sender's responsibility; client has rehost/re-pin tooling planned. |

---

## Out of Scope (this spec)

- MCP server.
- Push, native, or email notifications.
- Mobile clients (iOS / Android).
- Agent reputation UI; paid-reply / bounty mechanics.
- Hosted inbox or any centralized dependency.
- Read receipts, delivery confirmations.
- On-chain spam filtering beyond fee + whitelist.
- Contract upgradeability or governance.
- Web2 (SMTP) interop.
- Mailing-list / multicast / group-chat primitives.
- Forward-secrecy ratchet.

## Open Questions / Future Work

- Federation / discovery layer for multiple reference indexers.
- ENS / DID resolution affordances in the web inbox URI registry.
- Optional second scheme: post-quantum hybrid lockbox (X25519 + ML-KEM-768).
- MCP server as an alternative to the CLI for tighter agent-framework integration.

---

## Verification

End-to-end checks at the v1 milestone:

1. Foundry tests pass: `forge test -vvv` with the coverage thresholds above.
2. Static analysis: `slither .` clean (or documented exceptions).
3. Workspace tests green: `npm --workspace @heed/core test && npm --workspace heed-cli test && npm --workspace @heed/web test` — 165/165.
4. Workspace builds + typechecks green across all three packages.
5. **Anvil-fork e2e:** `npm run e2e` — fork starts, `Heed.sol` redeploys, CLI sends a message, web inbox renders the envelope card with verified signer, asserts pass, fork cleaned up.
6. Mainnet smoke (release-only): two wallets, one real send, one real reply, verified in the web app and `heed inbox`. Tx hashes recorded in [`DEPLOYED.md`](../DEPLOYED.md) under the "Release smokes" table.
7. Audit findings addressed; all High/Critical issues resolved before npm publish.
