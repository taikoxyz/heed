import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "../src/lib/wagmi";
import { WalletGate } from "../src/components/WalletGate";

describe("WalletGate", () => {
  it("hides children and renders connector buttons when not connected", () => {
    render(
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <WalletGate>
            <div>secret</div>
          </WalletGate>
        </QueryClientProvider>
      </WagmiProvider>,
    );

    expect(screen.queryByText("secret")).toBeNull();
    expect(screen.getByText("Heed")).toBeTruthy();
  });
});
