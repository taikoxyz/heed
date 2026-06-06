import { expect, type Page } from "@playwright/test";

export const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
// Taiko mainnet chain id 167000 == 0x28c58.
export const TAIKO_HEX = "0x28c58";

/**
 * Injects a minimal EIP-1193 provider on `window.ethereum` before the app
 * loads, so wagmi's injected connector can "connect" without a real wallet.
 * Read-only RPC still hits the network; these fixtures cover UI-shell flows
 * that don't depend on on-chain data.
 */
export async function injectWallet(
  page: Page,
  chainIdHex: string = TAIKO_HEX,
): Promise<void> {
  await page.addInitScript((chainId: string) => {
    const accounts = ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"];
    const provider = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case "eth_requestAccounts":
          case "eth_accounts":
            return accounts;
          case "eth_chainId":
            return chainId;
          case "net_version":
            return String(parseInt(chainId, 16));
          case "wallet_requestPermissions":
            return [{ parentCapability: "eth_accounts" }];
          case "wallet_getPermissions":
            return [];
          default:
            return null;
        }
      },
      on: () => {},
      removeListener: () => {},
    };
    (window as unknown as { ethereum: unknown }).ethereum = provider;
  }, chainIdHex);
}

/**
 * Loads the app. The injected stub reports an authorized account, so wagmi
 * reconnects it on mount and the connected shell renders without driving the
 * RainbowKit modal.
 */
export async function connect(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText(TEST_ADDRESS)).toBeVisible();
}
