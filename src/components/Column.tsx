import { useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AdoState, WorkItem } from "@/lib/ado";
import { cn, adoColor } from "@/lib/utils";
import { WorkItemCard } from "@/components/WorkItemCard";

interface ColumnProps {
  column: AdoState;
  items: WorkItem[];
  typeColors: Map<string, string | undefined>;
  /** True while dragging a card whose type can't transition to this column. */
  disabled?: boolean;
  onOpen: (id: number) => void;
  onDelete: (item: WorkItem) => void;
}

/** Estimated card height (incl. gap) used until rows self-measure. */
const CARD_ESTIMATE = 96;

export function Column({ column, items, typeColors, disabled, onOpen, onDelete }: ColumnProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: column.name, disabled });
  const dot = adoColor(column.color, "#6b6e78");

  // Only render the cards in view so columns with thousands of items stay smooth.
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_ESTIMATE,
    overscan: 8,
  });

  const setRefs = (el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setNodeRef(el);
  };

  return (
    <div className={cn("flex h-full w-[290px] shrink-0 flex-col", disabled && "opacity-40")}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot }} />
        <h3 className="text-[13px] font-semibold text-fg">{column.name}</h3>
        <span className="text-xs text-faint">{items.length}</span>
      </div>

      <div
        ref={setRefs}
        className={cn(
          "flex-1 overflow-y-auto rounded-lg border border-transparent p-1.5 transition-colors",
          isOver && !disabled && "border-dashed border-accent/50 bg-accent/5",
        )}
      >
        {items.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-faint">
            Drop here
          </div>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((v) => {
              const item = items[v.index];
              return (
                <div
                  key={item.id}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full pb-2"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  <WorkItemCard
                    item={item}
                    typeColor={typeColors.get(item.type)}
                    onOpen={onOpen}
                    onDelete={onDelete}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
