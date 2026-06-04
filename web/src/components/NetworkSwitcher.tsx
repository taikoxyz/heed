import { useAccount, useSwitchChain } from "wagmi";
import { Select } from "@mantine/core";
import { NETWORKS, SUPPORTED_CHAIN_IDS, SUPPORTED_CHAINS } from "../lib/config";

export function NetworkSwitcher() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return null;

  const onSupported =
    chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId);

  return (
    <Select
      value={onSupported ? String(chainId) : null}
      onChange={(v) => v && switchChain({ chainId: Number(v) })}
      disabled={isPending}
      placeholder="Network"
      data={SUPPORTED_CHAINS.map((c) => ({
        value: String(c.id),
        label: NETWORKS[c.id]!.label,
      }))}
      size="sm"
      w={130}
      allowDeselect={false}
    />
  );
}
