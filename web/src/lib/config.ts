export const config = {
  contractAddress: import.meta.env.VITE_HEED_ADDRESS as `0x${string}`,
  rpcUrl: import.meta.env.VITE_TAIKO_RPC ?? "https://rpc.mainnet.taiko.xyz",
  ipfsGateway:
    import.meta.env.VITE_IPFS_GATEWAY ?? "https://gateway.pinata.cloud",
  indexerUrl: import.meta.env.VITE_INDEXER_URL as string | undefined,
  deployedAtBlock: BigInt(import.meta.env.VITE_DEPLOYED_AT_BLOCK ?? "0"),
  chainId: 167000,
};
