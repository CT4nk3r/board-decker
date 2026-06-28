import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangle, CalendarRange, Inbox } from "lucide-react";
import { useBoardItems, useColumns } from "@/hooks/queries";
import { useChangeState, useDeleteWorkItem } from "@/hooks/mutations";
import { useBoardStore } from "@/store/board";
import type { AdoState, WorkItem } from "@/lib/ado";
import { Column } from "@/components/Column";
import { WorkItemCardBody } from "@/components/WorkItemCard";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";

function matchesSearch(item: WorkItem, q: string): boolean {
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

export function Board() {
  const scope = useBoardStore((s) => s.scope);
  const search = useBoardStore((s) => s.search);
  const select = useBoardStore((s) => s.select);
  const selectedId = useBoardStore((s) => s.selectedId);
  const { data: items, isLoading, isError, error, refetch, isFetching } = useBoardItems();
  const { data: columnsData } = useColumns();
  const changeState = useChangeState();
  const del = useDeleteWorkItem();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkItem | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const typeColors = useMemo(
    () => new Map((columnsData?.types ?? []).map((t) => [t.name, t.color] as const)),
    [columnsData],
  );

  // Final columns = process states, plus any state seen in items but not defined.
  const columns: AdoState[] = useMemo(() => {
    const base = columnsData?.columns ?? [];
    const known = new Set(base.map((c) => c.name.toLowerCase()));
    const extras: AdoState[] = [];
    const seen = new Set<string>();
    for (const it of items ?? []) {
      const k = it.state.toLowerCase();
      if (!known.has(k) && !seen.has(k)) {
        seen.add(k);
        extras.push({ name: it.state });
      }
    }
    return [...base, ...extras];
  }, [columnsData, items]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, WorkItem[]>();
    for (const c of columns) map.set(c.name.toLowerCase(), []);
    for (const it of items ?? []) {
      if (!matchesSearch(it, q)) continue;
      const k = it.state.toLowerCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return map;
  }, [columns, items, search]);

  const activeItem = items?.find((i) => i.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = Number(active.id);
    const targetState = String(over.id);
    const item = items?.find((i) => i.id === id);
    if (!item || item.state.toLowerCase() === targetState.toLowerCase()) return;
    changeState.mutate({ id, state: targetState });
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    try {
      await del.mutateAsync(id);
      if (selectedId === id) select(null);
      setPendingDelete(null);
    } catch {
      /* error toast handled by the mutation */
    }
  }

  // --- non-board states ---
  if ((scope.id === "sprint" || scope.id === "area") && !scope.arg) {
    return (
      <Empty
        icon={<CalendarRange size={26} />}
        title={scope.id === "sprint" ? "Pick a sprint" : "Choose an area"}
        subtitle={
          scope.id === "sprint"
            ? "Select a sprint from the sidebar to see its board."
            : "Set an area path to filter the board."
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (isError) {
    return (
      <Empty
        icon={<AlertTriangle size={26} className="text-danger" />}
        title="Couldn't load the board"
        subtitle={(error as Error)?.message}
        action={
          <Button variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if ((items?.length ?? 0) === 0) {
    return (
      <Empty
        icon={<Inbox size={26} />}
        title="No work items here"
        subtitle="Nothing matches this view yet. Create one with the New button."
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="min-h-0 flex-1">
        <div className="flex h-full gap-4 overflow-x-auto px-4 py-4">
          {columns.map((col) => (
            <Column
              key={col.name}
              column={col}
              items={grouped.get(col.name.toLowerCase()) ?? []}
              typeColors={typeColors}
              onOpen={select}
              onDelete={setPendingDelete}
            />
          ))}
          <div className="w-2 shrink-0" />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="w-[270px]">
            <WorkItemCardBody item={activeItem} typeColor={typeColors.get(activeItem.type)} dragging />
          </div>
        ) : null}
      </DragOverlay>

      {isFetching && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1 text-xs text-muted shadow-lg">
            <Spinner className="h-3 w-3" /> Syncing…
          </span>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        title={pendingDelete ? `Delete ${pendingDelete.type} #${pendingDelete.id}?` : ""}
        description={
          pendingDelete ? (
            <>
              <span className="font-medium text-fg">{pendingDelete.title}</span> will be moved to the
              Azure DevOps recycle bin. You can restore it from there if needed.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        variant="danger"
        pending={del.isPending}
        onConfirm={handleDelete}
      />
    </DndContext>
  );
}

function Empty({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-muted">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {subtitle && <p className="mt-1 max-w-xs text-sm text-muted">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
