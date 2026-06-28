import { useMemo } from "react";
import { User, Activity, Clock, PenLine, Layers, LogOut, CalendarRange, X } from "lucide-react";
import { useConnectionStore } from "@/store/connection";
import { useBoardStore } from "@/store/board";
import { useIterations } from "@/hooks/queries";
import { deletePat, type ScopeId } from "@/lib/ado";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NAV: { id: ScopeId; label: string; icon: typeof User }[] = [
  { id: "assigned-to-me", label: "Assigned to me", icon: User },
  { id: "active", label: "Active", icon: Activity },
  { id: "recent", label: "Recently changed", icon: Clock },
  { id: "created-by-me", label: "Created by me", icon: PenLine },
  { id: "all", label: "All items", icon: Layers },
];

/** Strip the leading "Project\" segment from an iteration path -> WIQL arg. */
function iterationArg(path: string, project: string): string {
  const parts = path.split("\\").filter(Boolean);
  if (parts[0]?.toLowerCase() === project.toLowerCase()) return parts.slice(1).join("\\");
  return parts.join("\\");
}

export function Sidebar() {
  const connection = useConnectionStore((s) => s.connection)!;
  const clear = useConnectionStore((s) => s.clear);
  const scope = useBoardStore((s) => s.scope);
  const setScope = useBoardStore((s) => s.setScope);
  const { data: iterations } = useIterations();

  const sprintOptions = useMemo(
    () =>
      (iterations ?? []).map((it) => ({
        value: iterationArg(it.path, connection.project),
        label: it.name,
        current: it.attributes?.timeFrame === "current",
      })),
    [iterations, connection.project],
  );

  async function signOut() {
    await deletePat().catch(() => {});
    clear();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <span className="text-sm font-bold">D</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{connection.project}</p>
          <p className="truncate text-xs text-faint">{connection.org}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">
          Views
        </p>
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = scope.id === id;
          return (
            <button
              key={id}
              onClick={() => setScope({ id })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                active ? "bg-accent-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon size={15} className={active ? "text-accent" : "text-faint"} />
              {label}
            </button>
          );
        })}

        <p className="px-2 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-faint">
          Sprint
        </p>
        <div className="flex items-center gap-1 px-1">
          <Select
            value={scope.id === "sprint" ? scope.arg : undefined}
            onValueChange={(value) => setScope({ id: "sprint", arg: value })}
          >
            <SelectTrigger className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarRange size={14} className="shrink-0 text-faint" />
                <SelectValue placeholder="Pick a sprint" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {sprintOptions.length === 0 && (
                <div className="px-2 py-2 text-xs text-faint">No iterations found</div>
              )}
              {sprintOptions.map((opt) => (
                <SelectItem key={opt.value || opt.label} value={opt.value || opt.label}>
                  <span className="flex items-center gap-2">
                    {opt.label}
                    {opt.current && (
                      <span className="rounded-full bg-success/20 px-1.5 py-px text-[10px] text-success">
                        current
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scope.id === "sprint" && (
            <button
              type="button"
              onClick={() => setScope({ id: "active" })}
              title="Clear sprint"
              aria-label="Clear sprint"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-faint transition-colors hover:border-border-strong hover:text-fg"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg"
        >
          <LogOut size={15} className="text-faint" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
