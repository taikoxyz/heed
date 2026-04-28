import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";

export function useInbox() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["inbox", address],
    enabled: !!address,
    queryFn: async () => {
      const cfg = getEffectiveConfig();
      const source = cfg.indexerUrl
        ? createIndexerMailSource(cfg.indexerUrl)
        : createRpcMailSource({
            client: createPublicClient({
              chain: taiko,
              transport: http(cfg.rpcUrl),
            }),
            contract: cfg.contractAddress,
            deployedAtBlock: cfg.deployedAtBlock,
          });
      return source.listInbox(address!, undefined, 100);
    },
  });
}
