/** Parse work item relations into linked items and "development" links (PRs/branches). */

import type { AdoRelation } from "./types";

export interface DevLink {
  kind: "pullRequest" | "branch" | "commit" | "hyperlink";
  label: string;
  /** A browser-openable URL when one can be determined. */
  url?: string;
}

export interface LinkedItems {
  parentId?: number;
  childIds: number[];
  relatedIds: number[];
}

/** Last numeric path segment of an ADO work item REST url -> its id. */
function workItemIdFromUrl(url: string): number | undefined {
  const m = url.match(/workitems\/(\d+)(?:$|[/?])/i) ?? url.match(/(\d+)\s*$/);
  const id = m ? Number(m[1]) : NaN;
  return Number.isFinite(id) ? id : undefined;
}

export function parseLinkedItems(relations: AdoRelation[] | undefined): LinkedItems {
  const result: LinkedItems = { childIds: [], relatedIds: [] };
  for (const rel of relations ?? []) {
    const id = workItemIdFromUrl(rel.url);
    if (!id) continue;
    switch (rel.rel) {
      case "System.LinkTypes.Hierarchy-Reverse":
        result.parentId = id;
        break;
      case "System.LinkTypes.Hierarchy-Forward":
        result.childIds.push(id);
        break;
      case "System.LinkTypes.Related":
        result.relatedIds.push(id);
        break;
      default:
        break;
    }
  }
  return result;
}

/** Percent-decode a URL, falling back to the raw value on malformed encoding. */
function safeDecode(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/** Decode a `vstfs:///Git/...` artifact URI into a friendly dev link. */
function parseArtifact(url: string, attrName?: string): DevLink | undefined {
  const decoded = safeDecode(url);
  if (/\/Git\/PullRequestId\//i.test(decoded)) {
    const id = decoded.split("/").pop();
    return { kind: "pullRequest", label: id ? `Pull Request !${id}` : "Pull Request" };
  }
  if (/\/Git\/Ref\//i.test(decoded)) {
    const name = decoded.split("/").pop();
    return { kind: "branch", label: name ? `Branch ${name}` : (attrName ?? "Branch") };
  }
  if (/\/Git\/Commit\//i.test(decoded)) {
    const sha = decoded.split("/").pop()?.slice(0, 8);
    return { kind: "commit", label: sha ? `Commit ${sha}` : "Commit" };
  }
  return undefined;
}

export function parseDevLinks(relations: AdoRelation[] | undefined): DevLink[] {
  const links: DevLink[] = [];
  for (const rel of relations ?? []) {
    const attrName = (rel.attributes?.name as string | undefined) ?? undefined;
    if (rel.rel === "ArtifactLink" && rel.url.startsWith("vstfs:")) {
      const parsed = parseArtifact(rel.url, attrName);
      if (parsed) links.push(parsed);
    } else if (rel.rel === "Hyperlink" && /^https?:/i.test(rel.url)) {
      links.push({ kind: "hyperlink", label: attrName ?? rel.url, url: rel.url });
    }
  }
  return links;
}
