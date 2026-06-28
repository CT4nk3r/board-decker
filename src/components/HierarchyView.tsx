import { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  CalendarRange,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Inbox,
} from "lucide-react";
import { useBoardItems, useColumns } from "@/hooks/queries";
import { useBoardStore } from "@/store/board";
import type { WorkItem } from "@/lib/ado";
import { MAX_BOARD_ITEMS } from "@/lib/ado";
import { matchesSearch } from "@/lib/match";
import { cn, adoColor } from "@/lib/utils";
import { Empty } from "@/components/Empty";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Sibling ordering weight: backlog hierarchy top-down, unknown types last. */
const TYPE_RANK: Record<string, number> = {
  epic: 0,
  feature: 1,
  "product backlog item": 2,
  "user story": 2,
  requirement: 2,
  issue: 2,
  task: 3,
  bug: 4,
  "test case": 5,
  impediment: 6,
};

function typeRank(type: string): number {
  return TYPE_RANK[type.toLowerCase()] ?? 7;
}

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "P1", color: "#f0506e" },
  2: { label: "P2", color: "#f4b740" },
};

interface Tree {
  byId: Map<number, WorkItem>;
  childrenOf: Map<number, WorkItem[]>;
  roots: WorkItem[];
}

/**
 * Build a parent/child forest from the flat, scope-filtered item list using each
 * item's `parentId`. Items whose parent isn't part of the loaded set (or that
 * have no parent) become roots, so the tree always reflects what's in view.
 */
function buildTree(items: WorkItem[]): Tree {
  const byId = new Map<number, WorkItem>();
  for (const it of items) byId.set(it.id, it);

  const childrenOf = new Map<number, WorkItem[]>();
  const roots: WorkItem[] = [];
  for (const it of items) {
    const pid = it.parentId;
    if (pid != null && pid !== it.id && byId.has(pid)) {
      const arr = childrenOf.get(pid);
      if (arr) arr.push(it);
      else childrenOf.set(pid, [it]);
    } else {
      roots.push(it);
    }
  }

  // Items trapped in a pure parent-cycle (e.g. A↔B, both loaded, neither with a
  // parent outside the set) are never classified as roots and would otherwise
  // silently vanish. Promote one entry per orphaned component so all items render.
  const reachable = new Set<number>();
  const mark = (start: WorkItem) => {
    const stack = [start];
    while (stack.length) {
      const node = stack.pop()!;
      if (reachable.has(node.id)) continue;
      reachable.add(node.id);
      for (const child of childrenOf.get(node.id) ?? []) stack.push(child);
    }
  };
  for (const r of roots) mark(r);
  if (reachable.size < items.length) {
    for (const it of items) {
      if (reachable.has(it.id)) continue;
      roots.push(it);
      mark(it);
    }
  }

  const sortFn = (a: WorkItem, b: WorkItem) =>
    typeRank(a.type) - typeRank(b.type) || a.id - b.id;
  roots.sort(sortFn);
  for (const arr of childrenOf.values()) arr.sort(sortFn);

  return { byId, childrenOf, roots };
}

/** A single visible tree node, depth-first, ready for windowed rendering. */
interface FlatRow {
  item: WorkItem;
  depth: number;
  pos: number;
  setSize: number;
  childCount: number;
  hasChildren: boolean;
  isOpen: boolean;
}

/**
 * Flatten the visible portion of the forest depth-first so the tree can be
 * virtualized. Honors search visibility, expansion state, and (while searching)
 * force-expansion, and guards against parent cycles via the ancestor set.
 */
function flattenTree(
  roots: WorkItem[],
  childrenOf: Map<number, WorkItem[]>,
  expanded: Set<number>,
  visible: Set<number> | null,
  searching: boolean,
): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (nodes: WorkItem[], depth: number, ancestors: Set<number>) => {
    nodes.forEach((item, i) => {
      if (ancestors.has(item.id)) return;
      const all = childrenOf.get(item.id) ?? [];
      const children = visible ? all.filter((c) => visible.has(c.id)) : all;
      const hasChildren = children.length > 0;
      const isOpen = hasChildren && (searching || expanded.has(item.id));
      rows.push({
        item,
        depth,
        pos: i + 1,
        setSize: nodes.length,
        childCount: children.length,
        hasChildren,
        isOpen,
      });
      if (isOpen) walk(children, depth + 1, new Set(ancestors).add(item.id));
    });
  };
  walk(roots, 0, new Set());
  return rows;
}

export function HierarchyView() {
  const scope = useBoardStore((s) => s.scope);
  const search = useBoardStore((s) => s.search);
  const select = useBoardStore((s) => s.select);
  const { data: items, isLoading, isError, error, refetch, isFetching } = useBoardItems();
  const { data: columnsData } = useColumns();

  const typeColors = useMemo(
    () => new Map((columnsData?.types ?? []).map((t) => [t.name, t.color] as const)),
    [columnsData],
  );
  const stateColors = useMemo(
    () =>
      new Map((columnsData?.columns ?? []).map((c) => [c.name.toLowerCase(), c.color] as const)),
    [columnsData],
  );

  const { byId, childrenOf, roots } = useMemo(() => buildTree(items ?? []), [items]);

  const q = search.trim().toLowerCase();

  // When searching, reveal every match plus its full ancestor path so the
  // matched node stays reachable in the tree.
  const visible = useMemo<Set<number> | null>(() => {
    if (!q) return null;
    const vis = new Set<number>();
    for (const it of items ?? []) {
      if (!matchesSearch(it, q)) continue;
      vis.add(it.id);
      let pid = it.parentId;
      while (pid != null && byId.has(pid)) {
        if (vis.has(pid)) break;
        vis.add(pid);
        pid = byId.get(pid)!.parentId;
      }
    }
    return vis;
  }, [q, items, byId]);

  const visibleRoots = useMemo(
    () => (visible ? roots.filter((r) => visible.has(r.id)) : roots),
    [roots, visible],
  );

  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const parentIds = useMemo(() => [...childrenOf.keys()], [childrenOf]);
  const expandAll = useCallback(() => setExpanded(new Set(parentIds)), [parentIds]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  // Flatten the visible tree, then virtualize so deep/wide forests stay smooth.
  const flatRows = useMemo(
    () => flattenTree(visibleRoots, childrenOf, expanded, visible, !!q),
    [visibleRoots, childrenOf, expanded, visible, q],
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  const truncated = (items?.length ?? 0) >= MAX_BOARD_ITEMS;
  const failedTypes = columnsData?.failedTypes ?? [];

  // --- non-tree states (mirror the board) ---
  if ((scope.id === "sprint" || scope.id === "area") && !scope.arg) {
    return (
      <Empty
        icon={<CalendarRange size={26} />}
        title={scope.id === "sprint" ? "Pick a sprint" : "Choose an area"}
        subtitle={
          scope.id === "sprint"
            ? "Select a sprint from the sidebar to see its hierarchy."
            : "Set an area path to filter the hierarchy."
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
        title="Couldn't load the hierarchy"
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

  if (visibleRoots.length === 0) {
    return (
      <Empty
        icon={<Inbox size={26} />}
        title="No matches"
        subtitle="No work items match your search in this view."
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-xs text-faint">
          {visibleRoots.length} top-level item{visibleRoots.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            disabled={parentIds.length === 0 || !!q}
          >
            <ChevronsUpDown size={14} /> Expand all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            disabled={parentIds.length === 0 || !!q}
          >
            <ChevronsDownUp size={14} /> Collapse all
          </Button>
        </div>
      </div>

      {(truncated || failedTypes.length > 0) && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-200/90">
          <AlertTriangle size={13} className="shrink-0" />
          <span className="truncate">
            {truncated && `Showing the first ${MAX_BOARD_ITEMS} items — narrow the scope to see all. `}
            {failedTypes.length > 0 &&
              `Some states may be missing for ${failedTypes.join(", ")}.`}
          </span>
        </div>
      )}

      <div ref={scrollRef} role="tree" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((v) => {
            const row = flatRows[v.index];
            return (
              <div
                key={row.item.id}
                data-index={v.index}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${v.start}px)` }}
              >
                <TreeRow
                  row={row}
                  toggle={toggle}
                  typeColors={typeColors}
                  stateColors={stateColors}
                  onOpen={select}
                />
              </div>
            );
          })}
        </div>
      </div>

      {isFetching && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1 text-xs text-muted shadow-lg">
            <Spinner className="h-3 w-3" /> Syncing…
          </span>
        </div>
      )}
    </div>
  );
}

interface TreeRowProps {
  row: FlatRow;
  toggle: (id: number) => void;
  typeColors: Map<string, string | undefined>;
  stateColors: Map<string, string | undefined>;
  onOpen: (id: number) => void;
}

function TreeRow({ row, toggle, typeColors, stateColors, onOpen }: TreeRowProps) {
  const { item, depth, pos, setSize, childCount, hasChildren, isOpen } = row;
  const priority = item.priority ? PRIORITY_LABEL[item.priority] : undefined;
  const stateColor = adoColor(stateColors.get(item.state.toLowerCase()), "#6b6e78");

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-setsize={setSize}
      aria-posinset={pos}
      aria-expanded={hasChildren ? isOpen : undefined}
      onClick={() => onOpen(item.id)}
      className="group flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 transition-colors hover:bg-surface-2"
      style={{ paddingLeft: depth * 20 + 6 }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            toggle(item.id);
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-faint hover:bg-elevated hover:text-fg disabled:hover:bg-transparent"
        >
          <ChevronRight size={14} className={cn("transition-transform", isOpen && "rotate-90")} />
        </button>
      ) : (
        <span className="h-5 w-5 shrink-0" />
      )}

      <span
        className="h-2 w-2 shrink-0 rounded-[3px]"
        style={{ backgroundColor: adoColor(typeColors.get(item.type), "#5b6cff") }}
        title={item.type}
      />

      <span className="shrink-0 text-[11px] font-medium text-faint">
        {item.type} · #{item.id}
      </span>

      <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{item.title}</span>

      {hasChildren && !isOpen && (
        <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10px] leading-5 text-faint">
          {childCount}
        </span>
      )}

      {priority && (
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${priority.color}22`, color: priority.color }}
        >
          {priority.label}
        </span>
      )}

      <Badge color={stateColor} className="shrink-0">
        {item.state}
      </Badge>

      <Avatar user={item.assignee} size={20} className="shrink-0" />
    </div>
  );
}
