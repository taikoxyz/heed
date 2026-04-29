#!/usr/bin/env bash
# scripts/e2e.sh — anvil + forge deploy + heed protocol round-trip via @heed/core.
# Validates the full envelope round-trip against deployed Heed.sol bytecode.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

ANVIL_PORT="${ANVIL_PORT:-8545}"
RPC_URL="http://127.0.0.1:${ANVIL_PORT}"
ANVIL_LOG="$(mktemp -t heed-anvil.XXXXXX)"
ANVIL_PID=""

# Default anvil pre-funded accounts (deterministic with default mnemonic).
ANVIL_PK_0="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ANVIL_PK_1="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

cleanup() {
  if [[ -n "$ANVIL_PID" ]] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
  if [[ -n "${KEEP_LOGS:-}" ]]; then
    echo "anvil log: $ANVIL_LOG" >&2
  else
    rm -f "$ANVIL_LOG"
  fi
}
trap cleanup EXIT INT TERM

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing prerequisite: $1" >&2; exit 1; }
}

require anvil
require forge
require node
require npx
require curl
require jq

echo "[e2e] building @heed/core (required for the runtime import)..."
npm --workspace @heed/core run build --silent

echo "[e2e] starting anvil on :$ANVIL_PORT..."
anvil --port "$ANVIL_PORT" --silent >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!

# Wait for anvil to accept JSON-RPC.
for _ in $(seq 1 50); do
  if curl -sf -X POST -H "Content-Type: application/json" \
       --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
       "$RPC_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
if ! curl -sf -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     "$RPC_URL" >/dev/null 2>&1; then
  echo "anvil failed to start. log:" >&2
  cat "$ANVIL_LOG" >&2
  exit 1
fi

CHAIN_ID_HEX=$(curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  "$RPC_URL" | jq -r '.result')
CHAIN_ID=$((CHAIN_ID_HEX))
echo "[e2e] anvil chainId: $CHAIN_ID"

echo "[e2e] deploying Heed via forge create..."
DEPLOY_OUT=$(forge create \
  --root contracts \
  --rpc-url "$RPC_URL" \
  --private-key "$ANVIL_PK_0" \
  --broadcast \
  --json \
  impl/Heed.sol:Heed \
  --constructor-args 10000000)
HEED_ADDRESS=$(echo "$DEPLOY_OUT" | jq -r '.deployedTo')
DEPLOY_TX=$(echo "$DEPLOY_OUT" | jq -r '.transactionHash')
echo "[e2e] Heed deployed at: $HEED_ADDRESS"
echo "[e2e] deploy tx: $DEPLOY_TX"

# Resolve the deployment block so the mail source knows where to start.
DEPLOY_BLOCK_HEX=$(curl -s -X POST -H "Content-Type: application/json" \
  --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getTransactionReceipt\",\"params\":[\"$DEPLOY_TX\"],\"id\":1}" \
  "$RPC_URL" | jq -r '.result.blockNumber')
DEPLOY_BLOCK=$((DEPLOY_BLOCK_HEX))
echo "[e2e] Heed deployed at block: $DEPLOY_BLOCK"

echo "[e2e] running protocol round-trip driver..."
RPC_URL="$RPC_URL" \
  HEED_ADDRESS="$HEED_ADDRESS" \
  DEPLOYED_AT_BLOCK="$DEPLOY_BLOCK" \
  CHAIN_ID="$CHAIN_ID" \
  ALICE_PK="$ANVIL_PK_0" \
  BOB_PK="$ANVIL_PK_1" \
  npx --no-install tsx scripts/e2e/run.ts

echo "[e2e] OK"
