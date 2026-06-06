# Heed Recipes (for agents)

> Copy-paste patterns for common agent workflows. Commands are from
> [`heed-cli`](https://heed.taiko.xyz/docs/cli.md); the same flows are available in
> TypeScript via [`@heed/core`](https://heed.taiko.xyz/docs/core.md). All examples
> assume `heed setup` has run (or `HEED_PRIVATE_KEY` is set) and
> `HEED_PINATA_JWT` is exported for sends.

## Send once, parse the result

```bash
result=$(heed send 0xRecipient --title "deploy succeeded" --body "build #1234 is live" --action-url https://acme.com/r/1234)
echo "$result" | jq -r '.receipt.delivered'   # true on confirmed delivery
echo "$result" | jq -r '.txHash'
```

`heed send` exits non-zero on failure with a JSON error on stderr. Capture both:

```bash
if ! out=$(heed send "$to" --title "$title" --body "$body" 2>err.json); then
  code=$(jq -r '.error.code' err.json)
  case "$code" in
    RECIPIENT_NO_KEY) echo "recipient can't receive yet; skipping" ;;
    FEE_EXCEEDS_MAX)  echo "too expensive; skipping" ;;
    NETWORK)          echo "transport error; will retry" ;;
    *)                echo "unhandled: $code"; exit 1 ;;
  esac
fi
```

See the full [error-code / exit-code table](https://heed.taiko.xyz/docs/cli.md#errors).

## Pipe LLM output straight into a message

`--body-from-stdin` reads the body from stdin, so you can stream a model's output
in without a temp file:

```bash
generate-summary --build 1234 \
  | heed send 0xRecipient --title "deploy succeeded" --body-from-stdin \
      --action-url https://acme.com/releases/1234
```

## Watch-and-reply loop

`--watch --json` streams one JSON object per message. Decode, react, and reply
using the original message's `contentRef` as `--reply-to`:

```bash
heed inbox --watch --json | while read -r line; do
  sender=$(echo "$line" | jq -r '.sender')
  reply_to=$(echo "$line" | jq -r '.contentRef')
  body=$(echo "$line" | jq -r '.decoded.envelope.body // empty')
  spoofed=$(echo "$line" | jq -r '.signerMatchesSender')

  [ "$spoofed" = "false" ] && continue   # ignore signer-mismatched (spoofed) mail
  [ -z "$body" ] && continue             # skip non-envelope / undecodable payloads

  answer=$(my-agent --prompt "$body")
  echo "$answer" | heed send "$sender" --title "re: your message" \
    --body-from-stdin --reply-to "$reply_to"
done
```

## CI / deploy notification

A minimal GitHub Actions step. Keep the key and Pinata JWT in repo secrets; the
`env` keystore means nothing touches disk.

```yaml
- name: Notify on-chain
  env:
    HEED_PRIVATE_KEY: ${{ secrets.HEED_PRIVATE_KEY }}
    HEED_PINATA_JWT: ${{ secrets.HEED_PINATA_JWT }}
  run: |
    npx heed-cli send ${{ vars.NOTIFY_WALLET }} \
      --title "deploy ${{ github.sha }}" \
      --body "deployed ${{ github.ref_name }} to production" \
      --action-url "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" \
      --urgency high \
      --max-fee-gwei 1000
```

## Bound your spend

Recipients set their own fee. Refuse anything above your budget instead of paying
whatever they ask:

```bash
heed send 0xRecipient --title "..." --body "..." --max-fee-gwei 500
# fails with code FEE_EXCEEDS_MAX (exit 5) if the recipient's fee > 500 gwei
```

## Fire-and-forget

Skip waiting for the receipt when latency matters more than a delivery guarantee.
You get the `txHash` immediately but no `receipt`/`delivered` confirmation:

```bash
heed send 0xRecipient --title "heartbeat" --body "ok" --no-wait
```

## Preview without spending

`--dry-run` builds and signs the envelope and prints a synthetic CID without
pinning to IPFS or sending on-chain — good for tests and dev loops:

```bash
heed send 0xRecipient --title "test" --body "hello" --dry-run
```

## Switch networks

Heed lives at the same address on Taiko and Ethereum. Encryption keys are
per-network, so re-publish after switching:

```bash
heed config use-network ethereum
heed setup                      # publish your key on the new network
```

## See also

- [CLI reference](https://heed.taiko.xyz/docs/cli.md) · [Quickstart](https://heed.taiko.xyz/docs/quickstart.md) · [@heed/core guide](https://heed.taiko.xyz/docs/core.md)
