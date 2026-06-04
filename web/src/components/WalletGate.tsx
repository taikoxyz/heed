import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { clearKeys } from "../lib/keys";
import { HeedWordmark } from "./HeedWordmark";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";

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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 38%, transparent 35%, var(--background) 100%)",
          }}
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-md border border-border bg-card p-10">
          <span className="eyebrow mb-8">
            <span className="dot" />
            Encrypted mail · onchain
          </span>
          <HeedWordmark className="mb-6 h-12 w-auto text-foreground" />
          <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
            Connect a wallet to view your inbox.
          </p>
          <div className="flex flex-col gap-2">
            {connectors.map((c) => (
              <Button
                key={c.uid}
                variant="outline"
                size="lg"
                className="w-full justify-between"
                onClick={() => connect({ connector: c })}
              >
                <span>{c.name}</span>
                <span aria-hidden>→</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-center justify-between gap-3 border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <HeedWordmark className="h-6 w-auto shrink-0 text-foreground" />
          <span
            className="hidden sm:inline-flex h-4 w-px bg-border"
            aria-hidden
          />
          <span className="font-mono text-xs text-muted-foreground truncate uppercase tracking-[0.08em]">
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
