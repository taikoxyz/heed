import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";

export function useOutbox() {
  const { address } = useAccount();
  const cfg = getEffectiveConfig();
  return useQuery({
    queryKey: [
      "outbox",
      address,
      cfg.rpcUrl,
      cfg.indexerUrl ?? "",
      cfg.deployedAtBlock.toString(),
    ],
    enabled: !!address,
    queryFn: async () => {
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
      return source.listOutbox(address!, undefined, 100);
    },
  });
}
