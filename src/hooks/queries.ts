import { useQuery } from "@tanstack/react-query";
import { useConnectionStore } from "@/store/connection";
import { useBoardStore } from "@/store/board";
import * as ado from "@/lib/ado";
import { STATE_CATEGORY_ORDER, type AdoState, type AdoWorkItemType } from "@/lib/ado";
import { keys } from "./keys";

interface ColumnsResult {
  types: AdoWorkItemType[];
  columns: AdoState[];
}

/**
 * Board columns = the union of states across the project's work item types,
 * de-duplicated and ordered by state category (Proposed -> InProgress ->
 * Resolved -> Completed -> Removed). Heavily cached; the process rarely changes.
 */
export function useColumns() {
  const conn = useConnectionStore((s) => s.connection);
  return useQuery({
    queryKey: conn ? keys.columns(conn) : ["columns", "none"],
    enabled: !!conn,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ColumnsResult> => {
      const types = await ado.getWorkItemTypes(conn!);
      const perType = await Promise.all(
        types.map((t) =>
          ado
            .getStatesForType(conn!, t.name)
            .then((states) => states)
            .catch(() => [] as AdoState[]),
        ),
      );

      const merged = new Map<string, AdoState & { order: number }>();
      let idx = 0;
      for (const states of perType) {
        for (const s of states) {
          const key = s.name.toLowerCase();
          if (!merged.has(key)) {
            const catRank = STATE_CATEGORY_ORDER[String(s.category)] ?? 2;
            merged.set(key, { ...s, order: catRank * 1000 + idx });
          }
          idx++;
        }
      }
      const columns = [...merged.values()]
        .sort((a, b) => a.order - b.order)
        .map(({ order: _order, ...rest }) => rest);
      return { types, columns };
    },
  });
}

/** Whether the active scope needs an argument that isn't set yet. */
function scopeNeedsArg(scope: ado.ScopeSpec): boolean {
  return (scope.id === "sprint" || scope.id === "area") && !scope.arg;
}

/** Load the mapped work items for the active scope. */
export function useBoardItems() {
  const conn = useConnectionStore((s) => s.connection);
  const scope = useBoardStore((s) => s.scope);
  return useQuery({
    queryKey: conn ? keys.board(conn, scope) : ["board-items", "none"],
    enabled: !!conn && !scopeNeedsArg(scope),
    queryFn: async () => {
      const wiql = ado.buildWorkItemWiql(scope, conn!.project);
      return ado.loadBoardItems(conn!, wiql);
    },
  });
}

/** Full work item (with relations) for the detail panel. */
export function useWorkItemDetail(id: number | null) {
  const conn = useConnectionStore((s) => s.connection);
  return useQuery({
    queryKey: conn && id != null ? keys.workItem(conn, id) : ["work-item", "none"],
    enabled: !!conn && id != null,
    queryFn: () => ado.getWorkItem(conn!, id!),
  });
}

/** Comments for a work item. */
export function useComments(id: number | null) {
  const conn = useConnectionStore((s) => s.connection);
  return useQuery({
    queryKey: conn && id != null ? keys.comments(conn, id) : ["comments", "none"],
    enabled: !!conn && id != null,
    queryFn: () => ado.getComments(conn!, id!),
  });
}

/** Team iterations (sprints), with the current one flagged via attributes.timeFrame. */
export function useIterations() {
  const conn = useConnectionStore((s) => s.connection);
  return useQuery({
    queryKey: conn ? keys.iterations(conn) : ["iterations", "none"],
    enabled: !!conn,
    staleTime: 5 * 60_000,
    queryFn: () => ado.getIterations(conn!),
  });
}

/**
 * Assignable people for the active workspace (union of the project's team
 * members). Cached for a few minutes and, by default, only fetched lazily —
 * pass `enabled` (e.g. a picker's open state) to defer the request until needed.
 */
export function useProjectMembers(enabled = true) {
  const conn = useConnectionStore((s) => s.connection);
  return useQuery({
    queryKey: conn ? keys.members(conn) : ["members", "none"],
    enabled: !!conn && enabled,
    staleTime: 5 * 60_000,
    queryFn: () => ado.getProjectMembers(conn!),
  });
}

/**
 * An ADO avatar image resolved to a base64 `data:` URL (fetched through Rust so
 * the PAT is attached). Keyed by URL and cached indefinitely, so the same person
 * across many cards triggers a single request. Returns `null` until resolved.
 */
export function useAvatarImage(url?: string | null) {
  const conn = useConnectionStore((s) => s.connection);
  return useQuery({
    queryKey: url ? keys.avatar(url) : ["avatar", "none"],
    enabled: !!conn && !!url,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: () => ado.fetchAdoImage(url!),
  });
}
