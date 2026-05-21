import { config, parseGateways } from "./config";

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
  contractAddress: `0x${string}`;
  chainId: number;
  deployedAtBlock: bigint;
  rpcUrl: string;
  ipfsGateways: string[];
  indexerUrl: string | undefined;
  maxFeeGwei: number;
  pinataJwt: string;
}

export function getEffectiveConfig(): EffectiveConfig {
  const s = loadSettings();
  return {
    contractAddress: config.contractAddress,
    chainId: config.chainId,
    deployedAtBlock: config.deployedAtBlock,
    rpcUrl: s.rpcUrl || config.rpcUrl,
    ipfsGateways: s.ipfsGateway
      ? parseGateways(s.ipfsGateway)
      : config.ipfsGateways,
    indexerUrl: s.indexerUrl || config.indexerUrl,
    maxFeeGwei: s.maxFeeGwei,
    pinataJwt: s.pinataJwt,
  };
}
