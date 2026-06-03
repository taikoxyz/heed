import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";
import { getMessages, putMessages } from "../lib/db";

export function useInbox() {
  const { address } = useAccount();
  const cfg = getEffectiveConfig();
  const account = address?.toLowerCase();
  const [progress, setProgress] = useState(0);

  const cache = useQuery({
    queryKey: ["mailCache", "received", cfg.chainId, account],
    queryFn: () => getMessages(cfg.chainId, account!, "received"),
    enabled: !!address,
    staleTime: Infinity,
  });

  const query = useInfiniteQuery({
    queryKey: [
      "inbox",
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
      setProgress(0);
      const source = cfg.indexerUrl
        ? createIndexerMailSource(cfg.indexerUrl)
        : createRpcMailSource({
            client: createPublicClient({
              chain: taiko,
              transport: http(cfg.rpcUrl),
            }),
            contract: cfg.contractAddress,
            deployedAtBlock: cfg.deployedAtBlock,
            onProgress: setProgress,
          });
      const page = await source.listInboxPage(address!, {
        before: pageParam,
        limit: 100,
      });
      await putMessages(cfg.chainId, address!, "received", page.items).catch(
        () => {},
      );
      return page;
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  return { ...query, progress };
}
