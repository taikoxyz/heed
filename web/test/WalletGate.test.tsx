import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "../src/lib/wagmi";
import { WalletGate } from "../src/components/WalletGate";

describe("WalletGate", () => {
  it("hides children and renders the connect button when not connected", () => {
    render(
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={new QueryClient()}>
          <RainbowKitProvider>
            <WalletGate>
              <div>secret</div>
            </WalletGate>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>,
    );

    expect(screen.queryByText("secret")).toBeNull();
    expect(screen.getByRole("img", { name: "Heed." })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /connect wallet/i }),
    ).toBeTruthy();
  });
});
