import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { STATE_FILE } from "./global-setup";
import { walletStubInit, type WalletStubData } from "./wallet-stub";

interface State {
  recipient: string;
  sender: string;
  matchTitle: string;
  matchBody: string;
  matchActionUrl: string;
  mismatchTitle: string;
  mismatchBody: string;
  wallet: WalletStubData;
}

const state: State = JSON.parse(readFileSync(STATE_FILE, "utf8"));

async function connectAndOpenAll(page: Page): Promise<void> {
  await page.addInitScript(walletStubInit(state.wallet));
  await page.goto("/");
  // The wallet gate renders one button per connector; click the first.
  await page.getByText("Connect a wallet to view your inbox.").waitFor();
  await page.locator("button").first().click();
  await expect(page.getByText(state.recipient)).toBeVisible();

  // Opening a card replaces its "Open" button with the decrypted content, so
  // repeatedly click the first remaining one until none are left. Wait for the
  // inbox query to populate the list before counting.
  const openButtons = page.getByRole("button", { name: "Open" });
  await expect(openButtons.first()).toBeVisible();
  for (let remaining = await openButtons.count(); remaining > 0; remaining--) {
    await openButtons.first().click();
    await expect(openButtons).toHaveCount(remaining - 1);
  }
}

test("decrypts the seeded envelope and shows a matching signer badge", async ({
  page,
}) => {
  await connectAndOpenAll(page);

  await expect(page.getByText(state.matchTitle)).toBeVisible();
  await expect(page.getByText(state.matchBody)).toBeVisible();
  await expect(page.getByText("ACME Alerts")).toBeVisible();
  await expect(
    page.locator(`a[href="${state.matchActionUrl}"]`),
  ).toBeVisible();
  await expect(
    page.getByText("signature matches sender", { exact: false }),
  ).toBeVisible();
});

test("flags the spoofed envelope with a signer mismatch warning", async ({
  page,
}) => {
  await connectAndOpenAll(page);

  await expect(page.getByText(state.mismatchTitle)).toBeVisible();
  await expect(page.getByText(state.mismatchBody)).toBeVisible();
  await expect(
    page.getByText("signer does not match sender wallet", { exact: false }),
  ).toBeVisible();
});
