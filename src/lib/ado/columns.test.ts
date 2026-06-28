import { describe, it, expect } from "vitest";
import { buildColumns, allTypesFailed, isAllowedTarget } from "./columns";

describe("buildColumns", () => {
  it("merges states, records per-type sets, and surfaces failed types", () => {
    const r = buildColumns([
      { type: "Bug", states: [{ name: "New", category: "Proposed" }, { name: "Active", category: "InProgress" }] },
      { type: "Task", states: null },
    ]);
    expect(r.failedTypes).toEqual(["Task"]);
    expect(r.statesByType).toEqual({ Bug: ["New", "Active"] });
    expect(r.columns.map((c) => c.name)).toEqual(["New", "Active"]);
  });

  it("orders by state category then dedupes across types", () => {
    const r = buildColumns([
      { type: "Bug", states: [{ name: "Done", category: "Completed" }, { name: "New", category: "Proposed" }] },
      { type: "Task", states: [{ name: "New", category: "Proposed" }] },
    ]);
    expect(r.columns.map((c) => c.name)).toEqual(["New", "Done"]);
  });
});

describe("allTypesFailed", () => {
  it("is true only when every type failed", () => {
    expect(allTypesFailed(2, 2)).toBe(true);
    expect(allTypesFailed(2, 1)).toBe(false);
    expect(allTypesFailed(0, 0)).toBe(false);
  });
});

describe("isAllowedTarget", () => {
  const byType = { Bug: ["New", "Active", "Done"] };
  it("allows supported states (case-insensitive) and blocks unsupported", () => {
    expect(isAllowedTarget(byType, "Bug", "active")).toBe(true);
    expect(isAllowedTarget(byType, "Bug", "Resolved")).toBe(false);
  });
  it("is permissive for unknown/failed types", () => {
    expect(isAllowedTarget(byType, "Task", "whatever")).toBe(true);
    expect(isAllowedTarget(undefined, "Bug", "Done")).toBe(true);
  });
});
