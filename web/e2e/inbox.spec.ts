import { test, expect } from "@playwright/test";

// Skipped pending an anvil fixture harness.
//
// To enable this test:
//   1. Start anvil with a Taiko mainnet fork:
//        anvil --fork-url $TAIKO_MAINNET_RPC
//   2. Deploy Heed to the fork and capture the address:
//        forge script ../contracts/script/Deploy.s.sol \
//          --rpc-url anvil --broadcast --private-key $ANVIL_PRIVATE_KEY
//   3. Publish a recipient X25519 pubkey via Heed.publishKey, then send a
//      MAIL transaction whose contentRef points at a pre-pinned IPFS object.
//   4. Replace VITE_HEED_ADDRESS / VITE_TAIKO_RPC for the dev server and
//      inject a window.ethereum stub backed by the recipient anvil account.
//   5. Remove the test.skip below.
test.skip("inbox loads after wallet connect (mocked)", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Injected").click();
  await expect(page.getByText(/from /).first()).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();
});
