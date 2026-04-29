# Heed Contracts

`Heed.sol` is the on-chain core of the [Heed](../docs/heed-design.md) protocol — a single immutable contract on Taiko that lets any EVM address receive recipient-priced, address-native mail.

## Mainnet deployment

| | |
|-|-|
| **Address** | [`0x08f32278B2CFD962444ae9541122eD84cc745678`](https://taikoscan.io/address/0x08f32278B2CFD962444ae9541122eD84cc745678) |
| **Network** | Taiko Mainnet (chain `167000`) |
| **Block** | `6091023` |
| **Deploy tx** | [`0x2e9d3f6971e1e84704a7e52b3c9ed5031dc271ee39c774f0a8a6aef946e4927c`](https://taikoscan.io/tx/0x2e9d3f6971e1e84704a7e52b3c9ed5031dc271ee39c774f0a8a6aef946e4927c) |
| **Deployer** | `0x327fa3369B1D1D42120d84bc407e5865ECa7c458` |
| **Constructor** | `MAX_FEE_GWEI = 10_000_000` (0.01 ETH cap on per-mail fees) |
| **Compiler** | solc `0.8.27`, EVM version `shanghai`, optimizer `1_000_000` runs, `via_ir = true` |
| **Source verification** | [Taikoscan](https://taikoscan.io/address/0x08f32278B2CFD962444ae9541122eD84cc745678#code) · [Blockscout](https://blockscout.mainnet.taiko.xyz/address/0x08f32278B2CFD962444ae9541122eD84cc745678) |

Machine-readable record: [`deployments/mainnet.json`](../deployments/mainnet.json).

## Audit status

**No third-party audit has been performed.** The deployment was made knowingly; the contract is immutable (no proxy, no governance, no upgrade path), so any bugs are permanent. Use accordingly. The plan's audit gate ([`docs/plans/2026-04-28-contract.md`, Task 12 Step 3](../docs/plans/2026-04-28-contract.md)) was explicitly skipped by the owner.

## Surface

Full ABI in [`out/Heed.sol/Heed.json`](./out) after `forge build`. Interface spec in [`iface/IHeed.sol`](./iface/IHeed.sol). Core operations:

| Function | Purpose |
|----------|---------|
| `publishKey(keyNonce, pub)` | Publish/rotate an x25519 pubkey for receiving encrypted mail. Two newest slots retained, monotonic `keyNonce`. |
| `setFee(valueGwei)` | Set the per-mail anti-spam fee. Capped at `MAX_FEE_GWEI`. |
| `trust(senders)` / `untrust(senders)` | Whitelist senders that can mail you fee-free. |
| `registerDelegate(delegate, clientId, v, r, s)` | Owner registers a per-client delegate (EIP-712 sig); attaches optional ETH to fund the delegate's gas. |
| `revokeDelegate(delegate)` / `revokeMyself()` | Owner-side or delegate-side revocation. |
| `sendBatch(mails, atomic)` | Send N mails in one tx. `atomic = true` reverts on any failure; `atomic = false` skips failures and refunds unspent value. |
| `getInbox(addr)` / `getInboxes(addrs)` | Read fee + key slots in one call (single or batch). |

> *`registerDelegate` / `revokeDelegate` / `revokeMyself` and the corresponding `DelegateRegistered` / `DelegateRevoked` events are **not used by v1 clients** (`@heed/core`, `heed-cli`, `web`). They remain on-chain for future clients.*

Events: `MailSent`, `KeyPublished`, `FeeUpdated`, `Trusted`, `DelegateRegistered`, `DelegateRevoked`.

## Quick interaction (cast)

```bash
HEED=0x08f32278B2CFD962444ae9541122eD84cc745678
RPC=https://rpc.mainnet.taiko.xyz

cast call $HEED 'MAX_FEE_GWEI()(uint32)' --rpc-url $RPC
cast call $HEED 'feeGwei(address)(uint32)' 0xYourAddr --rpc-url $RPC
cast call $HEED 'getInbox(address)((uint32,(uint32,uint64,bytes32)[2]))' 0xYourAddr --rpc-url $RPC

cast send $HEED 'setFee(uint32)' 1000 --rpc-url $RPC --private-key $PK
```

For typed clients, use [`@heed/core`](../core-lib): `createReadClient`, `createWriteClient`, `createRpcMailSource`.

## Build, test, gas

```bash
cd contracts
forge build                              # default profile (cancun) for local tests
FOUNDRY_PROFILE=layer2 forge build       # shanghai for Taiko-deployable bytecode
forge test                               # 30 tests: 27 unit + 2 fuzz + 1 invariant
forge snapshot --check                   # verify .gas-snapshot is up to date
slither impl/Heed.sol --config slither.config.json
```

## Reproducing the deployment

```bash
FOUNDRY_PROFILE=layer2 forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.mainnet.taiko.xyz \
  --private-key $DEPLOYER_PK \
  --broadcast --slow
```

Verify on Taikoscan via the Etherscan V2 multichain endpoint (the legacy V1 endpoint is deprecated):

```bash
FOUNDRY_PROFILE=layer2 forge verify-contract 0x08f32278B2CFD962444ae9541122eD84cc745678 \
  impl/Heed.sol:Heed --watch \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=167000" \
  --etherscan-api-key $ETHERSCAN_V2_API_KEY \
  --constructor-args 0x0000000000000000000000000000000000000000000000000000000000989680 \
  --compiler-version 0.8.27 --num-of-optimizations 1000000 --evm-version shanghai
```

The Etherscan V2 key must be registered on `etherscan.io` with multichain access enabled — Taikoscan-only keys won't authenticate.

## Source layout

```
contracts/
  foundry.toml          # default = cancun; [profile.layer2] = shanghai
  foundry.lock          # pins forge-std @ v1.16.0
  remappings.txt
  iface/IHeed.sol       # interface, events, errors, structs
  impl/Heed.sol         # implementation
  script/Deploy.s.sol   # forge script — sets MAX_FEE_GWEI = 10_000_000
  test/
    Heed.t.sol               # 27 unit tests
    Heed.invariant.t.sol     # invariant + accounting fuzz
    utils/Reverter.sol       # test helper: receive() that reverts
  slither.config.json
  .gas-snapshot         # forge snapshot output (commit on changes)
```

The plan called for `src/interfaces/IHeed.sol` + `src/Heed.sol`; the actual layout is `iface/IHeed.sol` + `impl/Heed.sol` and `foundry.toml` sets `src = "impl"` to match.
