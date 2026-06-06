import { http, createConfig } from "wagmi";
import { mainnet, taiko } from "wagmi/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { NETWORKS } from "./config";

// WalletConnect Cloud project id. Required for WalletConnect and mobile wallets;
// injected/browser-extension wallets work without it. Get one free at
// https://cloud.walletconnect.com.
const wcProjectId = (import.meta.env.VITE_WC_PROJECT_ID as string) || "";

// WalletConnect-backed wallets throw without a project id, so include them only
// when one is configured. Injected, Coinbase, and Safe work either way, and
// wagmi's EIP-6963 discovery still surfaces installed extension wallets.
const wcWallets = wcProjectId
  ? [metaMaskWallet, rainbowWallet, walletConnectWallet]
  : [];

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: [injectedWallet, coinbaseWallet, ...wcWallets, safeWallet],
    },
  ],
  { appName: "Heed", projectId: wcProjectId },
);

export const wagmiConfig = createConfig({
  chains: [taiko, mainnet],
  transports: {
    [taiko.id]: http(NETWORKS[taiko.id]!.rpcUrl),
    [mainnet.id]: http(NETWORKS[mainnet.id]!.rpcUrl),
  },
  connectors,
});
