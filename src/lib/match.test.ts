import { describe, it, expect } from "vitest";
import { matchesSearch } from "./match";
import type { WorkItem } from "@/lib/ado";

function item(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 101,
    rev: 1,
    title: "Login page bug",
    state: "Active",
    type: "Bug",
    assignee: { displayName: "Ada Lovelace" },
    tags: ["frontend", "auth"],
    raw: { id: 101, rev: 1, fields: {} },
    ...overrides,
  };
}

describe("matchesSearch", () => {
  it("matches everything on an empty query", () => {
    expect(matchesSearch(item(), "")).toBe(true);
  });

  it("matches across title, id, type, state, assignee and tags", () => {
    expect(matchesSearch(item(), "login")).toBe(true);
    expect(matchesSearch(item(), "101")).toBe(true);
    expect(matchesSearch(item(), "bug")).toBe(true);
    expect(matchesSearch(item(), "active")).toBe(true);
    expect(matchesSearch(item(), "ada")).toBe(true);
    expect(matchesSearch(item(), "auth")).toBe(true);
  });

  it("returns false when nothing contains the query", () => {
    expect(matchesSearch(item(), "zzz")).toBe(false);
  });

  it("only compares against pre-lowercased input from the caller", () => {
    expect(matchesSearch(item(), "LOGIN")).toBe(false);
  });

  it("tolerates a missing assignee", () => {
    expect(matchesSearch(item({ assignee: null }), "ada")).toBe(false);
    expect(matchesSearch(item({ assignee: null }), "login")).toBe(true);
  });
});
