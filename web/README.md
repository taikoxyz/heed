# `@heed/web`

Heed web client. React + Vite + TS SPA styled with Tailwind + shadcn/ui.
Wallet connect → read & decrypt mail, compose encrypted mail to one or more
recipients, and manage your on-chain inbox. Static-deployable, IPFS-pinnable.

Spec: [`docs/heed-design.md`](../docs/heed-design.md).
Plan: [`docs/plans/2026-04-28-web.md`](../docs/plans/2026-04-28-web.md).

## Features

- **Inbox / Sent** — paginated, filterable lists with manual refresh; opens and
  decrypts encrypted payloads and renders signed agent envelopes.
- **Compose** — multiple `To` + `Cc` recipients, reply prefill, recipient/fee
  preview, and a confirmation before sending plaintext to keyless recipients.
- **Account** — publish/rotate your X25519 encryption key, set your anti-spam
  fee, and trust/untrust senders.
- **Polish** — light/dark theme toggle, wrong-network guard with one-click
  switch to Taiko, and toast notifications.

## Develop

The repo is an npm workspace. Install from the repo root:

```bash
npm install
npm --workspace @heed/core run build   # produces core-lib/dist/
npm --workspace @heed/web run dev      # http://localhost:5173
```

`@heed/web` resolves `@heed/core` through the workspace; rebuild the core when
changing it.

### Environment

Copy [`.env.example`](.env.example) to `.env.local` and adjust as needed. The
defaults target Taiko mainnet with the production Heed contract (deployment
captured in [`deployments/mainnet.json`](../deployments/mainnet.json)).

| Variable                 | Purpose                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `VITE_HEED_ADDRESS`      | Heed contract address                                            |
| `VITE_TAIKO_RPC`         | RPC endpoint for log scans + reads                               |
| `VITE_IPFS_GATEWAY`      | Gateway used to fetch encrypted payloads                         |
| `VITE_INDEXER_URL`       | Optional GraphQL endpoint; falls back to RPC log scan when unset |
| `VITE_DEPLOYED_AT_BLOCK` | Lower bound for `getLogs`                                        |
| `VITE_WC_PROJECT_ID`     | WalletConnect project id; the WC connector is omitted when unset |

Settings entered through the in-app **Settings** panel persist to localStorage
and override these defaults at runtime.

## Test

```bash
npm --workspace @heed/web run typecheck
npm --workspace @heed/web run test          # vitest unit tests
npm --workspace @heed/web run test:e2e      # playwright
```

`e2e/app.spec.ts` drives the connected UI via an injected `window.ethereum`
stub (see [`e2e/fixtures.ts`](e2e/fixtures.ts)) and runs in CI. The
on-chain-data inbox spec in [`e2e/inbox.spec.ts`](e2e/inbox.spec.ts) stays
skipped pending an anvil fork fixture.

## Reproducible build

The release artifact is the contents of `dist/` after a clean checkout build
against the published `package-lock.json`:

```bash
git clone <repo> heed && cd heed
npm ci
npm --workspace @heed/core run build
npm --workspace @heed/web run build
```

Verifiers can then recompute the IPFS root CID of `web/dist/` and compare
against the canonical published CID:

```bash
ipfs add -r --only-hash --quieter web/dist/
```

## Distribution

The release flow pins `web/dist/` to IPFS in addition to publishing to the
canonical host:

```bash
# Either the local daemon ...
ipfs add -r --pin web/dist/

# ... or the Pinata pinDir API.
```

The published CID is the integrity-pinned distribution; clients can serve it
from any IPFS gateway. The canonical HTTP host is a convenience mirror.

## Deploy (Vercel)

[`vercel.json`](../vercel.json) at the repo root builds `@heed/core` then the
web app and serves `web/dist/` as an SPA. Point a Vercel project at the repo
root and it picks up the config automatically. The
[`deploy`](../.github/workflows/deploy.yml) workflow also deploys on push to
`main` when the `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`
repository secrets are set (it no-ops otherwise). Set production `VITE_*` env
vars in the Vercel dashboard; the build falls back to the Taiko mainnet
deployment when they are unset.

## Security posture

- Private keys never leave browser memory. The X25519 private key derived from
  the EIP-712 signature is cached in a process-local `Map`, never persisted.
- `index.html` ships a strict CSP: `default-src 'self'`; `script-src 'self'`
  (no `eval`, no inline); explicit allowlist for Taiko RPC, Pinata gateway,
  and WalletConnect.
- No analytics, telemetry, or third-party scripts. The bundle does not phone
  home.

## Out of scope (v1a)

- Delegate-key registration.
- Persistent encrypted storage of derived keys.
- Real-time push (websocket / SSE) — reads are pull-based via
  `RpcMailSource.listInbox`.
