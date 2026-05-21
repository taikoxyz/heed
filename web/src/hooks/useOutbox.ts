import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";
import { getMessages, putMessages } from "../lib/db";

export function useOutbox() {
  const { address } = useAccount();
  const cfg = getEffectiveConfig();
  const account = address?.toLowerCase();

  const cache = useQuery({
    queryKey: ["mailCache", "sent", cfg.chainId, account],
    queryFn: () => getMessages(cfg.chainId, account!, "sent"),
    enabled: !!address,
    staleTime: Infinity,
  });

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
    placeholderData:
      cache.data && cache.data.length
        ? {
            pages: [{ items: cache.data }],
            pageParams: [undefined as bigint | undefined],
          }
        : undefined,
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
      const page = await source.listOutboxPage(address!, {
        before: pageParam,
        limit: 100,
      });
      await putMessages(cfg.chainId, address!, "sent", page.items).catch(
        () => {},
      );
      return page;
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}
