import { Search, Plus, RefreshCw, SquareKanban, ListTree } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnectionStore } from "@/store/connection";
import { useBoardStore } from "@/store/board";
import { useBoardItems } from "@/hooks/queries";
import { keys } from "@/hooks/keys";
import { SCOPE_LABELS } from "@/lib/ado";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UpdateButton } from "@/components/UpdateButton";

const VIEW_OPTIONS = [
  { id: "board", label: "Board", icon: SquareKanban },
  { id: "tree", label: "Tree", icon: ListTree },
] as const;

export function TopBar() {
  const connection = useConnectionStore((s) => s.connection)!;
  const scope = useBoardStore((s) => s.scope);
  const view = useBoardStore((s) => s.view);
  const setView = useBoardStore((s) => s.setView);
  const search = useBoardStore((s) => s.search);
  const setSearch = useBoardStore((s) => s.setSearch);
  const setCreateOpen = useBoardStore((s) => s.setCreateOpen);
  const qc = useQueryClient();
  const { data: items, isFetching } = useBoardItems();

  const title =
    scope.id === "sprint"
      ? scope.arg ?? "Sprint"
      : scope.id === "area"
        ? `Area · ${scope.arg ?? ""}`
        : SCOPE_LABELS[scope.id];

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="truncate text-[15px] font-semibold">{title}</h2>
        {items && (
          <span className="shrink-0 text-xs text-faint">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5">
        {VIEW_OPTIONS.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={active}
              title={`${label} view`}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                active ? "bg-elevated text-fg shadow-sm" : "text-faint hover:text-fg",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <UpdateButton />

        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-8 w-52 pl-8"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          title="Refresh"
          onClick={() => qc.invalidateQueries({ queryKey: keys.boardAll(connection) })}
        >
          <RefreshCw size={15} className={cn(isFetching && "animate-spin")} />
        </Button>

        <Button onClick={() => setCreateOpen(true)} size="md">
          <Plus size={16} /> New
        </Button>
      </div>
    </header>
  );
}
