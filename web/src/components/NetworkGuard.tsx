import { TriangleAlertIcon } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { taiko } from "wagmi/chains";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === taiko.id) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <TriangleAlertIcon />
      <AlertTitle>Wrong network</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>Heed runs on Taiko. Switch your wallet's network to continue.</span>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => switchChain({ chainId: taiko.id })}
        >
          {isPending ? "Switching…" : "Switch to Taiko"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
