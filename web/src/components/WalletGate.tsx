import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { clearKeys } from "../lib/keys";
import { HeedWordmark } from "./HeedWordmark";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WalletGate({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  function onDisconnect() {
    clearKeys();
    disconnect();
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="gap-3">
            <CardTitle>
              <HeedWordmark className="h-10 w-auto" />
            </CardTitle>
            <CardDescription className="text-base">
              Connect a wallet to view your inbox.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-1">
            {connectors.map((c) => (
              <Button
                key={c.uid}
                variant="outline"
                size="lg"
                onClick={() => connect({ connector: c })}
              >
                {c.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <HeedWordmark className="h-6 w-auto shrink-0" />
          <span className="font-mono text-sm text-muted-foreground truncate">
            {address}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <NetworkSwitcher />
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={onDisconnect}>
            Disconnect
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
}
