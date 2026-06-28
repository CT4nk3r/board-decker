import { useDroppable } from "@dnd-kit/core";
import type { AdoState, WorkItem } from "@/lib/ado";
import { cn, adoColor } from "@/lib/utils";
import { WorkItemCard } from "@/components/WorkItemCard";

interface ColumnProps {
  column: AdoState;
  items: WorkItem[];
  typeColors: Map<string, string | undefined>;
  onOpen: (id: number) => void;
}

export function Column({ column, items, typeColors, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.name });
  const dot = adoColor(column.color, "#6b6e78");

  return (
    <div className="flex h-full w-[290px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot }} />
        <h3 className="text-[13px] font-semibold text-fg">{column.name}</h3>
        <span className="text-xs text-faint">{items.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto rounded-lg border border-transparent p-1.5 transition-colors",
          isOver && "border-dashed border-accent/50 bg-accent/5",
        )}
      >
        {items.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            typeColor={typeColors.get(item.type)}
            onOpen={onOpen}
          />
        ))}
        {items.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-faint">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
