import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Address } from "viem";

export const HEED_MAINNET_CHAIN_ID = 167000;
export const HEED_MAINNET_CONTRACT: Address = "0x08f32278B2CFD962444ae9541122eD84cc745678";

export interface HeedConfig {
  network: {
    chain_id: number;
    rpc_url: string;
    contract: Address;
  };
  identity: {
    name: string;
    owner_url: string;
    logo_cid?: string;
    uri?: string;
  };
  key_nonce: number;
}

export const ALLOWED_KEYS = [
  "network.chain_id",
  "network.rpc_url",
  "network.contract",
  "identity.name",
  "identity.owner_url",
  "identity.logo_cid",
  "identity.uri",
  "key_nonce",
] as const;

export type AllowedKey = (typeof ALLOWED_KEYS)[number];

export function defaultConfig(): HeedConfig {
  return {
    network: { chain_id: HEED_MAINNET_CHAIN_ID, rpc_url: "", contract: HEED_MAINNET_CONTRACT },
    identity: { name: "", owner_url: "" },
    key_nonce: 0,
  };
}

export async function readConfig(file: string): Promise<HeedConfig> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<HeedConfig>;
    return mergeWithDefaults(parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return defaultConfig();
    throw err;
  }
}

export async function writeConfig(file: string, config: HeedConfig): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

export function getValue(config: HeedConfig, key: AllowedKey): string | number | undefined {
  switch (key) {
    case "network.chain_id": return config.network.chain_id;
    case "network.rpc_url": return config.network.rpc_url;
    case "network.contract": return config.network.contract;
    case "identity.name": return config.identity.name;
    case "identity.owner_url": return config.identity.owner_url;
    case "identity.logo_cid": return config.identity.logo_cid;
    case "identity.uri": return config.identity.uri;
    case "key_nonce": return config.key_nonce;
  }
}

export function setValue(config: HeedConfig, key: AllowedKey, value: string): HeedConfig {
  switch (key) {
    case "network.chain_id": return { ...config, network: { ...config.network, chain_id: parseIntStrict(value, key) } };
    case "network.rpc_url": return { ...config, network: { ...config.network, rpc_url: value } };
    case "network.contract": return { ...config, network: { ...config.network, contract: parseAddress(value) } };
    case "identity.name": return { ...config, identity: { ...config.identity, name: value } };
    case "identity.owner_url": return { ...config, identity: { ...config.identity, owner_url: value } };
    case "identity.logo_cid": return { ...config, identity: { ...config.identity, logo_cid: value } };
    case "identity.uri": return { ...config, identity: { ...config.identity, uri: value } };
    case "key_nonce": return { ...config, key_nonce: parseIntStrict(value, key) };
  }
}

export function isAllowedKey(value: string): value is AllowedKey {
  return (ALLOWED_KEYS as readonly string[]).includes(value);
}

function parseIntStrict(value: string, key: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${key} must be a non-negative integer`);
  return n;
}

function parseAddress(value: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error("contract must be a 40-char hex address");
  return value as Address;
}

function mergeWithDefaults(partial: Partial<HeedConfig>): HeedConfig {
  const d = defaultConfig();
  return {
    network: { ...d.network, ...(partial.network ?? {}) },
    identity: { ...d.identity, ...(partial.identity ?? {}) },
    key_nonce: partial.key_nonce ?? d.key_nonce,
  };
}
