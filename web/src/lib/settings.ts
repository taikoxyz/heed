import type { Chain } from "viem";
import {
  config,
  DEFAULT_CHAIN_ID,
  getNetwork,
  parseGateways,
  SUPPORTED_CHAIN_IDS,
} from "./config";

export interface NetworkSettings {
  /** RPC URL override; empty falls back to the registry default. */
  rpcUrl: string;
  /** Indexer URL override; empty falls back to env, then RPC log scan. */
  indexerUrl: string;
  /** Max anti-spam fee in gwei. 0 means no cap. */
  maxFeeGwei: number;
}

export interface Settings {
  /** Per-chain network overrides keyed by chainId. */
  networks: Record<number, NetworkSettings>;
  /** Comma-separated IPFS gateway list (content-addressed, chain-independent). */
  ipfsGateway: string;
  /** Pinata JWT for pinning encrypted mail (chain-independent). */
  pinataJwt: string;
}

const KEY = "heed:settings";

export function emptyNetwork(): NetworkSettings {
  return { rpcUrl: "", indexerUrl: "", maxFeeGwei: 0 };
}

function emptyNetworks(): Record<number, NetworkSettings> {
  const out: Record<number, NetworkSettings> = {};
  for (const id of SUPPORTED_CHAIN_IDS) out[id] = emptyNetwork();
  return out;
}

export const EMPTY_SETTINGS: Settings = {
  networks: emptyNetworks(),
  ipfsGateway: "",
  pinataJwt: "",
};

// Accepts either the new shape ({ networks: {...} }) or the legacy flat shape
// ({ rpcUrl, indexerUrl, maxFeeGwei, ipfsGateway, pinataJwt }) so existing
// localStorage data and old backup zips keep working after the schema change.
function normalize(parsed: Record<string, unknown>): Settings {
  const networks = emptyNetworks();
  const rawNetworks = parsed.networks as
    | Record<string, Partial<NetworkSettings>>
    | undefined;
  if (rawNetworks) {
    for (const id of SUPPORTED_CHAIN_IDS) {
      const n = rawNetworks[String(id)] ?? rawNetworks[id as unknown as string];
      if (n) {
        networks[id] = {
          rpcUrl: n.rpcUrl ?? "",
          indexerUrl: n.indexerUrl ?? "",
          maxFeeGwei: Number(n.maxFeeGwei ?? 0),
        };
      }
    }
  } else {
    // Legacy flat shape — apply to the default chain so existing Taiko
    // overrides survive the migration.
    networks[DEFAULT_CHAIN_ID] = {
      rpcUrl: (parsed.rpcUrl as string) ?? "",
      indexerUrl: (parsed.indexerUrl as string) ?? "",
      maxFeeGwei: Number(parsed.maxFeeGwei ?? 0),
    };
  }
  return {
    networks,
    ipfsGateway: (parsed.ipfsGateway as string) ?? "",
    pinataJwt: (parsed.pinataJwt as string) ?? "",
  };
}

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_SETTINGS, networks: emptyNetworks() };
    return normalize(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return { ...EMPTY_SETTINGS, networks: emptyNetworks() };
  }
}

export function saveSettings(s: Settings): void {
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSettings(): void {
  window.localStorage.removeItem(KEY);
}

export interface EffectiveConfig {
  chain: Chain;
  label: string;
  contractAddress: `0x${string}`;
  chainId: number;
  deployedAtBlock: bigint;
  rpcUrl: string;
  explorer: string;
  ipfsGateways: string[];
  indexerUrl: string | undefined;
  maxFeeGwei: number;
  pinataJwt: string;
}

// Resolves the effective config for the active network. RPC and indexer
// overrides are per-chain so each network can use its own endpoints; IPFS
// gateways and the Pinata JWT remain global.
export function getEffectiveConfig(chainId?: number): EffectiveConfig {
  const s = loadSettings();
  const net = getNetwork(chainId);
  const overrides = s.networks[net.chainId] ?? emptyNetwork();
  return {
    chain: net.chain,
    label: net.label,
    contractAddress: net.contractAddress,
    chainId: net.chainId,
    deployedAtBlock: net.deployedAtBlock,
    rpcUrl: overrides.rpcUrl || net.rpcUrl,
    explorer: net.explorer,
    ipfsGateways: s.ipfsGateway
      ? parseGateways(s.ipfsGateway)
      : config.ipfsGateways,
    indexerUrl: overrides.indexerUrl || config.indexerUrl,
    maxFeeGwei: overrides.maxFeeGwei,
    pinataJwt: s.pinataJwt,
  };
}
