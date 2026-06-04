import { useAccount, useSwitchChain } from "wagmi";
import { NETWORKS, SUPPORTED_CHAIN_IDS, SUPPORTED_CHAINS } from "../lib/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function NetworkSwitcher() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return null;

  const onSupported =
    chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId);

  return (
    <Select
      value={onSupported ? String(chainId) : ""}
      onValueChange={(v) => switchChain({ chainId: Number(v) })}
      disabled={isPending}
    >
      <SelectTrigger size="sm" className="w-[116px]">
        <SelectValue placeholder="Network" />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CHAINS.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {NETWORKS[c.id]!.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
