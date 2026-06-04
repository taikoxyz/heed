import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { clearKeys } from "../lib/keys";
import { HeedMark } from "./HeedMark";
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
            <CardTitle className="flex items-center gap-3 font-heading text-5xl font-semibold tracking-tighter leading-none">
              <HeedMark className="h-10 w-10 shrink-0" />
              <span>
                Heed<span className="text-primary">.</span>
              </span>
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
          <HeedMark className="h-6 w-6 shrink-0" />
          <span className="font-heading text-2xl font-semibold tracking-tighter leading-none">
            Heed<span className="text-primary">.</span>
          </span>
          <span className="font-mono text-sm text-muted-foreground truncate">
            {address}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
