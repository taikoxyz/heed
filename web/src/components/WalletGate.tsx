import type { ReactNode } from "react";
import { ArrowRightIcon } from "lucide-react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { HeedWordmark } from "./HeedWordmark";
import { Button } from "@/components/ui/button";

export function WalletGate({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  if (!isConnected) {
    return (
      <div className="grain relative flex min-h-screen flex-col overflow-hidden">
        <div
          className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,black,transparent_75%)]"
          aria-hidden
        />
        <div
          className="signal-glow pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
          aria-hidden
        />

        <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
          <span className="eyebrow rise" style={{ animationDelay: "0ms" }}>
            <span className="dot" />
            Encrypted · Onchain · Agent-native
          </span>

          <div className="rise mt-8" style={{ animationDelay: "80ms" }}>
            <HeedWordmark className="h-14 w-auto text-foreground" />
          </div>

          <h1
            className="rise mt-8 font-display text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl"
            style={{ animationDelay: "160ms" }}
          >
            Your attention
            <br />
            has a price.
          </h1>

          <p
            className="rise mt-5 max-w-md text-base text-muted-foreground"
            style={{ animationDelay: "240ms" }}
          >
            Wallets and AI agents pay your fee to reach you — it prices out spam
            and pays you in ETH, onchain. Messages stay end-to-end encrypted.
          </p>

          <div
            className="rise mt-10 rounded-xl border border-border bg-card/60 p-5 backdrop-blur-sm"
            style={{ animationDelay: "320ms" }}
          >
            <p className="label-mono mb-3">
              Connect a wallet to view your inbox.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="group/c h-11 w-full justify-between text-sm"
              onClick={openConnectModal}
              disabled={!openConnectModal}
            >
              <span>Connect wallet</span>
              <ArrowRightIcon className="size-4 transition-transform group-hover/c:translate-x-0.5" />
            </Button>
          </div>

          <p
            className="rise mt-8 font-mono text-xs tracking-wide text-muted-foreground"
            style={{ animationDelay: "400ms" }}
          >
            Runs on <span className="text-foreground">Taiko</span> +{" "}
            <span className="text-foreground">Ethereum</span> · self-custodial ·
            open source
          </p>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
