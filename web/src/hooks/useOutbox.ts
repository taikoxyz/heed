import { useInfiniteQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";

export function useOutbox() {
  const { address } = useAccount();
  const cfg = getEffectiveConfig();
  return useInfiniteQuery({
    queryKey: [
      "outbox",
      address,
      cfg.rpcUrl,
      cfg.indexerUrl ?? "",
      cfg.deployedAtBlock.toString(),
    ],
    enabled: !!address,
    initialPageParam: undefined as bigint | undefined,
    queryFn: async ({ pageParam }) => {
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
      return source.listOutboxPage(address!, { before: pageParam, limit: 100 });
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}
