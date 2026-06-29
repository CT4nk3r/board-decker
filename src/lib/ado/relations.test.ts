import { describe, it, expect } from "vitest";
import { parseLinkedItems, parseDevLinks } from "./relations";
import type { AdoRelation } from "./types";

describe("parseLinkedItems", () => {
  it("buckets parent/child/related ids from work-item urls", () => {
    const rels: AdoRelation[] = [
      { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://api/_apis/wit/workItems/10" },
      { rel: "System.LinkTypes.Hierarchy-Forward", url: "https://api/_apis/wit/workItems/11" },
      { rel: "System.LinkTypes.Hierarchy-Forward", url: "https://api/_apis/wit/workItems/12" },
      { rel: "System.LinkTypes.Related", url: "https://api/_apis/wit/workItems/13" },
    ];
    expect(parseLinkedItems(rels)).toEqual({ parentId: 10, childIds: [11, 12], relatedIds: [13] });
  });

  it("skips malformed urls and unknown rels, tolerates undefined", () => {
    expect(parseLinkedItems(undefined)).toEqual({ childIds: [], relatedIds: [] });
    const out = parseLinkedItems([
      { rel: "System.LinkTypes.Hierarchy-Forward", url: "not-a-url" },
      { rel: "ArtifactLink", url: "https://api/_apis/wit/workItems/5" },
    ]);
    expect(out.childIds).toEqual([]);
    expect(out.relatedIds).toEqual([]);
  });
});

describe("parseDevLinks", () => {
  it("decodes PR / branch / commit artifact uris", () => {
    const links = parseDevLinks([
      { rel: "ArtifactLink", url: "vstfs:///Git/PullRequestId/proj%2Frepo%2F123" },
      { rel: "ArtifactLink", url: "vstfs:///Git/Ref/proj%2Frepo%2FGBmain" },
      { rel: "ArtifactLink", url: "vstfs:///Git/Commit/proj%2Frepo%2Fabcdef1234" },
    ]);
    expect(links[0]).toMatchObject({ kind: "pullRequest", label: "Pull Request !123" });
    expect(links[1]).toMatchObject({ kind: "branch", label: "Branch GBmain" });
    expect(links[2]).toMatchObject({ kind: "commit", label: "Commit abcdef12" });
  });

  it("keeps http hyperlinks with their name, drops unknown artifacts", () => {
    const links = parseDevLinks([
      { rel: "Hyperlink", url: "https://wiki/x", attributes: { name: "Wiki" } },
      { rel: "ArtifactLink", url: "vstfs:///Build/Build/9" },
      { rel: "Hyperlink", url: "ftp://nope" },
    ]);
    expect(links).toEqual([{ kind: "hyperlink", label: "Wiki", url: "https://wiki/x" }]);
  });

  it("tolerates undefined", () => {
    expect(parseDevLinks(undefined)).toEqual([]);
  });
});
