# Plan: Taiko Mainnet Fork E2E Coverage

**Date:** 2026-04-29
**Status:** Partial.

## Context

The existing e2e test (`scripts/e2e.sh`) deploys a fresh `Heed.sol` to a local anvil chain. While this exercises the bytecode, it does not validate against the **deployed** contract at `0x08f32278B2CFD962444ae9541122eD84cc745678`. A fork-based test that uses the actual deployed contract address against a Taiko mainnet fork closes this gap without requiring real ETH or on-chain transactions.

## Shipped

- **`scripts/e2e-fork.sh`** — orchestrator that starts `anvil --fork-url $TAIKO_RPC --fork-block-number 6091024`, then runs the protocol round-trip driver against the deployed contract address.
- **`scripts/e2e/run-fork.ts`** — driver that:
  1. Verifies `MAX_FEE_GWEI = 10_000_000` on the deployed contract.
  2. Derives X25519 keypairs, publishes keys, sets bob's fee to 100 gwei.
  3. Builds, signs, encrypts an envelope (alice → bob), pins to IPFS stub, sends via `sendBatch`.
  4. Reads bob's inbox via `RpcMailSource`, decrypts, verifies envelope round-trip and signature recovery.
- **`npm run e2e-fork`** — workspace script alias.
- **Updated `scripts/README.md`** — documents prerequisites, env overrides, and relationship to the local e2e.

## Not yet shipped

### 1. Web e2e against the fork

[`web/e2e/inbox.spec.ts`](../web/e2e/inbox.spec.ts) is skipped. To enable it:

1. **wallet-stub injection**: Playwright must inject a `window.ethereum` stub backed by bob's anvil account before the page loads. The wagmi `injected` connector picks this up; the "Injected" button in the UI corresponds to it.
2. **globalSetup harness**: The Playwright `globalSetup` should reuse `scripts/e2e-fork.sh` (or a subset of it) to:
   - Spin anvil fork
   - Publish keys, set fees, send a fixture message from alice → bob
   - Export `{ rpcUrl, contractAddress, deployedAtBlock, gatewayUrl }` via env vars / temp config
3. **Vite env injection**: Extend `web/playwright.config.ts`'s `webServer.env` with the harness values (VITE_HEED_ADDRESS, VITE_TAIKO_RPC, etc.)
4. **Sign typed data programmatically**: The stub provider must auto-sign the EIP-712 typed data so the in-browser X25519 derivation completes and the inbox renders.
5. **Remove `test.skip`** and assert the envelope card content (name, title, body, action URL).

### 2. CLI e2e against the fork

Currently `heed-cli` has no e2e test against the fork. To add:

1. Extend the fork harness to export config values that the CLI can consume.
2. Run `heed setup --import-private-key`, `heed send`, and `heed inbox --json` against the fork.
3. Assert output matches expected envelope content.

### 3. CI integration

Neither `e2e.sh` nor `e2e-fork.sh` run in CI. GitHub Actions would need:

- `foundry-rs/foundry-toolchain` for `anvil` + `forge`
- A Taiko mainnet RPC URL as a secret (for the fork variant)
- The fork test adds ~5s cold-start (anvil sync) + ~10s (protocol round-trip)

## Verification

| Check | Result |
|---|---|
| `npm --workspace @heed/core test` | 67/67 pass |
| `npm --workspace heed-cli test` | 80/80 pass |
| `npm --workspace @heed/web test` | 18/18 pass |
| `npm run e2e` | Pass |
| `npm run e2e-fork` | Requires anvil + Taiko RPC connectivity |
