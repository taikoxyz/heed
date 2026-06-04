import { http, createConfig } from "wagmi";
import { mainnet, taiko } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { NETWORKS } from "./config";

const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID as string | undefined;

export const wagmiConfig = createConfig({
  chains: [taiko, mainnet],
  transports: {
    [taiko.id]: http(NETWORKS[taiko.id]!.rpcUrl),
    [mainnet.id]: http(NETWORKS[mainnet.id]!.rpcUrl),
  },
  connectors: [
    injected(),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
  ],
});
