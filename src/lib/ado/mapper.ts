/**
 * Work item mapper — extracts and normalizes ADO work item fields into the
 * UI-friendly {@link WorkItem}. Ported from the ado-plane-sync project's
 * `workItemMapper.ts` (Plane-specific state/label resolution removed). Pure.
 */

import type { AdoUser, AdoWorkItem, WorkItem } from "./types";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** `System.IterationPath` -> leaf iteration name, or undefined when at the root. */
export function iterationLeaf(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parts = value
    .split("\\")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
}

function parentId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value.trim());
  }
  return undefined;
}

/** ADO tags are a single "tag1; tag2; tag3" string. */
export function parseTags(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(";")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/** ADO identity fields may be an object (modern) or a "Name <email>" string. */
export function normalizeAdoUser(value: unknown): AdoUser | null {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const ref: AdoUser = {};
    if (typeof v.id === "string") ref.id = v.id;
    if (typeof v.displayName === "string") ref.displayName = v.displayName;
    if (typeof v.uniqueName === "string") ref.uniqueName = v.uniqueName;
    if (typeof v.mail === "string") ref.mail = v.mail;
    const links = v._links as { avatar?: { href?: string } } | undefined;
    if (links?.avatar?.href) ref.imageUrl = links.avatar.href;
    if (typeof v.imageUrl === "string") ref.imageUrl = v.imageUrl;
    return Object.keys(ref).length > 0 ? ref : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const withEmail = value.match(/^(.*?)[<(]([^\s<>()]+@[^\s<>()]+)[>)]\s*$/);
    if (withEmail) {
      return { displayName: withEmail[1]!.trim(), uniqueName: withEmail[2]!.trim() };
    }
    if (/@/.test(value)) return { uniqueName: value.trim() };
    return { displayName: value.trim() };
  }
  return null;
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export function mapWorkItem(workItem: AdoWorkItem): WorkItem {
  const fields = workItem.fields ?? {};

  return {
    id: workItem.id,
    rev: workItem.rev,
    title: asString(fields["System.Title"]) ?? `Work item ${workItem.id}`,
    state: asString(fields["System.State"]) ?? "New",
    type: asString(fields["System.WorkItemType"]) ?? "Task",
    assignee: normalizeAdoUser(fields["System.AssignedTo"]),
    tags: parseTags(fields["System.Tags"]),
    priority: asNumber(fields["Microsoft.VSTS.Common.Priority"]),
    iterationPath: asString(fields["System.IterationPath"]),
    iterationLeaf: iterationLeaf(fields["System.IterationPath"]),
    areaPath: asString(fields["System.AreaPath"]),
    parentId: parentId(fields["System.Parent"]),
    descriptionHtml:
      asString(fields["System.Description"]) ??
      asString(fields["Microsoft.VSTS.TCM.ReproSteps"]),
    createdBy: normalizeAdoUser(fields["System.CreatedBy"]) ?? undefined,
    createdDate: asString(fields["System.CreatedDate"]),
    changedDate: asString(fields["System.ChangedDate"]),
    url: workItem._links?.html?.href ?? workItem.url,
    raw: workItem,
  };
}
