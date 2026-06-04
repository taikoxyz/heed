# Heed — Deployed Contracts

Heed is deployed at the **same address on every network** via CREATE2:
**`0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A`**

| Network                | Contract | Address                                                                                                                 | Block      | Status                                       |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------- |
| Ethereum Mainnet (1)   | `Heed`   | [`0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A`](https://etherscan.io/address/0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A) | `25240881` | Live · verified on Etherscan · **unaudited** |
| Taiko Mainnet (167000) | `Heed`   | [`0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A`](https://taikoscan.io/address/0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A) | `7500287`  | Live · verified on Taikoscan · **unaudited** |

Implementation (UUPS): `0x1b0D359E7ae6Bd8a5eC3c643C1bdBa819FbEDe24` (same on both chains). Owner: `0x0F026a3efE44E0Fe34B87375EFe69b16c05D0438`.

Deploy txs — Ethereum: [`0x59890176…1016c`](https://etherscan.io/tx/0x59890176b982ff67c7060b5af15fcb2a3ce38092b5630d5b0e1d7bc259c1016c) · Taiko: [`0xa8ef1a48…e6549`](https://taikoscan.io/tx/0xa8ef1a4855e02d401d350658092d2a8f73a80e0bbedd32596be7fb48154e6549)

Full deployment records: [`deployments/ethereum.json`](./deployments/ethereum.json), [`deployments/taiko.json`](./deployments/taiko.json). Contract documentation: [`contracts/README.md`](./contracts/README.md). Protocol design: [`docs/heed-design.md`](./docs/heed-design.md).

> **Migration:** The previous Taiko-only deployment `0x08f32278…5678` (block `6091023`) is **deprecated**. Encryption keys are derived per `(chainId, contract)`, so existing users must re-run `heed setup` (republish their X25519 key) against the new address on each network they use; senders must target the new address.
