# Multi-Network Support — Ethereum + Taiko

## Context

Heed currently runs on a single chain (Taiko Mainnet, `167000`). The live contract
`0x08f32278…5678` is a UUPS proxy deployed via **CREATE** (`new ERC1967Proxy(...)` in
`script/Deploy.s.sol`), so its address is a function of the deployer EOA + nonce and
**cannot be reproduced on Ethereum**. The TS stack is already mostly chain-neutral:
`@heed/core` takes a `client` + `contract` address as params; `heed-cli` config holds a
single swappable `network` block; only `web` hardcodes Taiko (`wagmi.ts`, `config.ts`,
`NetworkGuard.tsx`).

Goal: support Ethereum mainnet **and** Taiko with the **same contract address on both
chains**, add a network switcher to the web inbox, and adopt **RainbowKit** for wallet
connection (replacing the raw wagmi connector list).

## Locked decisions

- **Same address strategy: CREATE2, redeploy both chains.** A fixed-salt CREATE2
  deployment via the canonical deterministic-deployment factory
  `0x4e59b44847b379578588920cA78FbF26c0B4956C` (present on Ethereum + Taiko) gives a
  byte-identical address on every chain. This means **redeploying on Taiko too** → a new
  Taiko address, deprecating `0x08f32278…5678` and migrating off it.
- **Inbox model: network switcher.** The user selects an active network; the inbox shows
  that chain only. No cross-chain aggregation in this iteration.
- **Wallet library: RainbowKit** (`@rainbow-me/rainbowkit`), wagmi-native, built-in chain
  switcher. Minimal churn since we're already on wagmi + viem.
- **Networks in scope:** Taiko Mainnet (`167000`) + Ethereum Mainnet (`1`). The registry is
  built to extend to more chains, but only these two are wired/deployed now.

## Key constraints discovered

1. **Identical address requires identical CREATE2 initcode on both chains:**
   - Same impl bytecode → same solc `0.8.27`, optimizer `1_000_000`, `viaIR=true`, **same
     `evmVersion`**, same `MAX_FEE_GWEI = 10_000_000` constructor arg. **Pin `evmVersion =
     shanghai` for both** (the current `layer2` profile) — compiling Ethereum with `cancun`
     would change bytecode → different impl address → different proxy address.
   - Same proxy initcode → `ERC1967Proxy(implAddr, initData)` where
     `initData = initialize(owner)`. ⇒ **the initial owner address must be identical on both
     chains.** The deployer EOA may differ (CREATE2 address doesn't depend on the sender),
     but salt + initcode must match exactly.

2. **Crypto identity is per-chain even with the same address.** The EIP-712 domain in
   `core-lib/src/crypto/key-derivation.ts` and `core-lib/src/envelope/sign.ts` includes
   `chainId`. Consequences:
   - A wallet derives a **different X25519 encryption key per chain** → keys must be
     published separately on each network (`heed setup` per network).
   - Envelope signatures are chain-bound (replay protection across chains).
   - Each network is a **separate inbox** — exactly why "network switcher" fits, and why no
     state is shared across chains.

3. **`deployedAtBlock` differs per chain.** It's not part of the address but is required as
   the log-scan start for `createRpcMailSource`. The registry must carry it per network.

4. **Migration cost (Taiko).** Existing Taiko users have keys published to `0x08f3…5678`.
   After redeploy they must re-`publishKey` on the new address; senders must target the new
   address. Needs a short migration note + comms. Old contract stays on-chain (immutable)
   but is deprecated by clients.

## Network registry (shared shape)

Single source of truth consumed by `cli` and `web` (and docs). Keyed by `chainId`:

```jsonc
// deployments/networks.json
{
  "1":      { "name": "ethereum", "label": "Ethereum",      "contract": "0x…", "deployedAtBlock": 0, "explorer": "https://etherscan.io" },
  "167000": { "name": "taiko",    "label": "Taiko Mainnet",  "contract": "0x…", "deployedAtBlock": 0, "explorer": "https://taikoscan.io" }
}
```

`contract` is identical across entries (the whole point); `deployedAtBlock`, `explorer`,
default RPC differ. RPC URLs stay overridable via env (`VITE_*` / CLI config) and are not
committed.

## Workstreams

### W1 — Contracts: deterministic CREATE2 deployment
- New `script/DeployDeterministic.s.sol`: deploy impl with `new Heed{salt: SALT}(10_000_000)`
  then `new ERC1967Proxy{salt: SALT}(impl, initialize(OWNER))`, both via the default CREATE2
  deployer. Take `OWNER` and `SALT` from env so they're identical across runs.
- Add a forge test asserting the predicted proxy address (via `vm.computeCreate2Address`) is
  stable and independent of `msg.sender`, so a Taiko run and an Ethereum run match.
- Lock the build profile used for deployment to `evmVersion = shanghai` for **both** chains;
  document the exact `forge build` profile + `forge verify` command per chain.
- Confirm `0x4e59b448…4956C` exists on both Ethereum and Taiko before mainnet runs.
- Pick + document the canonical `SALT` and `OWNER`.
- **Verify:** dry-run script on an Ethereum fork and a Taiko fork; assert both predict the
  same proxy address. Address parity test green.

Critical files: `contracts/script/DeployDeterministic.s.sol`, `contracts/foundry.toml`,
`contracts/test/`.

### W2 — Deployments registry
- Replace `deployments/mainnet.json` with `deployments/networks.json` (shape above); keep a
  record file per chain for the verbose deploy receipts (`deployments/taiko.json`,
  `deployments/ethereum.json`).
- Small typed loader so `cli` + `web` read one source instead of hardcoding.
- **Verify:** `cli` and `web` resolve contract/deployedAtBlock for both chainIds from the
  registry.

### W3 — `@heed/core`
- Already chain-param'd; keep changes minimal (CLAUDE.md §2). Add only a `Network`/registry
  type if it removes duplication in `cli` + `web`. **No behavioral change** to codec, crypto,
  clients, or sources.
- **Verify:** existing `test:core` stays green, no API break.

### W4 — `heed-cli`
- Extend config to a `networks` map + an active selection, seeded with `taiko` + `ethereum`
  presets from the registry; add `heed config use-network <taiko|ethereum>` and/or a
  `--network` flag on `send`/`setup`/`inbox`. Each network keeps its own `key_nonce` and
  `deployed_at_block`.
- `setup` documents that keys are per-network (different X25519 key per chain).
- **Verify:** `heed setup`/`send`/`inbox` work against both chains (fork or testnet);
  existing `test:cli` green.

Critical files: `cli/src/config/store.ts`, `cli/src/commands/{config,setup,send,inbox}.ts`,
`cli/src/lib/chain.ts`.

### W5 — Web: network switcher + RainbowKit
- Add `@rainbow-me/rainbowkit`; wrap the app in `RainbowKitProvider`; replace the connector
  list in `WalletGate.tsx` with RainbowKit's `ConnectButton` (keep Heed branding/header).
  RainbowKit requires a WalletConnect `projectId` → `VITE_WC_PROJECT_ID` becomes required.
- `wagmi.ts`: `chains: [taiko, mainnet]`, per-chain `transports` from registry/env.
- `config.ts`: convert the single-chain constants into a per-`chainId` lookup over the
  registry (contract identical, RPC/deployedAtBlock/explorer per chain).
- `NetworkGuard.tsx`: change from "force Taiko" to "warn only on **unsupported** chain"
  (supported = {taiko, mainnet}); chain switching handled by RainbowKit's switcher.
- Thread the active `chainId` through the hooks that build clients/sources
  (`useInbox`, `useMyInbox`, `useOutbox`, `useHeedActions`, `useSendMail`) so they read the
  active network. Inbox shows the active chain only.
- **Verify:** connect via RainbowKit; switch between Taiko and Ethereum; inbox + compose
  read/write the correct contract per chain; `test:web` green.

Critical files: `web/src/lib/wagmi.ts`, `web/src/lib/config.ts`,
`web/src/components/{WalletGate,NetworkGuard}.tsx`, `web/src/hooks/*`, `web/src/App.tsx`.

### W6 — Docs + release
- `DEPLOYED.md`: two rows (Taiko + Ethereum) sharing one address; note the old Taiko address
  is deprecated + the migration step (republish keys).
- `README.md`, `docs/agents.md`: "runs on Taiko **and** Ethereum"; per-network setup note.
- Short migration note for existing Taiko users.
- **Verify:** docs reviewed; links resolve.

## Sequencing

1. W1 + W2 (contracts + registry) — unblocks everything; produces the shared address.
2. W3 (core, minimal) in parallel.
3. W4 (cli) and W5 (web) in parallel on top of the registry.
4. W6 (docs) last, after the address is known.

Mainnet deploys (the actual Taiko + Ethereum CREATE2 transactions, owner key, salt, gas) are
an **operator step** gated on review — the code/scripts land first; pulling the trigger on
mainnet is a separate, explicit go.

## Open questions / risks

- **Owner key parity:** the same owner address must control the contract on both chains
  (multisig vs EOA?). Pick before W1 mainnet run.
- **WalletConnect projectId:** required once RainbowKit lands; needs to be provisioned.
- **Ethereum gas/fee economics:** `MAX_FEE_GWEI` cap (0.01 ETH) is shared across chains;
  confirm it's sensible on L1 where ETH-denominated fees + gas are far higher than on Taiko.
- **Migration comms:** how existing Taiko users learn to republish keys to the new address.
