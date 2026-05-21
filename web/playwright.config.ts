import { defineConfig } from "@playwright/test";
import { CONTRACT, DEPLOYED_AT_BLOCK, IPFS_URL, RPC_URL } from "./e2e/harness";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_HEED_ADDRESS: CONTRACT,
      VITE_TAIKO_RPC: RPC_URL,
      VITE_IPFS_GATEWAY: IPFS_URL,
      VITE_DEPLOYED_AT_BLOCK: DEPLOYED_AT_BLOCK.toString(),
    },
  },
  use: {
    baseURL: "http://localhost:5173",
    // The app ships a strict connect-src CSP; bypass it so the browser may
    // reach the local mock RPC + IPFS gateway on 127.0.0.1.
    bypassCSP: true,
  },
});
