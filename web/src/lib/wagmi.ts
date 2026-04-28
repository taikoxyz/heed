import { http, createConfig } from "wagmi";
import { taiko } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { config as appConfig } from "./config";

const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID as string | undefined;

export const wagmiConfig = createConfig({
  chains: [taiko],
  transports: { [taiko.id]: http(appConfig.rpcUrl) },
  connectors: [
    injected(),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
  ],
});
