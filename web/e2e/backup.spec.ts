import { test, expect } from "@playwright/test";
import { connect, injectWallet, TAIKO_HEX } from "./fixtures";

test.describe("local persistence", () => {
  test.beforeEach(async ({ page }) => {
    await injectWallet(page, TAIKO_HEX);
  });

  test("backup & restore exports a zip file", async ({ page }) => {
    await connect(page);
    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.getByText("Backup & restore")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import data" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Export data" }).click();
    await expect(page.getByText("Export your data?")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download backup" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^heed-export-.*\.zip$/);
  });

  test("compose draft persists in IndexedDB across remounts", async ({
    page,
  }) => {
    await connect(page);
    await page.getByRole("tab", { name: "Compose" }).click();
    await page.getByLabel("Subject").fill("Persisted subject");
    await page.getByLabel("Body").fill("Persisted body");

    // Wait for the 500ms auto-save debounce + the IndexedDB write.
    await page.waitForTimeout(900);

    // Leaving Compose unmounts it; returning must restore the saved draft.
    await page.getByRole("tab", { name: "Inbox" }).click();
    await page.getByRole("tab", { name: "Compose" }).click();

    await expect(page.getByLabel("Subject")).toHaveValue("Persisted subject");
    await expect(page.getByLabel("Body")).toHaveValue("Persisted body");
  });
});
