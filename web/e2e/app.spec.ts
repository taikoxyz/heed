import { test, expect } from "@playwright/test";
import { connect, injectWallet, TAIKO_HEX } from "./fixtures";

test.describe("connected app shell", () => {
  test.beforeEach(async ({ page }) => {
    await injectWallet(page, TAIKO_HEX);
  });

  test("connects and renders the tab navigation", async ({ page }) => {
    await connect(page);
    for (const name of ["Inbox", "Sent", "Compose", "Account", "Settings"]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
  });

  test("compose validates recipients before sending", async ({ page }) => {
    await connect(page);
    await page.getByRole("tab", { name: "Compose" }).click();

    // Empty recipients.
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/add at least one recipient/i)).toBeVisible();

    // Invalid address.
    await page.getByLabel("To (one or more addresses)").fill("not-an-address");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/invalid address/i)).toBeVisible();
  });

  test("account tab exposes key management", async ({ page }) => {
    await connect(page);
    await page.getByRole("tab", { name: "Account" }).click();
    await expect(page.getByText("Encryption key")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Publish key|Rotate key/ }),
    ).toBeVisible();
  });

  test("settings persist to localStorage", async ({ page }) => {
    await connect(page);
    await page.getByRole("tab", { name: "Settings" }).click();
    await page
      .getByPlaceholder("https://rpc.mainnet.taiko.xyz")
      .fill("https://custom.rpc.example");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });
});

test("shows a wrong-network guard off Taiko", async ({ page }) => {
  await injectWallet(page, "0x1"); // Ethereum mainnet
  await connect(page);
  await expect(page.getByText("Wrong network")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to Taiko" }),
  ).toBeVisible();
});
