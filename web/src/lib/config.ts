import type { Chain } from "viem";
import { mainnet, taiko } from "viem/chains";

export function parseGateways(value: string): string[] {
  return value
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
}

// Heed is deployed at the same address on every chain (CREATE2).
const HEED_CONTRACT = (import.meta.env.VITE_HEED_ADDRESS ??
  "0x030126A6ef84B4BCdCc0797a6B06C1F06655E41A") as `0x${string}`;

export interface NetworkConfig {
  chain: Chain;
  chainId: number;
  label: string;
  contractAddress: `0x${string}`;
  rpcUrl: string;
  deployedAtBlock: bigint;
  explorer: string;
}

export const NETWORKS: Record<number, NetworkConfig> = {
  [taiko.id]: {
    chain: taiko,
    chainId: taiko.id,
    label: "Taiko",
    contractAddress: HEED_CONTRACT,
    rpcUrl: import.meta.env.VITE_TAIKO_RPC ?? "https://rpc.mainnet.taiko.xyz",
    deployedAtBlock: BigInt(
      import.meta.env.VITE_DEPLOYED_AT_BLOCK ?? "7500287",
    ),
    explorer: "https://taikoscan.io",
  },
  [mainnet.id]: {
    chain: mainnet,
    chainId: mainnet.id,
    label: "Ethereum",
    contractAddress: HEED_CONTRACT,
    rpcUrl:
      import.meta.env.VITE_ETH_RPC ?? "https://ethereum-rpc.publicnode.com",
    deployedAtBlock: BigInt(
      import.meta.env.VITE_ETH_DEPLOYED_AT_BLOCK ?? "25240881",
    ),
    explorer: "https://etherscan.io",
  },
};

export const SUPPORTED_CHAINS = [taiko, mainnet] as const;
export const SUPPORTED_CHAIN_IDS: number[] = SUPPORTED_CHAINS.map((c) => c.id);
export const DEFAULT_CHAIN_ID = taiko.id;

export function getNetwork(chainId: number | undefined): NetworkConfig {
  return (
    (chainId !== undefined ? NETWORKS[chainId] : undefined) ??
    NETWORKS[DEFAULT_CHAIN_ID]!
  );
}

// Chain-independent config shared across networks.
export const config = {
  ipfsGateways: parseGateways(
    import.meta.env.VITE_IPFS_GATEWAY ?? "https://gateway.pinata.cloud",
  ),
  indexerUrl: import.meta.env.VITE_INDEXER_URL as string | undefined,
};
