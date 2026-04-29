import { test, expect } from "@playwright/test";

// Skipped pending a wallet-stub fixture. The chain + IPFS halves of the harness
// now exist in `scripts/e2e.sh` (anvil + forge create + IPFS stub + protocol
// round-trip via @heed/core). To enable this test:
//
//   1. Reuse `scripts/e2e.sh` as a Playwright `globalSetup`: spin anvil, deploy
//      Heed, set bob's fee, send alice → bob, capture { rpcUrl, contractAddress,
//      deployedAtBlock, gatewayUrl, bobPrivateKey }.
//   2. Inject those values via VITE_HEED_ADDRESS / VITE_TAIKO_RPC /
//      VITE_DEPLOYED_AT_BLOCK / VITE_IPFS_GATEWAY when starting `npm run dev`
//      (extend playwright.config.ts's `webServer.env`).
//   3. Inject a window.ethereum stub backed by bob's anvil account before
//      `page.goto("/")`. The wagmi `injected` connector will pick it up; the
//      "Injected" button visible in the UI corresponds to that connector.
//   4. Sign the EIP-712 typed data prompt programmatically through the stub so
//      the in-browser X25519 derivation completes and the inbox renders.
//   5. Remove the test.skip below and uncomment the assertions.
test.skip("inbox renders alice's envelope card after wallet connect", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Injected").click();
  await expect(page.getByText("ACME Alerts")).toBeVisible();
  await expect(page.getByText("deploy succeeded")).toBeVisible();
  await expect(page.getByRole("link", { name: /releases\/1234/ })).toBeVisible();
});
