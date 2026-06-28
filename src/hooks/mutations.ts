import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnectionStore } from "@/store/connection";
import { useBoardStore } from "@/store/board";
import * as ado from "@/lib/ado";
import type { AdoPatchOp, WorkItem } from "@/lib/ado";
import { toast } from "@/components/ui/toast";
import { keys } from "./keys";

/**
 * Drag-to-change-state. Optimistically moves the card to the target column and
 * rolls back (with a toast) if ADO rejects the change. This is the locked
 * "full two-way from the start" behavior.
 */
export function useChangeState() {
  const qc = useQueryClient();
  const conn = useConnectionStore((s) => s.connection)!;
  const scope = useBoardStore((s) => s.scope);
  const key = keys.board(conn, scope);

  return useMutation({
    mutationFn: ({ id, state }: { id: number; state: string }) =>
      ado.updateWorkItem(conn, id, ado.stateChangeOps(state)),
    onMutate: async ({ id, state }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<WorkItem[]>(key);
      qc.setQueryData<WorkItem[]>(key, (old) =>
        old?.map((w) => (w.id === id ? { ...w, state } : w)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error("Couldn't update state", (err as Error).message);
    },
    onSuccess: (updated) => {
      qc.setQueryData<WorkItem[]>(key, (old) =>
        old?.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)),
      );
      qc.setQueryData(keys.workItem(conn, updated.id), updated);
    },
  });
}

/** Apply a JSON-Patch to a work item (used by the detail panel editor). */
export function useUpdateWorkItem() {
  const qc = useQueryClient();
  const conn = useConnectionStore((s) => s.connection)!;

  return useMutation({
    mutationFn: ({ id, ops }: { id: number; ops: AdoPatchOp[] }) =>
      ado.updateWorkItem(conn, id, ops),
    onSuccess: (updated) => {
      qc.setQueryData(keys.workItem(conn, updated.id), updated);
      qc.setQueriesData<WorkItem[]>({ queryKey: keys.boardAll(conn) }, (old) =>
        old?.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)),
      );
      toast.success("Changes saved");
    },
    onError: (err) => toast.error("Couldn't save changes", (err as Error).message),
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
      qc.setQueryData<WorkItem[]>(key, (old) => (old ? [created, ...old] : [created]));
      toast.success("Work item created", `#${created.id} · ${created.title}`);
    },
    onError: (err) => toast.error("Couldn't create work item", (err as Error).message),
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
