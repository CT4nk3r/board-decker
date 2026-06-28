import type { WorkItem } from "@/lib/ado";

/**
 * Client-side free-text match over a work item's user-visible fields.
 * `q` is expected to be already lowercased/trimmed by the caller.
 */
export function matchesSearch(item: WorkItem, q: string): boolean {
  if (!q) return true;
  const haystack = [
    item.title,
    String(item.id),
    item.type,
    item.state,
    item.assignee?.displayName ?? "",
    item.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}
