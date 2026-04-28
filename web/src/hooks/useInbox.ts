import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { config } from "../lib/config";

export function useInbox() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["inbox", address],
    enabled: !!address,
    queryFn: async () => {
      const source = config.indexerUrl
        ? createIndexerMailSource(config.indexerUrl)
        : createRpcMailSource({
            client: createPublicClient({
              chain: taiko,
              transport: http(config.rpcUrl),
            }),
            contract: config.contractAddress,
            deployedAtBlock: config.deployedAtBlock,
          });
      return source.listInbox(address!, undefined, 100);
    },
  });
}
