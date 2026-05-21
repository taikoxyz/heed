import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";
import { getMessages, putMessages } from "../lib/db";

export function useOutbox(limit = 50) {
  const { address } = useAccount();
  const cfg = getEffectiveConfig();
  const account = address?.toLowerCase();

  const cache = useQuery({
    queryKey: ["mailCache", "sent", cfg.chainId, account],
    queryFn: () => getMessages(cfg.chainId, account!, "sent"),
    enabled: !!address,
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: [
      "outbox",
      address,
      cfg.rpcUrl,
      cfg.indexerUrl ?? "",
      cfg.deployedAtBlock.toString(),
      limit,
    ],
    enabled: !!address,
    placeholderData: () => cache.data,
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
      const result = await source.listOutbox(address!, undefined, limit);
      await putMessages(cfg.chainId, address!, "sent", result).catch(() => {});
      return result;
    },
  });
}
