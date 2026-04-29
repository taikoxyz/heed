#!/usr/bin/env bash
# scripts/e2e-fork.sh — anvil fork of Taiko mainnet → protocol round-trip against deployed Heed.sol.
# Validates the full envelope round-trip against the REAL deployed contract bytecode
# at 0x08f32278B2CFD962444ae9541122eD84cc745678.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

ANVIL_PORT="${ANVIL_PORT:-8545}"
RPC_URL="http://127.0.0.1:${ANVIL_PORT}"
ANVIL_LOG="$(mktemp -t heed-anvil-fork.XXXXXX)"
ANVIL_PID=""

# Deployed Heed contract on Taiko mainnet.
HEED_ADDRESS="0x08f32278B2CFD962444ae9541122eD84cc745678"
HEED_DEPLOY_BLOCK=6091023
FORK_BLOCK="${FORK_BLOCK:-6091024}"

# Taiko mainnet RPC for the fork.
TAIKO_RPC="${TAIKO_RPC:-https://rpc.mainnet.taiko.xyz}"

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
require node
require npx
require curl
require jq

echo "[e2e-fork] building @heed/core (required for the runtime import)..."
npm --workspace @heed/core run build --silent

echo "[e2e-fork] starting anvil fork of Taiko mainnet at block $FORK_BLOCK on :$ANVIL_PORT..."
anvil \
  --port "$ANVIL_PORT" \
  --fork-url "$TAIKO_RPC" \
  --fork-block-number "$FORK_BLOCK" \
  --silent \
  >"$ANVIL_LOG" 2>&1 &
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
echo "[e2e-fork] anvil fork ready, chainId: $((CHAIN_ID_HEX)) (forked from Taiko mainnet #$FORK_BLOCK)"

echo "[e2e-fork] running protocol round-trip against deployed Heed at $HEED_ADDRESS..."
RPC_URL="$RPC_URL" \
  HEED_ADDRESS="$HEED_ADDRESS" \
  DEPLOYED_AT_BLOCK="$HEED_DEPLOY_BLOCK" \
  ALICE_PK="$ANVIL_PK_0" \
  BOB_PK="$ANVIL_PK_1" \
  npx --no-install tsx scripts/e2e/run-fork.ts

echo "[e2e-fork] OK"
