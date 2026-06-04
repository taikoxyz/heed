# Heed Contracts

`Heed.sol` is the on-chain core of the [Heed](../docs/heed-design.md) protocol — a single contract on Ethereum and Taiko that lets any EVM address receive recipient-priced, address-native mail.

## Mainnet deployment

Deployed via CREATE2 (canonical factory `0x4e59b44847b379578588920cA78FbF26c0B4956C`) so the address is identical on every chain.

|                                  |                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| **Address** (proxy, both chains) | `0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A`                                       |
| **Implementation**               | `0x1b0D359E7ae6Bd8a5eC3c643C1bdBa819FbEDe24`                                       |
| **Owner**                        | `0x0F026a3efE44E0Fe34B87375EFe69b16c05D0438`                                       |
| **Deployer**                     | `0x327fa3369B1D1D42120d84bc407e5865ECa7c458`                                       |
| **Salt**                         | `0x016dda648449d72d80d48db9a9fefac67ff7d92a547d0a25ecc303e18f7facf3`               |
| **Constructor**                  | `MAX_FEE_GWEI = 10_000_000` (0.01 ETH cap on per-mail fees)                        |
| **Compiler**                     | solc `0.8.27`, EVM version `shanghai`, optimizer `1_000_000` runs, `via_ir = true` |

| Network                  | Block      | Deploy tx                                                                                                        | Verification                                                                              |
| ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Ethereum Mainnet (`1`)   | `25240881` | [`0x59890176…1016c`](https://etherscan.io/tx/0x59890176b982ff67c7060b5af15fcb2a3ce38092b5630d5b0e1d7bc259c1016c) | [Etherscan](https://etherscan.io/address/0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A#code) |
| Taiko Mainnet (`167000`) | `7500287`  | [`0xa8ef1a48…e6549`](https://taikoscan.io/tx/0xa8ef1a4855e02d401d350658092d2a8f73a80e0bbedd32596be7fb48154e6549) | [Taikoscan](https://taikoscan.io/address/0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A#code) |

Machine-readable records: [`deployments/ethereum.json`](../deployments/ethereum.json), [`deployments/taiko.json`](../deployments/taiko.json). Supersedes the deprecated Taiko-only `0x08f32278…5678`.

## Audit status

**No third-party audit has been performed.** The deployment was made knowingly. `Heed` is a **UUPS-upgradeable proxy**: the owner (`0x0F026a3efE44E0Fe34B87375EFe69b16c05D0438`) can replace the implementation, so bugs can be patched by an upgrade — but users must correspondingly trust the owner not to ship a malicious one. There is no on-chain governance. Use accordingly. The plan's audit gate ([`docs/plans/2026-04-28-contract.md`, Task 12 Step 3](../docs/plans/2026-04-28-contract.md)) was explicitly skipped by the owner.

## Surface

Full ABI in [`out/Heed.sol/Heed.json`](./out) after `forge build`. Interface spec in [`iface/IHeed.sol`](./iface/IHeed.sol). Core operations:

| Function                                        | Purpose                                                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `publishKey(keyNonce, pub)`                     | Publish/rotate an x25519 pubkey for receiving encrypted mail. Two newest slots retained, monotonic `keyNonce`.             |
| `setFee(valueGwei)`                             | Set the per-mail anti-spam fee. Capped at `MAX_FEE_GWEI`.                                                                  |
| `trust(senders)` / `untrust(senders)`           | Whitelist senders that can mail you fee-free.                                                                              |
| `registerDelegate(delegate, clientId, v, r, s)` | Owner registers a per-client delegate (EIP-712 sig); attaches optional ETH to fund the delegate's gas.                     |
| `revokeDelegate(delegate)` / `revokeMyself()`   | Owner-side or delegate-side revocation.                                                                                    |
| `sendBatch(mails, atomic)`                      | Send N mails in one tx. `atomic = true` reverts on any failure; `atomic = false` skips failures and refunds unspent value. |
| `getInbox(addr)` / `getInboxes(addrs)`          | Read fee + key slots in one call (single or batch).                                                                        |

> _`registerDelegate` / `revokeDelegate` / `revokeMyself` and the corresponding `DelegateRegistered` / `DelegateRevoked` events are **not used by v1 clients** (`@heed/core`, `heed-cli`, `web`). They remain on-chain for future clients._

Events: `MailSent`, `KeyPublished`, `FeeUpdated`, `Trusted`, `DelegateRegistered`, `DelegateRevoked`.

## Quick interaction (cast)

```bash
HEED=0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A
RPC=https://rpc.mainnet.taiko.xyz   # or https://ethereum-rpc.publicnode.com

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

The same address on every chain comes from a fixed-salt CREATE2 deploy via the canonical factory. Build with `FOUNDRY_PROFILE=layer2` (EVM `shanghai`) on **both** chains so the initcode — and therefore the address — is byte-identical. `OWNER` and `SALT` must match across chains.

```bash
OWNER=0x0F026a3efE44E0Fe34B87375EFe69b16c05D0438
SALT=0x016dda648449d72d80d48db9a9fefac67ff7d92a547d0a25ecc303e18f7facf3

# Dry-run on each chain (no --broadcast) and confirm the predicted proxy matches:
FOUNDRY_PROFILE=layer2 OWNER=$OWNER SALT=$SALT forge script \
  script/DeployDeterministic.s.sol:DeployDeterministic --rpc-url <eth|taiko> --sender $DEPLOYER

# Broadcast (Taiko, then Ethereum):
FOUNDRY_PROFILE=layer2 OWNER=$OWNER SALT=$SALT forge script \
  script/DeployDeterministic.s.sol:DeployDeterministic \
  --rpc-url <rpc> --private-key $DEPLOYER_KEY --broadcast --slow
```

Verify impl + proxy on both chains via the Etherscan V2 multichain endpoint (`chainid=1` and `chainid=167000`; the legacy V1 endpoint is deprecated):

```bash
FOUNDRY_PROFILE=layer2 forge verify-contract 0x1b0D359E7ae6Bd8a5eC3c643C1bdBa819FbEDe24 \
  impl/Heed.sol:Heed --watch \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=<1|167000>" \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args 0x0000000000000000000000000000000000000000000000000000000000989680 \
  --compiler-version 0.8.27 --num-of-optimizations 1000000
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
