import { useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";
import { getMessages, putMessages } from "../lib/db";
import { setProgress, useProgress } from "../lib/progressStore";

export function useOutbox() {
  const { address, chainId } = useAccount();
  const cfg = getEffectiveConfig(chainId);
  const account = address?.toLowerCase();
  // Progress lives in a module-level store keyed by the query so a queryFn
  // started before a tab switch keeps updating whichever observer is mounted
  // when it fires its next progress callback.
  const progressKey = `outbox:${cfg.chainId}:${account ?? ""}:${cfg.rpcUrl}:${cfg.indexerUrl ?? ""}`;
  const progress = useProgress(progressKey);
  // Ignore progress callbacks from prior queryFn invocations (e.g. after the
  // address changes mid-scan) so they don't overwrite the new scan's value.
  const fetchId = useRef(0);

  const cache = useQuery({
    queryKey: ["mailCache", "sent", cfg.chainId, account],
    queryFn: () => getMessages(cfg.chainId, account!, "sent"),
    enabled: !!address,
    staleTime: Infinity,
  });

  const query = useInfiniteQuery({
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
      const id = ++fetchId.current;
      const report = (f: number) => {
        if (id === fetchId.current) setProgress(progressKey, f);
      };
      report(0);
      const source = cfg.indexerUrl
        ? createIndexerMailSource(cfg.indexerUrl)
        : createRpcMailSource({
            client: createPublicClient({
              chain: cfg.chain,
              transport: http(cfg.rpcUrl),
            }),
            contract: cfg.contractAddress,
            deployedAtBlock: cfg.deployedAtBlock,
            onProgress: report,
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

  return { ...query, progress };
}
