import type { Chain } from "viem";
import { config, DEFAULT_CHAIN_ID, getNetwork, parseGateways } from "./config";

export interface Settings {
  rpcUrl: string;
  ipfsGateway: string;
  indexerUrl: string;
  maxFeeGwei: number;
  pinataJwt: string;
}

const KEY = "heed:settings";

export const EMPTY_SETTINGS: Settings = {
  rpcUrl: "",
  ipfsGateway: "",
  indexerUrl: "",
  maxFeeGwei: 0,
  pinataJwt: "",
};

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      rpcUrl: parsed.rpcUrl ?? "",
      ipfsGateway: parsed.ipfsGateway ?? "",
      indexerUrl: parsed.indexerUrl ?? "",
      maxFeeGwei: Number(parsed.maxFeeGwei ?? 0),
      pinataJwt: parsed.pinataJwt ?? "",
    };
  } catch {
    return EMPTY_SETTINGS;
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

// Resolves the effective config for the active network. The Settings RPC
// override applies to the default (Taiko) network so a saved override can't
// misroute a different chain's calls; other chains use their registry RPC.
export function getEffectiveConfig(chainId?: number): EffectiveConfig {
  const s = loadSettings();
  const net = getNetwork(chainId);
  return {
    chain: net.chain,
    label: net.label,
    contractAddress: net.contractAddress,
    chainId: net.chainId,
    deployedAtBlock: net.deployedAtBlock,
    rpcUrl:
      net.chainId === DEFAULT_CHAIN_ID ? s.rpcUrl || net.rpcUrl : net.rpcUrl,
    explorer: net.explorer,
    ipfsGateways: s.ipfsGateway
      ? parseGateways(s.ipfsGateway)
      : config.ipfsGateways,
    indexerUrl: s.indexerUrl || config.indexerUrl,
    maxFeeGwei: s.maxFeeGwei,
    pinataJwt: s.pinataJwt,
  };
}
