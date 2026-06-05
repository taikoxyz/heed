import { useAccount, useSwitchChain } from "wagmi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NETWORKS, SUPPORTED_CHAIN_IDS, SUPPORTED_CHAINS } from "../lib/config";

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
      <SelectTrigger size="sm" className="w-[118px] font-mono text-xs">
        <SelectValue placeholder="Network" />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CHAINS.map((c) => (
          <SelectItem key={c.id} value={String(c.id)} className="font-mono">
            {NETWORKS[c.id]!.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
