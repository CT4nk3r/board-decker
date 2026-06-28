import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import type { MockConfig } from "./harness/mocks/plugin-updater";

const SHOTS = "e2e/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });

// Seed window.__updaterMock before any app script runs.
async function withMock(page: Page, cfg: MockConfig) {
  await page.addInitScript((c) => {
    window.__updaterMock = c;
  }, cfg);
}

const header = (page: Page) => page.locator("header");

test("available — update button appears in the top bar", async ({ page }) => {
  await withMock(page, { version: "0.1.2" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Update to 0\.1\.2/ }),
  ).toBeVisible();
  await header(page).screenshot({ path: `${SHOTS}/1-available.png` });
});

test("downloading — shows progress percentage", async ({ page }) => {
  await withMock(page, {
    version: "0.1.2",
    total: 100,
    chunk: 60,
    freezeAfter: "progress",
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Update to/ }).click();
  await expect(page.getByText("Updating… 60%")).toBeVisible();
  await header(page).screenshot({ path: `${SHOTS}/2-downloading.png` });
});

test("installing — shows restarting", async ({ page }) => {
  await withMock(page, {
    version: "0.1.2",
    total: 100,
    chunk: 100,
    freezeAfter: "finished",
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Update to/ }).click();
  await expect(page.getByText("Restarting…")).toBeVisible();
  await header(page).screenshot({ path: `${SHOTS}/3-installing.png` });
});

test("error — shows retry affordance", async ({ page }) => {
  await withMock(page, { version: "0.1.2", fail: true });
  await page.goto("/");
  await page.getByRole("button", { name: /Update to/ }).click();
  await expect(page.getByText("Update failed — retry")).toBeVisible();
  await header(page).screenshot({ path: `${SHOTS}/4-error.png` });
});

test("no update — button stays hidden", async ({ page }) => {
  await withMock(page, { none: true });
  await page.goto("/");
  // Give the mount + check() a tick, then assert nothing rendered.
  await page.waitForTimeout(300);
  await expect(page.getByRole("button")).toHaveCount(0);
});
