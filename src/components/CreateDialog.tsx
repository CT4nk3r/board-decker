import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useBoardStore } from "@/store/board";
import { useConnectionStore } from "@/store/connection";
import { useColumns } from "@/hooks/queries";
import { useCreateWorkItem } from "@/hooks/mutations";
import { FIELD, setField, type AdoPatchOp } from "@/lib/ado";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

const PRIORITIES = [
  { value: "1", label: "1 · Urgent" },
  { value: "2", label: "2 · High" },
  { value: "3", label: "3 · Medium" },
  { value: "4", label: "4 · Low" },
];

const PREFERRED = ["User Story", "Product Backlog Item", "Issue", "Task", "Bug"];

export function CreateDialog() {
  const open = useBoardStore((s) => s.createOpen);
  const setOpen = useBoardStore((s) => s.setCreateOpen);
  const scope = useBoardStore((s) => s.scope);
  const conn = useConnectionStore((s) => s.connection);
  const { data: columnsData } = useColumns();
  const create = useCreateWorkItem();

  const types = useMemo(() => columnsData?.types ?? [], [columnsData]);
  const defaultType = useMemo(() => {
    const names = types.map((t) => t.name);
    return PREFERRED.find((p) => names.includes(p)) ?? names[0] ?? "Task";
  }, [types]);

  const [type, setType] = useState(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [tags, setTags] = useState("");

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setType(defaultType);
      setTitle("");
      setDescription("");
      setPriority("");
      setTags("");
    }
  }, [open, defaultType]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const ops: AdoPatchOp[] = [setField(FIELD.Title, title.trim())];
    if (description.trim()) ops.push(setField(FIELD.Description, description.trim()));
    if (priority) ops.push(setField(FIELD.Priority, Number(priority)));
    const tagList = tags
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagList.length) ops.push(setField(FIELD.Tags, tagList.join("; ")));

    // Seed scope fields so the new item lands in the current view (e.g. the
    // selected sprint/area) instead of appearing only until the next refetch.
    const project = conn?.project;
    if (project && scope.arg) {
      if (scope.id === "sprint") ops.push(setField(FIELD.IterationPath, `${project}\\${scope.arg}`));
      if (scope.id === "area") ops.push(setField(FIELD.AreaPath, `${project}\\${scope.arg}`));
    }

    try {
      await create.mutateAsync({ type, ops });
      setOpen(false);
    } catch {
      /* error toast handled by the mutation */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New work item</DialogTitle>
            <DialogDescription>Create a work item directly in Azure DevOps.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-2">
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-title">Title</Label>
              <Input
                id="wi-title"
                autoFocus
                placeholder="What needs doing?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-desc">Description</Label>
              <Textarea
                id="wi-desc"
                placeholder="Add more detail…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-tags">Tags</Label>
              <Input
                id="wi-tags"
                placeholder="comma or semicolon separated"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || create.isPending}>
              {create.isPending ? (
                <>
                  <Spinner className="h-4 w-4" /> Creating…
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
