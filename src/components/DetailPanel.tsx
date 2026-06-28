import { useEffect, useState, type ReactNode } from "react";
import {
  X,
  ExternalLink,
  GitPullRequest,
  GitBranch,
  GitCommitHorizontal,
  Link2,
  CornerLeftUp,
  Send,
  Trash2,
} from "lucide-react";
import { useBoardStore } from "@/store/board";
import { useComments, useColumns, useIterations, useWorkItemDetail } from "@/hooks/queries";
import { useAddComment, useDeleteWorkItem, useUpdateWorkItem } from "@/hooks/mutations";
import {
  FIELD,
  setField,
  parseDevLinks,
  assignOps,
  type AdoPatchOp,
  type DevLink,
  type WorkItem,
} from "@/lib/ado";
import { cn, formatDate } from "@/lib/utils";
import { openExternal } from "@/lib/open";
import { AssigneePicker } from "@/components/AssigneePicker";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DetailPanel() {
  const selectedId = useBoardStore((s) => s.selectedId);
  const select = useBoardStore((s) => s.select);
  const open = selectedId != null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => select(null)}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-40 flex h-full w-[460px] max-w-[92vw] flex-col border-l border-border bg-surface shadow-2xl shadow-black/50 transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {open && selectedId != null && (
          <DetailContent id={selectedId} onClose={() => select(null)} />
        )}
      </aside>
    </>
  );
}

const DEV_ICON: Record<DevLink["kind"], typeof GitBranch> = {
  pullRequest: GitPullRequest,
  branch: GitBranch,
  commit: GitCommitHorizontal,
  hyperlink: Link2,
};

function DetailContent({ id, onClose }: { id: number; onClose: () => void }) {
  const select = useBoardStore((s) => s.select);
  const { data: item, isLoading, isError, error } = useWorkItemDetail(id);
  const { data: columnsData } = useColumns();
  const { data: iterations } = useIterations();
  const { data: comments } = useComments(id);
  const update = useUpdateWorkItem();
  const addComment = useAddComment(id);
  const del = useDeleteWorkItem();

  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [editingTags, setEditingTags] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (item) {
      setTitleDraft(item.title);
      setDescDraft(item.descriptionHtml ?? "");
      setTagsDraft(item.tags.join(", "));
    }
  }, [item]);

  function save(ops: AdoPatchOp[]) {
    if (ops.length) update.mutate({ id, ops });
  }

  async function handleDelete() {
    try {
      await del.mutateAsync(id);
      setConfirmDelete(false);
      onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (isError || !item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-danger">{(error as Error)?.message ?? "Failed to load."}</p>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const devLinks = parseDevLinks(item.raw.relations);
  const stateOptions = columnsData?.columns ?? [{ name: item.state }];

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-xs font-medium text-faint">
          {item.type} · #{item.id}
        </span>
        {update.isPending && <Spinner className="h-3 w-3" />}
        <div className="ml-auto flex items-center gap-1">
          {item.url && (
            <Button variant="ghost" size="icon" title="Open in Azure DevOps" onClick={() => openExternal(item.url!)}>
              <ExternalLink size={15} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Delete work item"
            className="text-faint hover:bg-danger/10 hover:text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} />
          </Button>
          <Button variant="ghost" size="icon" title="Close" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Title */}
        <Textarea
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            const next = titleDraft.trim();
            if (next && next !== item.title) save([setField(FIELD.Title, next)]);
          }}
          rows={2}
          className="min-h-0 resize-none border-transparent bg-transparent px-0 text-base font-semibold focus-visible:border-transparent focus-visible:ring-0"
        />

        {/* Quick fields */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <Select value={item.state} onValueChange={(v) => save([setField(FIELD.State, v)])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Priority">
            <Select
              value={item.priority ? String(item.priority) : ""}
              onValueChange={(v) => save([setField(FIELD.Priority, Number(v))])}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Assignee">
            <AssigneePicker
              value={item.assignee}
              onChange={(user) => save(assignOps(user))}
            />
          </Field>

          <Field label="Iteration">
            <Select
              value={item.iterationPath ?? ""}
              onValueChange={(v) => save([setField(FIELD.IterationPath, v)])}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {(iterations ?? []).map((it) => (
                  <SelectItem key={it.id} value={it.path}>
                    {it.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {item.parentId && (
          <button
            onClick={() => select(item.parentId!)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"
          >
            <CornerLeftUp size={13} /> Parent · #{item.parentId}
          </button>
        )}

        {/* Tags */}
        <Field label="Tags">
          {editingTags ? (
            <Input
              autoFocus
              value={tagsDraft}
              onChange={(e) => setTagsDraft(e.target.value)}
              onBlur={() => {
                setEditingTags(false);
                const list = tagsDraft.split(/[;,]/).map((t) => t.trim()).filter(Boolean);
                if (list.join("; ") !== item.tags.join("; ")) {
                  save([setField(FIELD.Tags, list.join("; "))]);
                }
              }}
              placeholder="comma separated"
            />
          ) : (
            <div
              className="flex min-h-9 cursor-text flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5"
              onClick={() => setEditingTags(true)}
            >
              {item.tags.length ? (
                item.tags.map((t) => <Badge key={t}>{t}</Badge>)
              ) : (
                <span className="text-sm text-faint">Add tags…</span>
              )}
            </div>
          )}
        </Field>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Description</Label>
            <button
              className="text-xs text-muted hover:text-fg"
              onClick={() => {
                if (editingDesc) {
                  if (descDraft !== (item.descriptionHtml ?? "")) {
                    save([setField(FIELD.Description, descDraft)]);
                  }
                }
                setEditingDesc((v) => !v);
              }}
            >
              {editingDesc ? "Save" : "Edit"}
            </button>
          </div>
          {editingDesc ? (
            <Textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={6}
              placeholder="Supports HTML…"
            />
          ) : item.descriptionHtml ? (
            <div className="ado-html" dangerouslySetInnerHTML={{ __html: item.descriptionHtml }} />
          ) : (
            <p className="text-sm text-faint">No description.</p>
          )}
        </div>

        {/* Development links */}
        {devLinks.length > 0 && (
          <div className="space-y-1.5">
            <Label>Development</Label>
            <div className="space-y-1">
              {devLinks.map((link, i) => {
                const Icon = DEV_ICON[link.kind];
                return (
                  <button
                    key={i}
                    disabled={!link.url}
                    onClick={() => link.url && openExternal(link.url)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-left text-sm",
                      link.url ? "hover:border-border-strong hover:bg-elevated" : "cursor-default",
                    )}
                  >
                    <Icon size={14} className="shrink-0 text-faint" />
                    <span className="truncate text-fg">{link.label}</span>
                    {link.url && <ExternalLink size={12} className="ml-auto shrink-0 text-faint" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label>Comments {comments?.length ? `· ${comments.length}` : ""}</Label>
          <div className="space-y-3">
            {(comments ?? []).map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar user={c.createdBy} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-fg">
                      {c.createdBy?.displayName ?? "Someone"}
                    </span>
                    <span className="text-[11px] text-faint">{formatDate(c.createdDate)}</span>
                  </div>
                  <div
                    className="ado-html mt-0.5 text-[13px]"
                    dangerouslySetInnerHTML={{ __html: c.text }}
                  />
                </div>
              </div>
            ))}
            {comments && comments.length === 0 && (
              <p className="text-sm text-faint">No comments yet.</p>
            )}
          </div>

          <CommentBox
            value={commentDraft}
            onChange={setCommentDraft}
            pending={addComment.isPending}
            onSend={async () => {
              const text = commentDraft.trim();
              if (!text) return;
              await addComment.mutateAsync(text).catch(() => {});
              setCommentDraft("");
            }}
          />
        </div>

        <FooterMeta item={item} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${item.type} #${item.id}?`}
        description={
          <>
            <span className="font-medium text-fg">{item.title}</span> will be moved to the Azure
            DevOps recycle bin. You can restore it from there if needed.
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        variant="danger"
        pending={del.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CommentBox({
  value,
  onChange,
  onSend,
  pending,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-end gap-2 pt-1">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Write a comment…"
        className="min-h-0"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSend();
        }}
      />
      <Button size="icon" onClick={onSend} disabled={pending || !value.trim()} title="Send (⌘↵)">
        {pending ? <Spinner className="h-4 w-4" /> : <Send size={15} />}
      </Button>
    </div>
  );
}

function FooterMeta({ item }: { item: WorkItem }) {
  return (
    <div className="border-t border-border pt-3 text-[11px] text-faint">
      <span>Created {formatDate(item.createdDate)}</span>
      {item.createdBy?.displayName && <span> by {item.createdBy.displayName}</span>}
      {item.changedDate && <span> · Updated {formatDate(item.changedDate)}</span>}
    </div>
  );
}
