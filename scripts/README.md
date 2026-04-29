# scripts

Operational scripts for the Heed monorepo.

## `e2e.sh` — local protocol round-trip

```bash
npm install
npm run e2e
```

Validates the full envelope round-trip against the actual `Heed.sol` bytecode by spinning a fresh anvil chain, deploying `Heed.sol` via `forge create`, and running `scripts/e2e/run.ts` to:

1. Derive X25519 keypairs for two pre-funded anvil wallets (alice + bob) from the EIP-712 typed-data signing flow.
2. Publish both encryption keys on-chain via `Heed.publishKey`; set bob's `feeGwei` to 100.
3. Build, sign, and encrypt an envelope from alice → bob.
4. Pin the encrypted bytes to a local IPFS stub (`scripts/e2e/ipfs-stub.ts`).
5. Submit via `Heed.sendBatch`, paying the recipient's fee.
6. Read bob's inbox via `RpcMailSource`, fetch from the IPFS stub, decrypt, decode, and assert envelope content + signature recovers to alice.

The script exits 0 on success and tears anvil + the IPFS stub down on exit. Anvil log is preserved if `KEEP_LOGS=1` is set.

### Prerequisites

| Tool | Why |
|---|---|
| `anvil` | Local Ethereum node (Foundry). |
| `forge` | `forge create` for the deploy. |
| `node` ≥ 20 | Runtime for `tsx`. |
| `npx` | Resolves `tsx` from the workspace install. |
| `curl`, `jq` | Wait-for-anvil polling, JSON-RPC parsing. |

The first run requires `npm install` at the repo root to populate `node_modules/`. `tsx` is pulled in as a transitive dev dep — if missing, `npm i -D tsx` at the root.

### Environment overrides

| Var | Default | Purpose |
|---|---|---|
| `ANVIL_PORT` | `8545` | Anvil bind port. |
| `KEEP_LOGS` | unset | When set, prints the anvil log path on exit instead of deleting it. |

The driver uses anvil's deterministic pre-funded accounts 0 and 1 (`0xac09…` / `0x5996…`). To test against a different chain or wallets, edit the constants at the top of `scripts/e2e.sh`.

## What this is *not*

- **Not a Pinata test.** IPFS pinning is stubbed (`scripts/e2e/ipfs-stub.ts`). The protocol-layer code path is identical, but no network I/O hits Pinata. For real IPFS verification, run `docs/release-smoke.md`.
- **Not a Taiko mainnet fork test.** The script deploys `Heed.sol` to a fresh anvil chain. The real mainnet contract at [`0x08f32278…5678`](https://taikoscan.io/address/0x08f32278B2CFD962444ae9541122eD84cc745678) is exercised manually via [`docs/release-smoke.md`](../docs/release-smoke.md).
- **Not a web e2e.** [`web/e2e/inbox.spec.ts`](../web/e2e/inbox.spec.ts) remains skipped pending wallet-stub injection — see that file's comment for what's still required to enable the Playwright test against the harness this script provides.

## Layout

```
scripts/
  README.md         — this file
  e2e.sh            — anvil + forge + driver orchestrator
  e2e/
    run.ts          — protocol round-trip driver
    ipfs-stub.ts    — in-process HTTP server pretending to be Pinata + IPFS gateway
```
