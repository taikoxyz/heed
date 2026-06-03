# `heed-cli` — Agent Quickstart

`heed-cli` is the agent-side reference client for the Heed protocol. It builds, signs, encrypts, and pins envelope payloads, then submits them to `Heed.sol` paying the recipient's anti-spam fee. It also reads, decrypts, and decodes the agent's inbox.

Audience: an engineer running an AI agent (cron job, CI step, framework integration) that needs to deliver structured messages to wallets.

## What this is

Pay-to-deliver wallet messaging where the recipient prices their attention. You fund a wallet with ETH on Taiko, set self-claimed identity (name, owner URL, optional URI), and send envelopes. The recipient sees a signed sender card in their inbox; the wallet binding is proven, the rest is claimed.

Heed defines the message envelope. Identity registries (ERC-8004, ENS, DIDs, plain HTTPS) live outside the protocol — bring your own URI from your own tooling.

## Install

```bash
npm install -g heed-cli
heed --help
```

For development against the source tree, build from the workspace instead:

```bash
git clone https://github.com/taikoxyz/heed && cd heed
npm install
npm --workspace heed-cli run build
alias heed='node "$PWD/cli/dist/index.js"'
```

## Setup

`heed setup` generates (or imports) a wallet, derives the X25519 encryption keypair via the EIP-712 typed-data signing flow, and publishes the public encryption key on-chain via `Heed.publishKey`.

```bash
# First, generate a wallet without publishing — fund the printed address with ETH on Taiko first.
heed setup --no-publish
# {
#   "address": "0xAB...CD",
#   "encryptionPub": "0x...",
#   "keyNonce": 0,
#   "imported": false
# }

# Send ~0.001 ETH to that address on Taiko (see https://taikoscan.io).
# Then publish the encryption key:
heed setup
# Re-runs derivation and submits the publishKey transaction.
```

**Flags:**

| Flag                           | Effect                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `--import-private-key <hex>`   | Import an existing 0x-prefixed 64-char private key instead of generating one.     |
| `--rpc-url <url>`              | Override the configured Taiko RPC for the publishKey transaction.                 |
| `--no-publish`                 | Skip the on-chain publishKey call (useful for offline setup / fund-then-publish). |
| `-f, --force`                  | Overwrite an existing wallet (otherwise setup refuses to clobber).                |
| `--keystore <auto\|file\|env>` | Where to read/write the private key. Default `auto`.                              |

**Storage:**

- Default: `$XDG_CONFIG_HOME/heed/wallet.json` (or `~/.config/heed/wallet.json`), mode 0600.
- Override the config dir with `HEED_HOME=/path/to/dir`.
- Headless / CI / sandboxed agents: set `HEED_PRIVATE_KEY=0x...`. When this env var is present, `--keystore auto` selects it — no file is read or written. Mirrors the `~/.aws/credentials` / `gh auth` mental model.

After `heed setup` succeeds, `heed key show` prints the wallet address derived from the loaded key.

## Claim an identity

The envelope's `from` block carries self-claimed identity that the recipient's inbox renders. The signature binds the envelope to the sending wallet — that's the only verified property. Everything else is a claim.

```bash
heed agent set-name      "ACME Alerts"
heed agent set-owner-url "https://acme.com"
heed agent set-logo-cid  "bafkreigh..."                 # optional, IPFS CID
heed agent set-uri       "https://acme.com/agents/alerts"
heed agent show
```

`heed agent show` prints the wallet address and all stored identity fields.

### Recommended URI schemes

`uri` is a single free-form string (≤256 chars). Heed does not parse it. Inbox renderers interpret recognized schemes per a pluggable resolver registry; unknown schemes render as raw URI text.

| Scheme                              | Behavior in `@heed/web` v1                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `erc8004:<chain>:<id>`              | ERC-8004 agent registry lookup; renders a "verified via 8004" affordance on success.                |
| `https://acme.com/agents/foo`       | Best-effort favicon + page title fetch.                                                             |
| `did:...`, `ens:...`, anything else | Rendered as raw URI in v1. Per-renderer resolvers can be added without changing the resolver shape. |

Heed itself does not register the agent on any external registry. If you want ERC-8004 / ENS / DID registration, do it with your own tooling and pass the resulting URI to `heed agent set-uri`.

## Send a message

```bash
export HEED_PINATA_JWT=eyJhbGciOiJI...   # Pinata JWT for IPFS pinning
heed send 0xRecipient \
  --title       "deploy succeeded" \
  --body        "build #1234 is live at https://acme.com/releases/1234" \
  --action-url  "https://acme.com/releases/1234" \
  --urgency     normal
# {
#   "txHash":     "0x...",
#   "contentRef": "0x...",
#   "valueGwei":  500,
#   "envelope":   { ... }
# }
```

**Required:** `--title` (≤120 chars).

**Body source — pick one:**

- `--body "..."` — pass on the command line.
- `--body-from-stdin` — read body from stdin. Useful for piping LLM output:

  ```bash
  generate-summary --build 1234 | heed send 0xRecipient \
    --title "deploy succeeded" --body-from-stdin --action-url https://acme.com/releases/1234
  ```

**Optional flags:**

| Flag                            | Effect                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `--urgency <low\|normal\|high>` | UI hint only; default `normal`.                                                  |
| `--action-url <url>`            | https-only CTA the recipient can tap.                                            |
| `--reply-to <hash>`             | 32-byte content reference of the message being replied to.                       |
| `--rpc-url <url>`               | Override the configured Taiko RPC.                                               |
| `--dry-run`                     | Build, sign, and print the envelope without pinning to IPFS or sending on-chain. |
| `--keystore <auto\|file\|env>`  | Override key source.                                                             |

**Fees and priority.** The contract requires `valueGwei >= recipient.feeGwei` (or zero if the recipient has whitelisted you via `Heed.trust`). Paying more than the floor buys priority — the inbox bucketizes incoming mail client-side as `low` (=fee), `medium` (≥2× fee), or `high` (≥3× fee). The CLI defaults `valueGwei = recipient.feeGwei`. (Voluntary over-pay UX is on the v1 backlog; until then, sending higher-priority messages requires editing the call in `cli/src/lib/send.ts` or invoking `@heed/core` directly.)

**Pinning.** `HEED_PINATA_JWT` must be set to pin the encrypted bytes to IPFS. You can swap pinning services by modifying `cli/src/commands/send.ts`'s `pin` injection — Pinata is the default but the protocol is gateway-agnostic. `--dry-run` skips pinning entirely and prints a synthetic `contentRef`.

## Read replies

```bash
heed inbox                    # list the last 50 historical messages
heed inbox --limit 10         # cap differently
heed inbox --since-block N    # only messages mined at or after block N
heed inbox --watch            # historical list, then keep listening for new messages
heed inbox --json             # machine-readable JSON, one message per line
```

`--watch` and `--json` compose for an agent reading replies in a loop:

```bash
heed inbox --watch --json | while read -r line; do
  reply_to=$(echo "$line" | jq -r '.contentRef')
  body=$(echo "$line" | jq -r '.decoded.envelope.body')
  # ...react to the reply, optionally heed send <sender> --reply-to "$reply_to" ...
done
```

Each message in `--json` mode looks like:

```json
{
  "txHash": "0x...",
  "blockNumber": "6234567",
  "blockTimestamp": 1745000000,
  "sender": "0xAB...CD",
  "recipient": "0xYourAgent",
  "contentRef": "0x...",
  "valueGwei": 500,
  "decoded": {
    "kind": "envelope",
    "envelope": {
      "v": 1,
      "kind": "agent",
      "from": {
        "name": "...",
        "owner_url": "...",
        "uri": "...",
        "sig": "0x..."
      },
      "title": "...",
      "body": "...",
      "urgency": "normal",
      "action_url": "https://...",
      "reply_to": "0x...",
      "sent_at": 1745000000
    }
  },
  "signatureValid": true,
  "signerMatchesSender": true
}
```

`signerMatchesSender = false` means the envelope was signed by a different wallet than the on-chain sender. Treat such messages as suspect — the inbox renderer surfaces this as a "⚠ signer mismatch" badge.

**Other flags:** `--rpc-url`, `--gateway` (override the IPFS gateway), `--keystore`.

## Operating cost

Each `heed send` costs:

- The recipient's `feeGwei` (paid in ETH directly to them).
- Taiko gas (cheap; typically far below the fee).
- The Pinata pin (free tier covers low-volume agents).

Fund the address printed by `heed setup` with a small amount of ETH on Taiko mainnet. Contract details and links: [`DEPLOYED.md`](../DEPLOYED.md).

## Web inbox

The `@heed/web` inbox at [`web/`](../web/) supports reading AND sending. Connect your wallet, configure a Pinata JWT in Settings, and use the **Compose** tab to send messages. The web app encrypts messages for recipients with a published encryption key and falls back to plaintext when no key is published. See [`web/README.md`](../web/README.md) for setup instructions.

## Configuration

```bash
heed config path                   # print the config file path
heed config get                    # whole config
heed config get network.rpc_url
heed config set network.rpc_url https://rpc.taiko.xyz
```

Allowed keys are listed by the CLI when an unknown key is passed.

## Troubleshooting

| Symptom                                                             | Cause                                                                       | Fix                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `no key loaded. run "heed setup" first or set HEED_PRIVATE_KEY.`    | Send/inbox without a wallet.                                                | `heed setup` (or set `HEED_PRIVATE_KEY`).                                                      |
| `a wallet is already configured. pass --force to overwrite...`      | Setup re-run on top of an existing key.                                     | Pass `--force` if you really want to clobber, or `--import-private-key` to replace explicitly. |
| `no RPC URL configured...`                                          | `network.rpc_url` empty and `--rpc-url` not passed.                         | `heed config set network.rpc_url https://rpc.taiko.xyz` or pass `--rpc-url`.                   |
| `HEED_PINATA_JWT must be set...`                                    | Sending without IPFS pinning credentials.                                   | `export HEED_PINATA_JWT=...` (or use `--dry-run`).                                             |
| `recipient must be a 0x-prefixed 40-char address`                   | Bad address argument.                                                       | Pass a checksummed Ethereum address.                                                           |
| `wallet ready, encryption key not yet published on-chain.` (stderr) | Setup ran with `--no-publish`.                                              | Fund the wallet, then `heed setup` (no flag) to submit the publishKey tx.                      |
| Inbox shows `<decode failed: ...>`                                  | Payload bytes don't match the v1 envelope or legacy plaintext schema.       | Likely a sender on a future schema version. Update `@heed/core`.                               |
| Inbox shows `⚠ signer mismatch`                                     | Envelope signature recovers to a wallet different from the on-chain sender. | Treat the message as untrusted. Could be an attempt to spoof identity.                         |

For deeper protocol details: [`docs/heed-design.md`](./heed-design.md). The locked v1 plan that produced this surface: [`docs/plans/2026-04-29-heed-v1-pivot.md`](./plans/2026-04-29-heed-v1-pivot.md).
