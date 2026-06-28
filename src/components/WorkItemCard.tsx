import { useDraggable } from "@dnd-kit/core";
import { GitBranch, PanelRight, ExternalLink, Trash2 } from "lucide-react";
import type { WorkItem } from "@/lib/ado";
import { cn, adoColor } from "@/lib/utils";
import { openExternal } from "@/lib/open";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "P1", color: "#f0506e" },
  2: { label: "P2", color: "#f4b740" },
};

interface BodyProps {
  item: WorkItem;
  typeColor?: string;
  dragging?: boolean;
  onClick?: () => void;
}

/** Presentational card body, shared by the draggable card and the drag overlay. */
export function WorkItemCardBody({ item, typeColor, dragging, onClick }: BodyProps) {
  const priority = item.priority ? PRIORITY_LABEL[item.priority] : undefined;
  const hasPr = item.raw.relations?.some(
    (r) => r.rel === "ArtifactLink" && /PullRequestId/i.test(r.url),
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-card border border-border bg-surface-2 p-2.5 text-left transition-colors",
        "hover:border-border-strong hover:bg-elevated",
        dragging && "rotate-[1.5deg] border-accent/60 shadow-2xl shadow-black/50",
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-[3px]"
          style={{ backgroundColor: adoColor(typeColor, "#5b6cff") }}
          title={item.type}
        />
        <span className="text-[11px] font-medium text-faint">
          {item.type} · #{item.id}
        </span>
        {hasPr && <GitBranch size={12} className="ml-auto text-faint" />}
      </div>

      <p className="line-clamp-3 text-[13px] font-medium leading-snug text-fg">{item.title}</p>

      {item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} className="px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {item.tags.length > 3 && (
            <span className="text-[10px] text-faint">+{item.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <div>
          {priority && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${priority.color}22`, color: priority.color }}
            >
              {priority.label}
            </span>
          )}
        </div>
        <Avatar user={item.assignee} size={20} />
      </div>
    </div>
  );
}

interface CardProps {
  item: WorkItem;
  typeColor?: string;
  onOpen: (id: number) => void;
  onDelete: (item: WorkItem) => void;
}

/** Draggable board card with a right-click context menu. */
export function WorkItemCard({ item, typeColor, onOpen, onDelete }: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          className={cn("touch-none outline-none", isDragging && "opacity-40")}
        >
          <WorkItemCardBody item={item} typeColor={typeColor} onClick={() => onOpen(item.id)} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onOpen(item.id)}>
          <PanelRight /> Open details
        </ContextMenuItem>
        {item.url && (
          <ContextMenuItem onSelect={() => openExternal(item.url!)}>
            <ExternalLink /> Open in Azure DevOps
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="danger" onSelect={() => onDelete(item)}>
          <Trash2 /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
