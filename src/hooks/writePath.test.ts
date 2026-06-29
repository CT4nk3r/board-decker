import { describe, it, expect, vi } from "vitest";
import {
  applyState,
  isConflict,
  matchesScope,
  revertState,
  submitDraft,
} from "@/hooks/writePath";
import { AdoError } from "@/lib/ado";
import type { ScopeSpec, WorkItem } from "@/lib/ado";

function wi(partial: Partial<WorkItem> & { id: number }): WorkItem {
  return {
    rev: 1,
    title: "t",
    state: "New",
    type: "Task",
    assignee: null,
    tags: [],
    ...partial,
    raw: { id: partial.id, rev: partial.rev ?? 1, fields: {} },
  } as WorkItem;
}

describe("isConflict", () => {
  it("treats 409/412 as rev conflicts", () => {
    expect(isConflict(new AdoError("x", 409, null))).toBe(true);
    expect(isConflict(new AdoError("x", 412, null))).toBe(true);
  });
  it("treats a 400 mentioning rev as a conflict but not other 400s", () => {
    expect(isConflict(new AdoError("rev mismatch", 400, null))).toBe(true);
    expect(isConflict(new AdoError("bad title", 400, null))).toBe(false);
  });
  it("ignores non-AdoError and other statuses", () => {
    expect(isConflict(new Error("nope"))).toBe(false);
    expect(isConflict(new AdoError("x", 500, null))).toBe(false);
  });
});

describe("matchesScope", () => {
  const P = "Proj";
  it("always shows broad scopes", () => {
    expect(matchesScope(wi({ id: 1 }), { id: "all" }, P)).toBe(true);
    expect(matchesScope(wi({ id: 1 }), { id: "recent" }, P)).toBe(true);
  });
  it("active excludes done states", () => {
    expect(matchesScope(wi({ id: 1, state: "New" }), { id: "active" }, P)).toBe(true);
    expect(matchesScope(wi({ id: 1, state: "Closed" }), { id: "active" }, P)).toBe(false);
  });
  it("sprint matches exact node and descendants, not sibling prefixes", () => {
    const s: ScopeSpec = { id: "sprint", arg: "Sprint 1" };
    expect(matchesScope(wi({ id: 1, iterationPath: "Proj\\Sprint 1" }), s, P)).toBe(true);
    expect(matchesScope(wi({ id: 1, iterationPath: "Proj\\Sprint 1\\Wk2" }), s, P)).toBe(true);
    expect(matchesScope(wi({ id: 1, iterationPath: "Proj\\Sprint 10" }), s, P)).toBe(false);
  });
  it("area uses UNDER semantics", () => {
    const s: ScopeSpec = { id: "area", arg: "Web" };
    expect(matchesScope(wi({ id: 1, areaPath: "Proj\\Web\\Api" }), s, P)).toBe(true);
    expect(matchesScope(wi({ id: 1, areaPath: "Proj\\WebBackup" }), s, P)).toBe(false);
  });
  it("refetches identity scopes the client can't verify", () => {
    expect(matchesScope(wi({ id: 1 }), { id: "assigned-to-me" }, P)).toBe(false);
    expect(matchesScope(wi({ id: 1 }), { id: "created-by-me" }, P)).toBe(false);
  });
});

describe("optimistic state", () => {
  it("applyState moves only the target card", () => {
    const items = [wi({ id: 1, state: "New" }), wi({ id: 2, state: "New" })];
    const out = applyState(items, 1, "Active")!;
    expect(out[0].state).toBe("Active");
    expect(out[1].state).toBe("New");
  });

  it("revertState restores when card still at failed target", () => {
    const prev = wi({ id: 1, state: "New" });
    const cache = [wi({ id: 1, state: "Active" })]; // optimistic target
    const out = revertState(cache, 1, "Active", prev)!;
    expect(out[0].state).toBe("New");
  });

  it("revertState does NOT clobber a newer successful change", () => {
    const prev = wi({ id: 1, state: "New" });
    const cache = [wi({ id: 1, state: "Done" })]; // a later mutation already won
    const out = revertState(cache, 1, "Active", prev)!;
    expect(out[0].state).toBe("Done");
  });
});

describe("submitDraft", () => {
  it("clears only after a successful send", async () => {
    const clear = vi.fn();
    await submitDraft(vi.fn().mockResolvedValue(undefined), " hi ", clear);
    expect(clear).toHaveBeenCalledOnce();
  });
  it("retains the draft when the send fails", async () => {
    const clear = vi.fn();
    await submitDraft(vi.fn().mockRejectedValue(new Error("offline")), "hi", clear);
    expect(clear).not.toHaveBeenCalled();
  });
  it("ignores blank drafts", async () => {
    const send = vi.fn();
    await submitDraft(send, "   ", vi.fn());
    expect(send).not.toHaveBeenCalled();
  });
});
