import { describe, it, expect } from "vitest";
import { buildWorkItemWiql, SCOPE_LABELS } from "./wiql";

describe("buildWorkItemWiql", () => {
  it("scopes every query to the team project and orders by changed date", () => {
    const q = buildWorkItemWiql({ id: "all" }, "Proj");
    expect(q).toContain("[System.TeamProject] = @project");
    expect(q.endsWith("ORDER BY [System.ChangedDate] DESC")).toBe(true);
  });

  it("uses ADO macros for assigned/created scopes", () => {
    expect(buildWorkItemWiql({ id: "assigned-to-me" }, "P")).toContain("[System.AssignedTo] = @Me");
    expect(buildWorkItemWiql({ id: "created-by-me" }, "P")).toContain("[System.CreatedBy] = @Me");
  });

  it("excludes done-ish states for the active scope", () => {
    const q = buildWorkItemWiql({ id: "active" }, "P");
    for (const s of ["Done", "Closed", "Removed", "Resolved", "Completed"]) {
      expect(q).toContain(`'${s}'`);
    }
    expect(q).toContain("NOT IN");
  });

  describe("recent", () => {
    it("defaults to 14 days when no arg is given", () => {
      expect(buildWorkItemWiql({ id: "recent" }, "P")).toContain("@Today - 14");
    });
    it("floors fractional day counts", () => {
      expect(buildWorkItemWiql({ id: "recent", arg: "7.9" }, "P")).toContain("@Today - 7");
    });
    it("rejects non-positive or non-numeric day counts", () => {
      expect(() => buildWorkItemWiql({ id: "recent", arg: "0" }, "P")).toThrow();
      expect(() => buildWorkItemWiql({ id: "recent", arg: "-3" }, "P")).toThrow();
      expect(() => buildWorkItemWiql({ id: "recent", arg: "abc" }, "P")).toThrow();
    });
  });

  describe("sprint", () => {
    it("builds an iteration-path UNDER clause", () => {
      expect(buildWorkItemWiql({ id: "sprint", arg: "S1" }, "Proj")).toContain(
        "[System.IterationPath] UNDER 'Proj\\S1'",
      );
    });
    it("requires an arg", () => {
      expect(() => buildWorkItemWiql({ id: "sprint" }, "Proj")).toThrow();
    });
  });

  describe("area", () => {
    it("builds an area-path UNDER clause", () => {
      expect(buildWorkItemWiql({ id: "area", arg: "Team\\Web" }, "Proj")).toContain(
        "[System.AreaPath] UNDER 'Proj\\Team\\Web'",
      );
    });
    it("requires an arg", () => {
      expect(() => buildWorkItemWiql({ id: "area" }, "Proj")).toThrow();
    });
  });

  it("escapes single quotes in project and arg to prevent broken/injected WIQL", () => {
    const q = buildWorkItemWiql({ id: "area", arg: "O'Brien" }, "Pr'oj");
    expect(q).toContain("'Pr''oj\\O''Brien'");
    expect(q).not.toContain("O'Brien'");
  });

  it("throws on an unknown scope id", () => {
    expect(() => buildWorkItemWiql({ id: "nope" } as never, "P")).toThrow(/Unknown scope/);
  });

  it("has a label for every scope id", () => {
    expect(SCOPE_LABELS.area).toBe("By area");
    expect(SCOPE_LABELS.sprint).toBe("Current sprint");
  });
});
