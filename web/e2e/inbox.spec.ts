import { test, expect } from "@playwright/test";

// Skipped pending a wallet-stub fixture. The chain + IPFS halves of the harness
// now exist:
//
//   - Local: `scripts/e2e.sh` (anvil + forge create + IPFS stub)
//   - Fork:  `scripts/e2e-fork.sh` (anvil fork of Taiko mainnet, deployed Heed.sol)
//
// To enable this test:
//
//   1. Use `scripts/e2e-fork.sh` as a Playwright `globalSetup`: spin anvil fork,
//      publish keys, send alice → bob, capture { rpcUrl, contractAddress,
//      deployedAtBlock, gatewayUrl, bobPrivateKey }.
//   2. Inject captured values via VITE_HEED_ADDRESS / VITE_TAIKO_RPC /
//      VITE_DEPLOYED_AT_BLOCK / VITE_IPFS_GATEWAY in playwright.config.ts's
//      `webServer.env`.
//   3. Inject a window.ethereum stub backed by bob's anvil account before
//      `page.goto("/")`. The wagmi `injected` connector will pick it up.
//   4. Auto-sign the EIP-712 typed data prompt through the stub so the
//      in-browser X25519 derivation completes and the inbox renders.
//   5. Remove the test.skip below and uncomment the assertions.
//
// See docs/plans/2026-04-29-e2e-mainnet-fork.md for the full plan.
test.skip("inbox renders alice's envelope card after wallet connect", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Injected").click();
  await expect(page.getByText("ACME Alerts")).toBeVisible();
  await expect(page.getByText("deploy succeeded")).toBeVisible();
  await expect(page.getByRole("link", { name: /releases\/1234/ })).toBeVisible();
});
