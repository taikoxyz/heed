# Heed v1 Pivot — AI Agents → Human Attention

## Context

Heed is currently positioned as a generic address-native messaging primitive on Taiko (deployed contract `0x08f32278…5678`, TS `core-lib`, read-only React inbox). It's working code but has no sharp use case.

The pivot: re-target Heed at the **"AI agent → human attention" channel** in an open-marketplace shape — any agent can pay to ping any wallet; the recipient's fee gates spam and prices their attention. The deployed contract already supports this economically; the work is making the agent side first-class (a CLI), giving messages an AI-shaped envelope, and surfacing canonical agent identity via ERC-8004.

Outcome: a single dogfoodable v1 where (a) an agent runs `heed send` from a script and pays a fee to reach a wallet, (b) the human opens the web inbox and sees a recognizable "from Agent X · acme.com" card with body + optional CTA, (c) the human taps reply with a short message, (d) the agent reads the reply via `heed inbox`. Notifications, MCP, mobile, and compose-from-scratch are explicitly v1.x.

## Locked decisions

- **Pivot depth:** positioning + AI-shaped conventions in `core-lib`/`web` + new CLI. **Contract untouched** (immutable, fine as-is).
- **Anchor scenario:** open marketplace (any agent → any human). Recipient fee = attention auction.
- **Sender identity:** self-claimed envelope metadata (`name`, `owner_url`, `logo_cid?`) bound to sender wallet by signature, plus a single free-form `uri?` field. Heed defines the envelope; identity registries (ERC-8004, ENS, DIDs, plain HTTPS) live outside the protocol. Inbox renderers interpret the URI per scheme; unknown schemes render as raw text. Agents that omit `uri` render as bare wallet.
- **Shipping artifact:** CLI only (`heed-cli`). No MCP server in v1.
- **Reply path:** bidirectional. Web gets tap-to-reply (no compose-from-scratch). CLI gets `heed inbox`. Threading via `reply_to` field.
- **Notifications:** out of scope for v1. v1 means "if you open the web app, you see it."
- **Name:** keep `Heed`.

## Envelope schema (v1)

```
{
  v: 1,
  from: { name, owner_url, logo_cid?, uri?, sig },
  title,            // ≤120 chars, plaintext
  body,             // markdown, ≤16KB before attachments
  urgency,          // "low" | "normal" | "high" — UI hint only
  action_url?,      // https only, rendered as primary CTA
  reply_to?,        // 32-byte message id for threading
  sent_at           // unix seconds, sender-claimed
}
```

`sig` is a per-field EIP-712 typed-data signature over the envelope's signed portion. Domain: `{name:"Heed", version:"1", chainId, verifyingContract}` (matches the existing `Heed` key-derivation domain). PrimaryType: `Envelope` with nested `EnvelopeFrom`. Snake_case wire fields map to camelCase EIP-712 names; absent optionals default to `""` / zero `bytes32`. The signature binds the envelope to the sending wallet — that is the only verified property at the protocol layer. Everything else in `from` (name, owner_url, uri) is self-claimed and rendered as such.

`uri` is a single free-form string (≤256 chars) carrying whatever identity the agent wants to claim. Heed does not parse it. Renderers may interpret recognized schemes:

- `erc8004:<chain>:<id>` — on-chain registry lookup; on success, render "verified via 8004" affordance
- `https://...` — best-effort favicon/title metadata fetch
- `did:...`, `ens:...`, anything else — supported per-renderer; unknown schemes render the raw URI

Recommended schemes are documented but not enforced. Renderers free to support any subset.

## Workstreams

### W1 — `core-lib` extensions
- Add envelope codec: `encodeEnvelopeV1`, `decodeEnvelopeV1`, `signEnvelope`, `verifyEnvelope`. New module `core-lib/src/envelope/`.
- Extend write client to wrap the existing `sendBatch` payload path with envelope encoding + signing.
- Extend mail sources (`createRpcMailSource`, `createIndexerMailSource`) with optional envelope decoding so consumers get typed envelopes, not raw bytes.
- **No URI resolution in core-lib.** core-lib hands the raw `uri` string to consumers; resolution lives in renderers. Pluggable resolver registry can come in v1.x if multiple consumers need it.
- Reuse: `deriveX25519Private/Public`, `encryptForRecipients`, `decryptForRecipient`, `createReadClient`, `createWriteClient`, `createRpcMailSource`, `createIndexerMailSource`, `pin`, `fetchCid` — all stay; envelope work layers on top.

Critical files: `core-lib/src/envelope/`, `core-lib/src/clients/write.ts`, `core-lib/src/sources/*`.

### W2 — `heed-cli` (new package)
New top-level package `cli/` published as `heed-cli` (binary: `heed`). Thin wrapper over `core-lib`.

Commands:
- `heed setup` — interactive: generate/import wallet → derive X25519 keypair → publish encryption key on-chain → optionally set the agent's `uri` (free-form).
- `heed send <to> --title --body [--urgency --action-url --reply-to --uri --name --owner-url] [--from-stdin]` — envelope `from` defaults pulled from `heed config` if not passed.
- `heed inbox [--since=<ts>] [--unread] [--json] [--watch]`
- `heed agent {set-uri <uri>|set-name <name>|set-owner-url <url>|show}` — manages the agent's claimed envelope identity (stored locally in config). Heed does not register the agent anywhere; if the operator wants ERC-8004 / ENS / DID registration, they handle that with their own tooling and pass the resulting URI here.
- `heed key {show|rotate}`, `heed fee {get|set}`, `heed config {get|set}`.

Key storage:
- macOS Keychain by default; libsecret on Linux; DPAPI on Windows.
- File-based fallback (`~/.config/heed/keys.json`, 0600) when keychain unavailable, behind `--keystore=file` flag.
- `HEED_PRIVATE_KEY` env var for headless/CI/sandboxed agents (highest priority, no persistence).

Critical files: `cli/package.json`, `cli/src/index.ts`, `cli/src/commands/*.ts`, `cli/src/keystore/*.ts`.

### W3 — `web` extensions
- Sender card: render `from.name`, `from.owner_url`, `from.logo_cid` from the envelope (signature-verified means "the sending wallet authored this card", not "the name is true"). Render `0xAB…CD` for messages without an envelope.
- URI rendering pipeline: pluggable resolver registry keyed by URI scheme. Ships with two resolvers in v1:
  - `erc8004:<chain>:<id>` — calls the registry contract on the named chain; on success, shows a "verified via 8004 — owner `0x…`" affordance.
  - `https://...` — best-effort favicon + page title fetch via a small client-side helper; cached.
  - Unknown schemes render the raw URI text as a small caption under the name.
- Tap-to-reply on each message: button opens a small inline composer (≤500 chars optional body), submits via existing write client with `reply_to` set to the parent message id.
- Thread view: group messages by `reply_to` chain; show inline.
- Landing/copy: rewrite the README hero in the SPA and the static landing copy to position as "the wallet inbox AI agents pay to reach."

Critical files: `web/src/components/MessageCard.tsx`, `web/src/components/Reply.tsx` (new), `web/src/lib/uri/{index.ts,erc8004.ts,https.ts}` (new — pluggable URI resolver), `web/src/pages/Inbox.tsx`, top-level landing copy.

### W4 — Docs + positioning
- Update `docs/heed-design.md` with the AI-agent positioning and the envelope schema.
- New `docs/agents.md` — quickstart for agent operators (CLI install, setup, send, fund wallet, set claimed identity URI). Includes a non-normative section on recommended URI schemes (`erc8004:`, `https:`, `did:`, `ens:`) with examples.
- Update root `README.md` with the new positioning + CLI install snippet.
- Add `docs/plans/2026-04-29-heed-v1-pivot.md` capturing this spec post-exit (already in this plan file; copy on exit).

### W5 — Testing
- Unit (vitest, in each package): envelope encode/decode, signature roundtrip, CLI argument parsing per command, key storage abstraction, web URI resolver registry (`erc8004:` resolver against a mocked registry contract; `https:` resolver against a mocked fetch).
- Contract integration: anvil fork pinned to a Taiko block past `Heed.sol`'s deployment; tests drive `core-lib` write/read paths against the real bytecode. Lives in `core-lib/test/integration/` and `cli/test/integration/`.
- End-to-end demo: `pnpm e2e` script — spins anvil fork, runs `heed setup` against a fresh ephemeral wallet, sends a message to a second wallet, opens a headless browser to the web app pointed at the fork, asserts the message renders with the right sender card, fires a tap-to-reply, asserts the CLI inbox sees it.
- Manual mainnet smoke: documented checklist run before each release tag — send one message between two real wallets, verify in web app.
- No automated mainnet tests.

## Open follow-ups (resolve during W1)

- **Funding UX:** the agent operator funds their wallet manually. `heed setup` should print a clear "send ETH to `0x…` on Taiko to start sending" message with a Taikoscan link. No on-ramp in v1.
- **ERC-8004 details (deferred to W3):** fetch the current spec only when implementing the web app's `erc8004:` URI resolver. Pin field names + registry contract addresses in a `web/src/lib/uri/erc8004.ts` header comment at that point. No protocol-layer dependency, so this can't block W1 or W2.

## Critical files (consolidated)

**Modify:**
- `core-lib/src/clients/write.ts` — envelope encoding pre-encrypt
- `core-lib/src/clients/read.ts` (if exists) / `core-lib/src/sources/*` — envelope decoding post-decrypt
- `core-lib/package.json` — new exports
- `web/src/components/MessageCard.tsx`, `web/src/pages/Inbox.tsx`, landing copy
- `docs/heed-design.md`, `README.md`
- root `package.json` workspaces config (add `cli/`)

**Create:**
- `core-lib/src/envelope/{schema.ts,codec.ts,sign.ts,index.ts}`
- `cli/` (full new package)
- `web/src/components/Reply.tsx`, `web/src/lib/uri/{index.ts,erc8004.ts,https.ts}`
- `docs/agents.md`, `docs/plans/2026-04-29-heed-v1-pivot.md`

**Untouched:** `contracts/Heed.sol`, all deployments, X25519 crypto helpers, IPFS helpers.

## Verification

End-to-end success looks like this script passing on a clean checkout:

1. `pnpm i && pnpm build` — workspaces all build.
2. `pnpm test` — unit tests green across `core-lib`, `cli`, `web`.
3. `pnpm e2e` — anvil fork + CLI + web headless check passes.
4. Manual: in a real terminal, `heed setup` (file keystore, ephemeral wallet on a Taiko testnet fork), `heed send <my-wallet> --title "test" --body "hi"`, open web app → see envelope-rendered card → tap reply → `heed inbox --watch` shows reply.
5. Mainnet smoke (release-only): two wallets, one real send, one real reply, verified in web app and `heed inbox`.

## Out of scope for v1

MCP server, push/native/email notifications, mobile, attachment UX, agent reputation UI, paid-reply / bounty mechanics, indexer schema changes beyond what envelope rendering needs, compose-from-scratch in web.
