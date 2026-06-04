# scripts

Operational scripts for the Heed monorepo.

## `e2e.sh` — local protocol round-trip

```bash
npm install
npm run e2e
```

Validates the full envelope round-trip against the actual `Heed.sol` bytecode by spinning a fresh anvil chain, deploying `Heed.sol` via `forge create`, and running `scripts/e2e/run.ts`.

## `e2e-fork.sh` — Taiko mainnet fork protocol round-trip

```bash
npm install
npm run e2e-fork
```

Validates the full envelope round-trip against the **deployed** `Heed.sol` at `0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A` by forking Taiko mainnet at block `7500288` (just after deployment). Runs `scripts/e2e/run-fork.ts` to:

1. Verify the deployed contract is accessible and `MAX_FEE_GWEI = 10_000_000`.
2. Derive X25519 keypairs for two pre-funded anvil wallets (alice + bob) via the EIP-712 signing flow.
3. Publish both encryption keys on-chain via `Heed.publishKey`; set bob's `feeGwei` to 100.
4. Build, sign, and encrypt an envelope from alice → bob.
5. Pin the encrypted bytes to a local IPFS stub (`scripts/e2e/ipfs-stub.ts`).
6. Submit via `Heed.sendBatch`, paying the recipient's fee.
7. Read bob's inbox via `RpcMailSource`, fetch from the IPFS stub, decrypt, decode, and assert envelope content + signature recovers to alice.

8. Derive X25519 keypairs for two pre-funded anvil wallets (alice + bob) from the EIP-712 typed-data signing flow.
9. Publish both encryption keys on-chain via `Heed.publishKey`; set bob's `feeGwei` to 100.
10. Build, sign, and encrypt an envelope from alice → bob.
11. Pin the encrypted bytes to a local IPFS stub (`scripts/e2e/ipfs-stub.ts`).
12. Submit via `Heed.sendBatch`, paying the recipient's fee.
13. Read bob's inbox via `RpcMailSource`, fetch from the IPFS stub, decrypt, decode, and assert envelope content + signature recovers to alice.

The script exits 0 on success and tears anvil + the IPFS stub down on exit. Anvil log is preserved if `KEEP_LOGS=1` is set.

### Prerequisites (local e2e)

| Tool         | Why                                        |
| ------------ | ------------------------------------------ |
| `anvil`      | Local Ethereum node (Foundry).             |
| `forge`      | `forge create` for the deploy.             |
| `node` ≥ 20  | Runtime for `tsx`.                         |
| `npx`        | Resolves `tsx` from the workspace install. |
| `curl`, `jq` | Wait-for-anvil polling, JSON-RPC parsing.  |

### Prerequisites (fork e2e)

| Tool            | Why                                                      |
| --------------- | -------------------------------------------------------- |
| `anvil`         | Local Ethereum node with fork support (Foundry).         |
| `node` ≥ 20     | Runtime for `tsx`.                                       |
| `npx`           | Resolves `tsx` from the workspace install.               |
| `curl`, `jq`    | Wait-for-anvil polling, JSON-RPC parsing.                |
| Internet access | Anvil needs to reach the Taiko mainnet RPC for the fork. |

The first run requires `npm install` at the repo root to populate `node_modules/`. `tsx` is pulled in as a transitive dev dep — if missing, `npm i -D tsx` at the root.

### Environment overrides

| Var          | Default                         | Purpose                                                             |
| ------------ | ------------------------------- | ------------------------------------------------------------------- |
| `ANVIL_PORT` | `8545`                          | Anvil bind port.                                                    |
| `KEEP_LOGS`  | unset                           | When set, prints the anvil log path on exit instead of deleting it. |
| `TAIKO_RPC`  | `https://rpc.mainnet.taiko.xyz` | (fork only) RPC endpoint for the fork.                              |
| `FORK_BLOCK` | `7500288`                       | (fork only) Block number to fork at.                                |

The drivers use anvil's deterministic pre-funded accounts 0 and 1 (`0xac09…` / `0x5996…`). To test against a different chain or wallets, edit the constants at the top of `scripts/e2e.sh` / `scripts/e2e-fork.sh`.

## What this is _not_

- **Not a Pinata test.** IPFS pinning is stubbed (`scripts/e2e/ipfs-stub.ts`). The protocol-layer code path is identical, but no network I/O hits Pinata. For real IPFS verification, run `docs/release-smoke.md`.
- **The local e2e (`e2e.sh`) is not a Taiko mainnet fork test.** It deploys `Heed.sol` to a fresh anvil chain. The fork variant (`e2e-fork.sh`) tests against the real deployed contract at `0x08f32278…5678`.
- **Not a web e2e.** [`web/e2e/inbox.spec.ts`](../web/e2e/inbox.spec.ts) remains skipped pending wallet-stub injection — see that file's comment for what's still required to enable the Playwright test.

## Layout

```
scripts/
  README.md         — this file
  e2e.sh            — anvil + forge + driver orchestrator (fresh deploy)
  e2e-fork.sh       — anvil fork of Taiko mainnet (deployed contract)
  e2e/
    run.ts          — local protocol round-trip driver
    run-fork.ts     — fork protocol round-trip driver
    ipfs-stub.ts    — in-process HTTP server pretending to be Pinata + IPFS gateway
```
