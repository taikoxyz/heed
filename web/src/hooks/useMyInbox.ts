import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { createReadClient, type InboxView } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";

export function useMyInbox() {
  const { address, chainId } = useAccount();
  const cfg = getEffectiveConfig(chainId);
  return useQuery<InboxView>({
    queryKey: ["myInbox", address, cfg.rpcUrl],
    enabled: !!address,
    queryFn: async () => {
      const client = createPublicClient({
        chain: cfg.chain,
        transport: http(cfg.rpcUrl),
      });
      return createReadClient(client, cfg.contractAddress).getInbox(address!);
    },
  });
}
