import { test, expect, type Page } from "@playwright/test";

interface SeedItem { id: number; title: string; state: string; type: string }
interface BoardSeed {
  types: { name: string; states: string[] | null }[];
  items: SeedItem[];
}

test.use({ viewport: { width: 1100, height: 800 } });

async function seed(page: Page, board: BoardSeed) {
  await page.addInitScript((b) => {
    window.localStorage.setItem("deck.board", JSON.stringify({ state: { scope: { id: "all" }, view: "board" }, version: 0 }));
    (window as unknown as { __board: BoardSeed }).__board = b;
  }, board);
}

const column = (page: Page, name: string) =>
  page.locator("h3").filter({ hasText: new RegExp(`^${name}$`) }).locator("xpath=ancestor::div[1]/following-sibling::div");

test("rejects dragging a card to a state its type doesn't support", async ({ page }) => {
  await seed(page, {
    types: [
      { name: "Bug", states: ["New", "Active"] },
      { name: "Task", states: ["New", "Done"] },
    ],
    items: [{ id: 1, title: "Only bug", state: "New", type: "Bug" }],
  });
  await page.goto("/kanban.html");

  const card = page.getByText("Only bug");
  await expect(card).toBeVisible();
  await expect(column(page, "Done")).toContainText("Drop here");

  // Drag the Bug onto the "Done" column (Bugs only support New/Active).
  const src = await card.boundingBox();
  const dst = await page.locator("h3").filter({ hasText: /^Done$/ }).boundingBox();
  await page.mouse.move(src!.x + 20, src!.y + 10);
  await page.mouse.down();
  await page.mouse.move(src!.x + 20, src!.y + 40, { steps: 8 });
  await page.mouse.move(dst!.x + 40, dst!.y + 60, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByText("Invalid move")).toBeVisible();
  await expect(column(page, "Done")).toContainText("Drop here"); // unchanged
});

test("shows a banner when some per-type states fail to load", async ({ page }) => {
  await seed(page, {
    types: [
      { name: "Bug", states: ["New", "Active"] },
      { name: "Task", states: null },
    ],
    items: [{ id: 1, title: "A bug", state: "New", type: "Bug" }],
  });
  await page.goto("/kanban.html");
  await expect(page.getByText(/Some columns may be missing/)).toBeVisible();
  await expect(page.getByText(/Task/)).toBeVisible();
});

test("shows the truncation banner at the 500-item cap", async ({ page }) => {
  const items = Array.from({ length: 501 }, (_, i) => ({
    id: i + 1,
    title: `Item ${i + 1}`,
    state: "New",
    type: "Bug",
  }));
  await seed(page, { types: [{ name: "Bug", states: ["New"] }], items });
  await page.goto("/kanban.html");
  await expect(page.getByText(/Showing the first 500 items/)).toBeVisible();
});
