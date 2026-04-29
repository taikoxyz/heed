# Plan: Strip Delegation From Heed v1 Client Surface

**Date:** 2026-04-29
**Status:** Executed.

## Context

Heed's deployed contract (`0x08f32278B2CFD962444ae9541122eD84cc745678` on Taiko mainnet, immutable) supports a delegate-key flow: clients can register a funded EOA via `registerDelegate(delegate, clientId, v, r, s)` so user-facing apps avoid a wallet popup per `sendBatch`. The contract resolves `effectiveSender = delegateOwner[msg.sender] ?? msg.sender` on the send path.

The 2026-04-29 pivot reframed v1 as **AI agents → human attention**. AI agents *are* the wallet — there is no human user to insulate from per-send signing — so delegation is vestigial. Keeping it in `core-lib`/docs implies a human-client roadmap that is explicitly out of scope (locked v1 = agents-only, no compose UX in web).

**Decision:** Strip delegation from `core-lib`, docs, and any client-side narrative. The immutable contract surface stays live forever (we cannot and do not change it), but the v1 client packages stop wrapping it and the design doc stops describing it.

**Out of scope:**
- Editing `contracts/impl/Heed.sol`, `contracts/iface/IHeed.sol`, `contracts/test/Heed.t.sol`, `contracts/.gas-snapshot` — these document the immutable on-chain truth.
- Editing `docs/plans/2026-04-28-*.md` — superseded historical plans.
- Adding any compatibility shim or "deprecated, do not use" wrapper. Just delete.

## Files Modified

### `core-lib/src/contract/abi.ts` — removed 9 ABI fragments

Deleted: `delegateClient`, `delegateOwner`, `registerDelegate`, `revokeDelegate`, `revokeMyself` functions; `DelegateRegistered`, `DelegateRevoked` events; `InvalidDelegateSignature`, `NotADelegate` errors.

### `core-lib/src/contract/client.ts` — removed 4 wrapper methods

Deleted from `createReadClient`: `delegateOwner(delegate)`. Deleted from `createWriteClient`: `registerDelegate`, `revokeDelegate`, `revokeMyself`.

### `core-lib/test/contract/client.test.ts` — removed delegate assertions

Removed delegate function/method names from the ABI presence check, the typed-reader assertions, and the typed-writer assertions. Test count unchanged (assertions inside existing tests, not separate cases).

### `docs/heed-design.md` — surgical excision

- Context (L10): "delegate keys" → "private keys" (no longer a delegation-specific concern).
- Goals: dropped "One-click client setup via funded delegate addresses…".
- Smart Contract Design: added one-line **Note** that the deployed contract still exposes delegate primitives but they are not part of the v1 client surface.
- Storage block: dropped `delegateOwner` and `delegateClient` mappings.
- External functions: dropped the entire `// Delegates` subsection.
- Events: dropped `DelegateRegistered`, `DelegateRevoked`.
- Send semantics: collapsed `effectiveSender` references to `msg.sender` and renumbered the steps (now 4 steps, was 5).
- "Send / Receive Flows": dropped the entire "Delegate send" subsection.
- Reference Indexer entities: dropped the `delegates(...)` row.
- Deployment "What shipped": dropped "delegate dual-revocation" from the test list.
- Testing Strategy: dropped "Delegate dual-revocation." bullet.
- Risks & Mitigations: dropped the "Delegate key compromise" row.
- Open Questions / Future Work: dropped "WebAuthn / passkey-bound delegate key unlock.".
- "key/fee/trust/delegate management functions" → "key/fee/trust management functions".

### `contracts/README.md` — annotated, did not remove

Added a single one-line annotation directly under the delegate function rows in the Surface table:

> *`registerDelegate` / `revokeDelegate` / `revokeMyself` and the corresponding `DelegateRegistered` / `DelegateRevoked` events are **not used by v1 clients** (`@heed/core`, `heed-cli`, `web`). They remain on-chain for future clients.*

Function list and events list themselves were left intact since they describe the immutable bytecode.

## Files Explicitly Untouched

- `contracts/impl/Heed.sol`, `contracts/iface/IHeed.sol`, `contracts/test/Heed.t.sol`, `contracts/.gas-snapshot` — immutable contract source + tests.
- `docs/plans/2026-04-28-{contract,core-lib,indexer,web}.md` — superseded.
- `docs/plans/2026-04-29-heed-v1-pivot.md` — locked v1 plan (had no delegation references).
- `docs/agents.md`, `docs/release-smoke.md`, `README.md` — no delegation references.
- `web/README.md` — already lists delegate-key registration as "Out of scope (v1a)" at L98.
- `cli/**/*` — no delegate command exists.

## Verification Outcomes

| Check | Result |
|---|---|
| `npm --workspace @heed/core run build` | Pass — clean ESM + DTS build, no type errors. |
| `npm --workspace @heed/core test` | 67/67 pass (test count unchanged; assertions reduced inside 3 existing cases). |
| `npm --workspace heed-cli run build && test` | Build clean. 80/80 tests pass. |
| `npm --workspace web run build && test` | Build clean. 18/18 tests pass. |
| `npm run e2e` | Pass — anvil + forge deploy + protocol round-trip with envelope sig recovery. |
| `git grep -nIi delegat -- '*.ts' '*.tsx' '*.md' ':!docs/plans/2026-04-28-*' ':!contracts/'` | Returns only the two intentional residuals: the one-line Note in `docs/heed-design.md:130` and the existing "Out of scope (v1a)" line in `web/README.md:98`. |

165/165 workspace tests + e2e green; no consumer code referenced the removed methods.

## Rationale Recap

Delegation served the prior "primitive serving two wedges (agents + dapps)" framing — it was the affordance that let a human-facing client avoid a wallet popup per send. With v1 anchored on agents-only, there is no human user to insulate, so the abstraction was dead weight. Stripping it sharpens the design doc, narrows the client API surface that future maintainers (and integrators) need to reason about, and removes a foot-gun (delegate key compromise) that had its own row in the threat model. The contract still exposes the primitives for any future human-client implementer to pick up; nothing has been foreclosed at the protocol layer.
