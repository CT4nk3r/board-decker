import { describe, it, expect } from "vitest";
import { keys } from "./keys";

describe("query keys identity scoping", () => {
  it("includes the identity component", () => {
    const k = keys.board({ org: "o", project: "p", identity: "id-1" }, { id: "all" });
    expect(k).toContain("id-1");
  });

  it("yields different keys for different identities", () => {
    const a = keys.board({ org: "o", project: "p", identity: "id-1" }, { id: "all" });
    const b = keys.board({ org: "o", project: "p", identity: "id-2" }, { id: "all" });
    expect(a).not.toEqual(b);
  });

  it("falls back to anon when identity absent", () => {
    expect(keys.columns({ org: "o", project: "p" })).toContain("anon");
  });
});
