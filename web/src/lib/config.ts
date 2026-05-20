export const config = {
  contractAddress: (import.meta.env.VITE_HEED_ADDRESS ??
    "0x08f32278B2CFD962444ae9541122eD84cc745678") as `0x${string}`,
  rpcUrl: import.meta.env.VITE_TAIKO_RPC ?? "https://rpc.mainnet.taiko.xyz",
  ipfsGateway:
    import.meta.env.VITE_IPFS_GATEWAY ?? "https://gateway.pinata.cloud",
  indexerUrl: import.meta.env.VITE_INDEXER_URL as string | undefined,
  deployedAtBlock: BigInt(import.meta.env.VITE_DEPLOYED_AT_BLOCK ?? "6091023"),
  chainId: 167000,
};
