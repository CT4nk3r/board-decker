import { test, expect, type Page } from "@playwright/test";

async function withMock(page: Page, cfg: { failComment?: boolean }) {
  await page.addInitScript((c) => {
    window.__adoMock = c;
  }, cfg);
}

test.describe("comment draft", () => {
  test("clears after a successful send", async ({ page }) => {
    await withMock(page, {});
    await page.goto("/?panel=comment");
    const box = page.getByPlaceholder("Write a comment…");
    await box.fill("looks good");
    await page.getByTitle("Send (⌘↵)").click();
    await expect(box).toHaveValue("");
  });

  test("survives a failed send so the text isn't lost", async ({ page }) => {
    await withMock(page, { failComment: true });
    await page.goto("/?panel=comment");
    const box = page.getByPlaceholder("Write a comment…");
    await box.fill("keep me");
    await page.getByTitle("Send (⌘↵)").click();
    await expect(page.getByText("Couldn't add comment")).toBeVisible();
    await expect(box).toHaveValue("keep me");
  });
});

test("created item out of scope is reported, not faked onto the board", async ({ page }) => {
  await withMock(page, {});
  await page.goto("/?panel=create");
  await page.getByPlaceholder("What needs doing?").fill("Out of view");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("not in this view")).toBeVisible();
});
