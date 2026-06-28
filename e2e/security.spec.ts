import { test, expect, type Page } from "@playwright/test";

// A payload mixing inline-script and event-handler injection vectors with
// benign content the panel should keep. If sanitization fails, __pwned flips.
const MALICIOUS = `
  <p>Release notes: <strong>v2</strong></p>
  <script>window.__pwned = true;</script>
  <img src="x" onerror="window.__pwned = true">
  <a href="javascript:window.__pwned=true">bad link</a>
  <a href="https://example.com">good link</a>
  <iframe src="https://evil.example"></iframe>
`;

test("detail-panel HTML is sanitized — no script executes", async ({ page }: { page: Page }) => {
  await page.addInitScript((html) => {
    window.__adoHtml = html;
    window.__pwned = false;
  }, MALICIOUS);
  await page.goto("/?panel=sanitize");

  const ado = page.getByTestId("ado");
  await expect(ado.getByText("v2")).toBeVisible();

  // Inert: no injected script/handler/iframe survived, nothing executed.
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__pwned)).toBe(false);
  expect(await ado.locator("script").count()).toBe(0);
  expect(await ado.locator("iframe").count()).toBe(0);
  const safeHref = await ado.locator("a", { hasText: "good link" }).getAttribute("href");
  expect(safeHref).toBe("https://example.com");
  expect(await ado.innerHTML()).not.toContain("javascript:");
  // Links are forced to open externally, never navigating the app webview.
  await expect(ado.locator("a", { hasText: "good link" })).toHaveAttribute("rel", /noopener/);
});

test("sign out clears the cached board data", async ({ page }: { page: Page }) => {
  await page.goto("/?panel=signout");
  await expect(page.getByTestId("cache-count")).toHaveText("1");

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expect(page.getByTestId("cache-count")).toHaveText("0");
  expect(await page.evaluate(() => window.__invokes ?? [])).toContain("delete_pat");
});
