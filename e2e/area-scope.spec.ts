import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";

const SHOTS = "e2e/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });

// Persisted board scope leaks across navigations; reset it before each load.
async function clearScope(page: Page) {
  await page.addInitScript(() => localStorage.removeItem("deck.board"));
}

test("area picker drives the board scope to an area filter", async ({ page }) => {
  await clearScope(page);
  await page.goto("/board.html");
  await page.getByLabel("Area path").fill("Team\\Web");
  await page.getByLabel("Area path").press("Enter");
  await expect(page.getByTestId("scope")).toHaveText("scope: area / Team\\Web");
  await page.locator("aside").screenshot({ path: `${SHOTS}/5-area.png` });
});

test("full project-prefixed path is normalized, not double-prefixed", async ({ page }) => {
  await clearScope(page);
  await page.goto("/board.html");
  await page.getByLabel("Area path").fill("Proj\\Team\\Web");
  await page.getByLabel("Area path").press("Enter");
  await expect(page.getByTestId("scope")).toHaveText("scope: area / Team\\Web");
});

test("clearing the area filter returns to the active scope", async ({ page }) => {
  await clearScope(page);
  await page.goto("/board.html");
  await page.getByLabel("Area path").fill("Web");
  await page.getByLabel("Area path").press("Enter");
  await expect(page.getByTestId("scope")).toHaveText("scope: area / Web");
  await page.getByLabel("Clear area").click();
  await expect(page.getByTestId("scope")).toHaveText("scope: active");
});
