/**
 * Pure helpers for the work-item write path. Kept free of React/React-Query so
 * the concurrency + optimistic-cache rules can be unit tested in isolation.
 */

import { AdoError, type ScopeSpec, type WorkItem } from "@/lib/ado";

/** ADO returns these when a JSON-Patch `test` op on `/rev` fails (lost update). */
export function isConflict(err: unknown): boolean {
  if (!(err instanceof AdoError)) return false;
  if (err.status === 409 || err.status === 412) return true;
  // Some ADO surfaces reject a failed `test` op with 400 + a rev message.
  return err.status === 400 && /\brev\b/i.test(err.message);
}

const DONE_STATES = ["Done", "Closed", "Removed", "Resolved", "Completed"];

/** WIQL `UNDER 'project\arg'` semantics: exact node or a descendant — not `Sprint 1` ⊃ `Sprint 10`. */
function underPath(itemPath: string | undefined, project: string, arg: string): boolean {
  const target = `${project}\\${arg}`.toLowerCase();
  const p = (itemPath ?? "").toLowerCase();
  return p === target || p.startsWith(`${target}\\`);
}

/** Does a freshly created item actually belong on the currently visible board? */
export function matchesScope(item: WorkItem, scope: ScopeSpec, project: string): boolean {
  switch (scope.id) {
    case "all":
    case "recent":
      return true;
    case "active":
      return !DONE_STATES.includes(item.state);
    case "sprint":
      return !!scope.arg && underPath(item.iterationPath, project, scope.arg);
    case "area":
      return !!scope.arg && underPath(item.areaPath, project, scope.arg);
    // "assigned-to-me" / "created-by-me" hinge on the @Me identity, which the
    // client can't resolve, so refetch rather than risk showing a phantom card.
    default:
      return false;
  }
}

/** Optimistically move one card to `state`, leaving every other card untouched. */
export function applyState(
  items: WorkItem[] | undefined,
  id: number,
  state: string,
): WorkItem[] | undefined {
  return items?.map((w) => (w.id === id ? { ...w, state } : w));
}

/**
 * Roll a single card back to `previous` only if it is still sitting at the
 * optimistic `target`. A later mutation that already moved it elsewhere (and
 * succeeded) must not be clobbered by this stale failure.
 */
export function revertState(
  items: WorkItem[] | undefined,
  id: number,
  target: string,
  previous: WorkItem | undefined,
): WorkItem[] | undefined {
  if (!previous) return items;
  return items?.map((w) => (w.id === id && w.state === target ? previous : w));
}

/**
 * Send a comment draft, clearing it only when the send succeeds so an
 * offline/expired-PAT/ADO failure preserves the typed text. No-op when blank.
 */
export async function submitDraft(
  send: (text: string) => Promise<unknown>,
  draft: string,
  clear: () => void,
): Promise<void> {
  const text = draft.trim();
  if (!text) return;
  try {
    await send(text);
    clear();
  } catch {
    /* keep the draft so the typed comment survives the failure */
  }
}
