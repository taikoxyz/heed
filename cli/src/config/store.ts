import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Address } from "viem";

// Heed is deployed at the same address on every chain (CREATE2).
export const HEED_MAINNET_CHAIN_ID = 167000;
export const HEED_MAINNET_CONTRACT: Address =
  "0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A";
export const HEED_DEFAULT_GATEWAY = "https://gateway.pinata.cloud";
export const HEED_DEPLOYED_AT_BLOCK = 7500287n;

export const HEED_ETHEREUM_CHAIN_ID = 1;
export const HEED_ETHEREUM_DEPLOYED_AT_BLOCK = 25240881n;

export interface HeedConfig {
  network: {
    chain_id: number;
    rpc_url: string;
    contract: Address;
    gateway: string;
    deployed_at_block: number;
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
  "network.gateway",
  "network.deployed_at_block",
  "identity.name",
  "identity.owner_url",
  "identity.logo_cid",
  "identity.uri",
  "key_nonce",
] as const;

export type AllowedKey = (typeof ALLOWED_KEYS)[number];

export function defaultConfig(): HeedConfig {
  return {
    network: {
      chain_id: HEED_MAINNET_CHAIN_ID,
      rpc_url: "",
      contract: HEED_MAINNET_CONTRACT,
      gateway: HEED_DEFAULT_GATEWAY,
      deployed_at_block: Number(HEED_DEPLOYED_AT_BLOCK),
    },
    identity: { name: "", owner_url: "" },
    key_nonce: 0,
  };
}

export interface NetworkPreset {
  label: string;
  chain_id: number;
  rpc_url: string;
  contract: Address;
  deployed_at_block: number;
}

export const NETWORK_PRESETS: Record<string, NetworkPreset> = {
  taiko: {
    label: "Taiko Mainnet",
    chain_id: HEED_MAINNET_CHAIN_ID,
    rpc_url: "https://rpc.mainnet.taiko.xyz",
    contract: HEED_MAINNET_CONTRACT,
    deployed_at_block: Number(HEED_DEPLOYED_AT_BLOCK),
  },
  ethereum: {
    label: "Ethereum Mainnet",
    chain_id: HEED_ETHEREUM_CHAIN_ID,
    rpc_url: "https://ethereum-rpc.publicnode.com",
    contract: HEED_MAINNET_CONTRACT,
    deployed_at_block: Number(HEED_ETHEREUM_DEPLOYED_AT_BLOCK),
  },
};

export const NETWORK_NAMES = Object.keys(NETWORK_PRESETS);

// Applies a network preset, swapping the whole network block (chain, RPC,
// contract, block) while preserving identity. RPC stays overridable afterward.
export function applyNetworkPreset(
  config: HeedConfig,
  name: string,
): HeedConfig {
  const preset = NETWORK_PRESETS[name];
  if (!preset) {
    throw new Error(
      `unknown network "${name}". available: ${NETWORK_NAMES.join(", ")}`,
    );
  }
  return {
    ...config,
    network: {
      ...config.network,
      chain_id: preset.chain_id,
      rpc_url: preset.rpc_url,
      contract: preset.contract,
      deployed_at_block: preset.deployed_at_block,
    },
  };
}

export async function readConfig(file: string): Promise<HeedConfig> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<HeedConfig>;
    return mergeWithDefaults(parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT")
      return defaultConfig();
    throw err;
  }
}

export async function writeConfig(
  file: string,
  config: HeedConfig,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function getValue(
  config: HeedConfig,
  key: AllowedKey,
): string | number | undefined {
  switch (key) {
    case "network.chain_id":
      return config.network.chain_id;
    case "network.rpc_url":
      return config.network.rpc_url;
    case "network.contract":
      return config.network.contract;
    case "network.gateway":
      return config.network.gateway;
    case "network.deployed_at_block":
      return config.network.deployed_at_block;
    case "identity.name":
      return config.identity.name;
    case "identity.owner_url":
      return config.identity.owner_url;
    case "identity.logo_cid":
      return config.identity.logo_cid;
    case "identity.uri":
      return config.identity.uri;
    case "key_nonce":
      return config.key_nonce;
  }
}

export function setValue(
  config: HeedConfig,
  key: AllowedKey,
  value: string,
): HeedConfig {
  switch (key) {
    case "network.chain_id":
      return {
        ...config,
        network: { ...config.network, chain_id: parseIntStrict(value, key) },
      };
    case "network.rpc_url":
      return { ...config, network: { ...config.network, rpc_url: value } };
    case "network.contract":
      return {
        ...config,
        network: { ...config.network, contract: parseAddress(value) },
      };
    case "network.gateway":
      return { ...config, network: { ...config.network, gateway: value } };
    case "network.deployed_at_block":
      return {
        ...config,
        network: {
          ...config.network,
          deployed_at_block: parseIntStrict(value, key),
        },
      };
    case "identity.name":
      return { ...config, identity: { ...config.identity, name: value } };
    case "identity.owner_url":
      return { ...config, identity: { ...config.identity, owner_url: value } };
    case "identity.logo_cid":
      return { ...config, identity: { ...config.identity, logo_cid: value } };
    case "identity.uri":
      return { ...config, identity: { ...config.identity, uri: value } };
    case "key_nonce":
      return { ...config, key_nonce: parseIntStrict(value, key) };
  }
}

export function isAllowedKey(value: string): value is AllowedKey {
  return (ALLOWED_KEYS as readonly string[]).includes(value);
}

function parseIntStrict(value: string, key: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`${key} must be a non-negative integer`);
  return n;
}

function parseAddress(value: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value))
    throw new Error("contract must be a 40-char hex address");
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
