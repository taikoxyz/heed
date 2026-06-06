import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
  type Theme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "../lib/wagmi";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Tint the connect modal with Heed's signal accent so it matches the shell.
const rainbowKitTheme = {
  accentColor: "oklch(0.82 0.135 80)",
  accentColorForeground: "oklch(0.21 0.04 70)",
  borderRadius: "medium",
  overlayBlur: "small",
} as const;

export function WalletProviders({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const theme: Theme =
    resolvedTheme === "light"
      ? lightTheme(rainbowKitTheme)
      : darkTheme(rainbowKitTheme);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} appInfo={{ appName: "Heed" }}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
