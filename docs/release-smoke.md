# Release Smoke — Mainnet Manual Checklist

Run this before each release tag (and before any npm publish of `heed-cli` / `@heed/core`). The anvil-fork e2e (`npm run e2e`) covers the codepath; this checklist exercises real Taiko mainnet, real ETH, real IPFS, and the deployed [`Heed.sol`](https://taikoscan.io/address/0x08f32278B2CFD962444ae9541122eD84cc745678).

Audit this off — if any step fails, **block the tag** until the regression is fixed.

## Prerequisites

- Two funded wallets on Taiko mainnet (call them **A** and **B**), each with ≥ 0.01 ETH.
- `HEED_PINATA_JWT` for pinning.
- A working build of `heed-cli` (`npm --workspace heed-cli run build`).
- Wallet B has a browser with the deployed `@heed/web` inbox at <https://heed.taiko.xyz> open and connected.
- Two separate `HEED_HOME` dirs so the wallets don't clobber each other:

  ```bash
  export HOME_A=/tmp/heed-smoke-a
  export HOME_B=/tmp/heed-smoke-b
  ```

## Steps

### 1. Configure wallet A as the sender

```bash
HEED_HOME=$HOME_A heed setup --import-private-key 0x<wallet-A-pk>
HEED_HOME=$HOME_A heed agent set-name      "release-smoke"
HEED_HOME=$HOME_A heed agent set-owner-url "https://heed.xyz"
HEED_HOME=$HOME_A heed agent set-uri       "https://heed.xyz/agents/release-smoke"
HEED_HOME=$HOME_A heed agent show
```

Confirm the printed address matches wallet A.

### 2. Configure wallet B as the recipient

```bash
HEED_HOME=$HOME_B heed setup --import-private-key 0x<wallet-B-pk>
```

This publishes B's encryption key on-chain so A's `send` can lockbox-encrypt for B.

### 3. Send A → B

```bash
HEED_HOME=$HOME_A heed send 0x<wallet-B-addr> \
  --title       "release smoke <tag>" \
  --body        "smoke test for release <tag>" \
  --action-url  "https://heed.xyz" \
  --urgency     normal
```

Capture the `txHash` field from the JSON output.

### 4. Verify in the web inbox (wallet B)

1. Open the deployed `@heed/web` inbox at <https://heed.taiko.xyz> in a browser as wallet B.
2. Decrypt the inbox (sign the EIP-712 typed data prompt).
3. Locate the new message.
4. Confirm:
   - Sender card renders `release-smoke` (claimed name).
   - `https://heed.xyz` link is the rendered `owner_url`.
   - URI badge shows the `https://heed.xyz/agents/release-smoke` claim.
   - Body matches the `--body` argument.
   - Urgency badge shows `normal`.
   - "Open" CTA links to `https://heed.xyz`.
   - Fee = recipient's configured `feeGwei` (or 0 if unset).
   - Signer-vs-sender verification passes (no ⚠ signer mismatch badge).

### 5. Verify in `heed inbox` (wallet B)

```bash
HEED_HOME=$HOME_B heed inbox --limit 3 --json | jq '.[0]'
```

Confirm the same envelope content, and `"signatureValid": true`, `"signerMatchesSender": true`.

### 6. Reply B → A

```bash
HEED_HOME=$HOME_B heed send 0x<wallet-A-addr> \
  --title    "re: release smoke <tag>" \
  --body     "ack — received" \
  --reply-to 0x<contentRef-from-step-3>
```

Capture this `txHash` too.

### 7. Verify reply in wallet A

```bash
HEED_HOME=$HOME_A heed inbox --watch
```

Confirm the reply appears, decrypts, decodes, and shows the threading `(reply to <ref>...)` annotation.

### 8. Record the smoke

Append a row to the "Release smokes" table in [`DEPLOYED.md`](../DEPLOYED.md):

| Tag     | Date         | A → B tx                                 | B → A tx                                 | Web verified | Smoke runner      |
| ------- | ------------ | ---------------------------------------- | ---------------------------------------- | ------------ | ----------------- |
| `<tag>` | `YYYY-MM-DD` | [`0x...`](https://taikoscan.io/tx/0x...) | [`0x...`](https://taikoscan.io/tx/0x...) | yes          | `<github handle>` |

Only after this row lands: tag the release and (when applicable) run `npm publish`.

## Failure handling

- **Tx revert.** Capture the revert reason from Taikoscan; file an issue; block the tag.
- **Decode failure in web inbox.** Capture the on-chain `contentRef` and the IPFS payload bytes; file an issue; block the tag.
- **Signer mismatch.** Capture the envelope JSON from `heed inbox --json`; treat as a P0 — likely a regression in `@heed/core`'s envelope signing or verification. Block the tag.
- **Pinata pinning failure.** Retry once. If persistent: confirm `HEED_PINATA_JWT` is valid; rotate if expired. If the pinning service itself is down, document and re-run when it recovers — not a release blocker by itself but the smoke is incomplete until the send lands.
