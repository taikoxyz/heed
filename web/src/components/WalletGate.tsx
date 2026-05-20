import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { clearKeys } from "../lib/keys";
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
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Heed</CardTitle>
            <CardDescription>
              Connect a wallet to view your inbox.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {connectors.map((c) => (
              <Button
                key={c.uid}
                variant="outline"
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
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="font-mono text-sm text-muted-foreground">
          {address}
        </span>
        <div className="flex items-center gap-1">
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
