import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createRpcMailSource, createIndexerMailSource } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";
import { getMessages, putMessages } from "../lib/db";

export function useInbox(limit = 50) {
  const { address } = useAccount();
  const cfg = getEffectiveConfig();
  const account = address?.toLowerCase();

  const cache = useQuery({
    queryKey: ["mailCache", "received", cfg.chainId, account],
    queryFn: () => getMessages(cfg.chainId, account!, "received"),
    enabled: !!address,
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: [
      "inbox",
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
      const result = await source.listInbox(address!, undefined, limit);
      await putMessages(cfg.chainId, address!, "received", result).catch(
        () => {},
      );
      return result;
    },
  });
}
