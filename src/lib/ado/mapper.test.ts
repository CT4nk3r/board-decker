import { describe, it, expect } from "vitest";
import {
  iterationLeaf,
  parseTags,
  normalizeAdoUser,
  mapWorkItem,
} from "./mapper";
import type { AdoWorkItem } from "./types";

describe("normalizeAdoUser", () => {
  it("maps a modern identity object incl. avatar link", () => {
    const user = normalizeAdoUser({
      id: "g1",
      displayName: "Ada Lovelace",
      uniqueName: "ada@x.io",
      _links: { avatar: { href: "https://x/av" } },
    });
    expect(user).toMatchObject({ id: "g1", displayName: "Ada Lovelace", imageUrl: "https://x/av" });
  });

  it("parses a 'Name <email>' string", () => {
    expect(normalizeAdoUser("Ada Lovelace <ada@x.io>")).toEqual({
      displayName: "Ada Lovelace",
      uniqueName: "ada@x.io",
    });
  });

  it("treats a bare email as a uniqueName and a bare name as a displayName", () => {
    expect(normalizeAdoUser("ada@x.io")).toEqual({ uniqueName: "ada@x.io" });
    expect(normalizeAdoUser("Ada")).toEqual({ displayName: "Ada" });
  });

  it("returns null for empty/non-identity input", () => {
    expect(normalizeAdoUser("")).toBeNull();
    expect(normalizeAdoUser(undefined)).toBeNull();
    expect(normalizeAdoUser({})).toBeNull();
  });
});

describe("parseTags", () => {
  it("splits, trims and drops empties", () => {
    expect(parseTags("a; b ;;c")).toEqual(["a", "b", "c"]);
  });
  it("returns [] for non-strings", () => {
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags(42)).toEqual([]);
  });
});

describe("iterationLeaf", () => {
  it("returns the leaf only when nested", () => {
    expect(iterationLeaf("Proj\\Release\\Sprint 3")).toBe("Sprint 3");
    expect(iterationLeaf("Proj")).toBeUndefined();
    expect(iterationLeaf("")).toBeUndefined();
  });
});

describe("mapWorkItem", () => {
  it("normalizes fields, parent id, tags and prefers the html link", () => {
    const wi: AdoWorkItem = {
      id: 7,
      rev: 2,
      fields: {
        "System.Title": "Fix it",
        "System.State": "Active",
        "System.WorkItemType": "Bug",
        "System.Parent": "42",
        "System.Tags": "alpha; beta",
        "System.Description": "<p>desc</p>",
      },
      url: "https://api/7",
      _links: { html: { href: "https://html/7" } },
    };
    const m = mapWorkItem(wi);
    expect(m).toMatchObject({ id: 7, title: "Fix it", state: "Active", type: "Bug", parentId: 42 });
    expect(m.tags).toEqual(["alpha", "beta"]);
    expect(m.url).toBe("https://html/7");
  });

  it("falls back to repro steps for description and synthesizes a title", () => {
    const m = mapWorkItem({ id: 9, rev: 1, fields: { "Microsoft.VSTS.TCM.ReproSteps": "steps" } });
    expect(m.descriptionHtml).toBe("steps");
    expect(m.title).toBe("Work item 9");
    expect(m.state).toBe("New");
  });

  it("ignores a non-numeric parent", () => {
    expect(mapWorkItem({ id: 1, rev: 1, fields: { "System.Parent": "x" } }).parentId).toBeUndefined();
  });
});
