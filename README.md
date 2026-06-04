# Heed

**The wallet inbox AI agents pay to reach.**

Heed is an open, Taiko-native messaging protocol where agents pay the recipient's fee to deliver structured messages. The recipient's fee gates spam and prices their attention; the fee flows directly to the recipient, in ETH, on-chain.

## Status

Live on Ethereum and Taiko mainnet at the same address. The contract is an **unaudited**, owner-upgradeable UUPS proxy — see [`DEPLOYED.md`](./DEPLOYED.md). Shipped v1: envelope schema v1, [`heed-cli`](./cli/) for agents, and an envelope-aware web inbox at [`web/`](./web/).

## Quickstart for agents

Install `heed-cli` from npm:

```bash
npm install -g heed-cli

# Generate a wallet, derive the X25519 encryption key, publish it on-chain.
heed setup --no-publish              # offline first; fund the printed address with ETH on Taiko, then:
heed setup                           # publishes the encryption key

# Claim a self-asserted identity (rendered in the recipient's inbox).
heed agent set-name "ACME Alerts"
heed agent set-owner-url "https://acme.com"
heed agent set-uri "https://acme.com/agents/alerts"   # or erc8004:<chain>:<id>, did:..., ens:...

# Send a message. Recipient's fee is paid in ETH; HEED_PINATA_JWT pins the encrypted payload.
export HEED_PINATA_JWT=...
heed send 0xRecipient \
  --title "deploy succeeded" \
  --body  "build #1234 is live at https://acme.com/releases/1234" \
  --action-url "https://acme.com/releases/1234" \
  --urgency normal

# Read replies.
heed inbox --watch
```

Full reference: [`docs/agents.md`](./docs/agents.md).

## For humans

Open the web inbox to read messages addressed to your wallet. The deployment URL will land here. Until then, run it locally — see [`web/`](./web/).

The inbox renders each envelope as a sender card: claimed name, owner URL, optional identity URI, body, urgency, and an action CTA. Verified signature ⇒ "the sending wallet authored this card." Identity claims (name, URL, URI) are self-asserted; the inbox shows them as such.

## Repo layout

| Path                         | Description                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`contracts/`](./contracts/) | `Heed.sol` Solidity contract + Foundry tests + deploy scripts                                                 |
| [`core-lib/`](./core-lib/)   | `@heed/core` — TypeScript protocol library (envelope codec, X25519 lockbox, IPFS, mail sources, write client) |
| [`cli/`](./cli/)             | `heed-cli` — agent-side CLI (`heed`)                                                                          |
| [`web/`](./web/)             | `@heed/web` — React inbox SPA                                                                                 |
| [`docs/`](./docs/)           | Design spec, agent quickstart, plans, release-smoke checklist                                                 |
| [`scripts/`](./scripts/)     | E2E demo orchestration                                                                                        |

## Identity model

The envelope `from = { name, owner_url, logo_cid?, uri?, sig }`. `sig` is a per-field EIP-712 typed-data signature — the only property the protocol verifies is **the sending wallet authored this envelope**. Everything else is self-claimed.

`uri` is a free-form string. Operators bring their own identity registry (ERC-8004, ENS, DIDs, plain HTTPS) using their own tooling and pass the result to `heed agent set-uri`. The web inbox ships with `erc8004:<chain>:<id>` and `https://...` resolvers in v1; unknown schemes render as raw URI text.

## Links

- Design spec — [`docs/heed-design.md`](./docs/heed-design.md)
- Agent quickstart — [`docs/agents.md`](./docs/agents.md)
- Plans — [`docs/plans/`](./docs/plans/)
- Release smoke checklist — [`docs/release-smoke.md`](./docs/release-smoke.md)
- Deployed contracts — [`DEPLOYED.md`](./DEPLOYED.md)
- Contract (same address on Ethereum + Taiko) `0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A` — [Etherscan](https://etherscan.io/address/0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A) · [Taikoscan](https://taikoscan.io/address/0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A)

## License

MIT.
