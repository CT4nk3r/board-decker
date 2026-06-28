import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

import { queryWorkItemIds, loadBoardItems, MAX_BOARD_ITEMS } from "./client";
import type { AdoConnection } from "./types";

const conn: AdoConnection = { org: "o", project: "p" };
const ok = (body: unknown) => ({ status: 200, ok: true, body });

beforeEach(() => invokeMock.mockReset());

describe("WIQL result cap", () => {
  it("caps the WIQL query at MAX_BOARD_ITEMS via $top", async () => {
    expect(MAX_BOARD_ITEMS).toBe(500);
    invokeMock.mockResolvedValue(ok({ workItems: [{ id: 1 }, { id: 2 }] }));
    await queryWorkItemIds(conn, "SELECT [System.Id] FROM workitems");
    const args = invokeMock.mock.calls[0][1] as { url: string };
    expect(args.url).toContain("$top=500");
  });

  it("honors an explicit top override", async () => {
    invokeMock.mockResolvedValue(ok({ workItems: [{ id: 7 }] }));
    const ids = await queryWorkItemIds(conn, "x", 50);
    expect((invokeMock.mock.calls[0][1] as { url: string }).url).toContain("$top=50");
    expect(ids).toEqual([7]);
  });

  it("caps loadBoardItems at MAX even when more ids match", async () => {
    const ids = Array.from({ length: MAX_BOARD_ITEMS + 1 }, (_, i) => i + 1);
    invokeMock.mockResolvedValueOnce(ok({ workItems: ids.map((id) => ({ id })) }));
    invokeMock.mockResolvedValue(ok({ value: ids.map((id) => ({ id, rev: 1, fields: {} })) }));
    const items = await loadBoardItems(conn, "wiql");
    expect(items.length).toBe(MAX_BOARD_ITEMS);
  });

  it("returns all items when under the cap", async () => {
    const ids = [1, 2, 3];
    invokeMock.mockResolvedValueOnce(ok({ workItems: ids.map((id) => ({ id })) }));
    invokeMock.mockResolvedValue(ok({ value: ids.map((id) => ({ id, rev: 1, fields: {} })) }));
    const items = await loadBoardItems(conn, "wiql");
    expect(items.length).toBe(3);
  });
});
