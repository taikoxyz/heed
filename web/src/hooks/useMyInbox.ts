import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { taiko } from "viem/chains";
import { createReadClient, type InboxView } from "@heed/core";
import { getEffectiveConfig } from "../lib/settings";

export function useMyInbox() {
  const { address } = useAccount();
  const cfg = getEffectiveConfig();
  return useQuery<InboxView>({
    queryKey: ["myInbox", address, cfg.rpcUrl],
    enabled: !!address,
    queryFn: async () => {
      const client = createPublicClient({
        chain: taiko,
        transport: http(cfg.rpcUrl),
      });
      return createReadClient(client, cfg.contractAddress).getInbox(address!);
    },
  });
}
