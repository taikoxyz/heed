import { TriangleAlertIcon } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { DEFAULT_CHAIN_ID, NETWORKS, SUPPORTED_CHAIN_IDS } from "../lib/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (
    !isConnected ||
    (chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId))
  )
    return null;

  const fallback = NETWORKS[DEFAULT_CHAIN_ID]!;

  return (
    <Alert variant="destructive" className="mb-4">
      <TriangleAlertIcon />
      <AlertTitle>Unsupported network</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>
          Heed runs on Taiko and Ethereum. Switch your wallet to a supported
          network to continue.
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => switchChain({ chainId: fallback.chainId })}
        >
          {isPending ? "Switching…" : `Switch to ${fallback.label}`}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
