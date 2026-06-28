import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnectionStore } from "@/store/connection";
import { useBoardStore } from "@/store/board";
import * as ado from "@/lib/ado";
import { AdoError, type AdoPatchOp, type ScopeSpec, type WorkItem } from "@/lib/ado";
import { toast } from "@/components/ui/toast";
import { keys } from "./keys";

/** ADO returns these when a JSON-Patch `test` op on `/rev` fails (lost update). */
function isConflict(err: unknown): boolean {
  return err instanceof AdoError && (err.status === 409 || err.status === 412);
}

const DONE_STATES = ["Done", "Closed", "Removed", "Resolved", "Completed"];

/** Does a freshly created item actually belong on the currently visible board? */
function matchesScope(item: WorkItem, scope: ScopeSpec): boolean {
  switch (scope.id) {
    case "all":
    case "recent":
      return true;
    case "active":
      return !DONE_STATES.includes(item.state);
    case "sprint":
      return !!scope.arg && (item.iterationPath ?? "").includes(scope.arg);
    case "area":
      return !!scope.arg && (item.areaPath ?? "").includes(scope.arg);
    // "assigned-to-me" / "created-by-me" hinge on the @Me identity, which the
    // client can't resolve, so refetch rather than risk showing a phantom card.
    default:
      return false;
  }
}

/**
 * Drag-to-change-state. Optimistically moves the card to the target column and
 * rolls back (with a toast) if ADO rejects the change. Sends a `rev` guard so a
 * concurrent edit is detected, reverts only when the card is still where we left
 * it (so a newer success isn't clobbered), and always invalidates on settle.
 * Writes share a scope so per-item mutations serialize instead of racing.
 */
export function useChangeState() {
  const qc = useQueryClient();
  const conn = useConnectionStore((s) => s.connection)!;
  const scope = useBoardStore((s) => s.scope);
  const key = keys.board(conn, scope);

  return useMutation({
    scope: { id: "work-item-write" },
    mutationFn: ({ id, state, rev }: { id: number; state: string; rev?: number }) =>
      ado.updateWorkItem(conn, id, ado.stateChangeOps(state), rev),
    onMutate: async ({ id, state }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<WorkItem[]>(key)?.find((w) => w.id === id);
      qc.setQueryData<WorkItem[]>(key, (old) =>
        old?.map((w) => (w.id === id ? { ...w, state } : w)),
      );
      return { previous, target: state };
    },
    onError: (err, { id }, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData<WorkItem[]>(key, (old) =>
          old?.map((w) => (w.id === id && w.state === ctx.target ? ctx.previous! : w)),
        );
      }
      if (isConflict(err)) {
        toast.error("Work item changed elsewhere", "Reloaded the latest — try the move again.");
      } else {
        toast.error("Couldn't update state", (err as Error).message);
      }
    },
    onSuccess: (updated) => {
      qc.setQueryData<WorkItem[]>(key, (old) =>
        old?.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)),
      );
      qc.setQueryData(keys.workItem(conn, updated.id), updated);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.workItem(conn, id) });
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

/** Apply a JSON-Patch to a work item (used by the detail panel editor). */
export function useUpdateWorkItem() {
  const qc = useQueryClient();
  const conn = useConnectionStore((s) => s.connection)!;

  return useMutation({
    scope: { id: "work-item-write" },
    mutationFn: ({ id, ops, rev }: { id: number; ops: AdoPatchOp[]; rev?: number }) =>
      ado.updateWorkItem(conn, id, ops, rev),
    onSuccess: (updated) => {
      qc.setQueryData(keys.workItem(conn, updated.id), updated);
      qc.setQueriesData<WorkItem[]>({ queryKey: keys.boardAll(conn) }, (old) =>
        old?.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)),
      );
      toast.success("Changes saved");
    },
    onError: (err) =>
      isConflict(err)
        ? toast.error("Work item changed elsewhere", "Reloaded the latest — reapply your edit.")
        : toast.error("Couldn't save changes", (err as Error).message),
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.workItem(conn, id) });
      qc.invalidateQueries({ queryKey: keys.boardAll(conn) });
    },
  });
}

/** Create a work item and surface it on the board immediately. */
export function useCreateWorkItem() {
  const qc = useQueryClient();
  const conn = useConnectionStore((s) => s.connection)!;
  const scope = useBoardStore((s) => s.scope);
  const key = keys.board(conn, scope);

  return useMutation({
    mutationFn: ({ type, ops }: { type: string; ops: AdoPatchOp[] }) =>
      ado.createWorkItem(conn, type, ops),
    onSuccess: (created) => {
      // Only seed the board cache when the item matches the active scope;
      // otherwise refetch so a created-but-out-of-view item isn't a phantom card.
      if (matchesScope(created, scope)) {
        qc.setQueryData<WorkItem[]>(key, (old) => (old ? [created, ...old] : [created]));
        toast.success("Work item created", `#${created.id} · ${created.title}`);
      } else {
        qc.invalidateQueries({ queryKey: key });
        toast.success("Work item created", `#${created.id} · not in this view`);
      }
    },
    onError: (err) => toast.error("Couldn't create work item", (err as Error).message),
  });
}

/** Delete a work item (moves it to the ADO recycle bin) and drop it from caches. */
export function useDeleteWorkItem() {
  const qc = useQueryClient();
  const conn = useConnectionStore((s) => s.connection)!;

  return useMutation({
    mutationFn: (id: number) => ado.deleteWorkItem(conn, id),
    onSuccess: (_data, id) => {
      qc.setQueriesData<WorkItem[]>({ queryKey: keys.boardAll(conn) }, (old) =>
        old?.filter((w) => w.id !== id),
      );
      qc.removeQueries({ queryKey: keys.workItem(conn, id) });
      toast.success("Work item deleted", `#${id} moved to the recycle bin`);
    },
    onError: (err) => toast.error("Couldn't delete work item", (err as Error).message),
  });
}

/** Add a comment to a work item. */
export function useAddComment(id: number) {
  const qc = useQueryClient();
  const conn = useConnectionStore((s) => s.connection)!;

  return useMutation({
    mutationFn: (text: string) => ado.addComment(conn, id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.comments(conn, id) });
    },
    onError: (err) => toast.error("Couldn't add comment", (err as Error).message),
  });
}
