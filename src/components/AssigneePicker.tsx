import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { AdoUser } from "@/lib/ado";
import { useProjectMembers } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Stable identity key for comparing/deduping users across name variations. */
function userKey(user?: AdoUser | null): string {
  return (user?.id ?? user?.uniqueName ?? user?.displayName ?? "").toLowerCase();
}

function userLabel(user?: AdoUser | null): string {
  return user?.displayName ?? user?.uniqueName ?? user?.mail ?? "Unassigned";
}

interface AssigneePickerProps {
  value: AdoUser | null;
  onChange: (user: AdoUser | null) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A searchable people picker for `System.AssignedTo`. Lazily loads the project's
 * members when opened, filters them client-side, and offers an "Unassigned"
 * option to clear the field. Renders in a portal so it is never clipped by the
 * detail panel's scroll container.
 */
export function AssigneePicker({ value, onChange, disabled, className }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: members, isLoading, isError } = useProjectMembers(open);

  const filtered = useMemo(() => {
    const list = members ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      [u.displayName, u.uniqueName, u.mail].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [members, query]);

  const selectedKey = userKey(value);

  function choose(user: AdoUser | null) {
    setOpen(false);
    setQuery("");
    if (userKey(user) !== selectedKey) onChange(user);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-left text-sm outline-none",
            "hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50",
            className,
          )}
        >
          <Avatar user={value} size={20} />
          <span className={cn("truncate", value ? "text-fg" : "text-faint")}>
            {userLabel(value)}
          </span>
          <ChevronDown size={15} className="ml-auto shrink-0 text-faint" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0">
        <div className="border-b border-border p-1.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="w-full rounded-sm bg-transparent px-1.5 py-1 text-sm text-fg outline-none placeholder:text-faint"
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          <PickerRow
            avatar={<Avatar user={null} size={22} />}
            primary="Unassigned"
            selected={!value}
            onClick={() => choose(null)}
          />

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-faint">
              <Spinner className="h-4 w-4" /> Loading…
            </div>
          )}
          {isError && (
            <div className="px-2 py-3 text-sm text-danger">Couldn't load people.</div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="px-2 py-3 text-sm text-faint">No people found.</div>
          )}

          {filtered.map((user) => {
            const key = userKey(user);
            const secondary =
              user.uniqueName && user.uniqueName !== user.displayName ? user.uniqueName : undefined;
            return (
              <PickerRow
                key={key}
                avatar={<Avatar user={user} size={22} />}
                primary={user.displayName ?? user.uniqueName ?? "Unknown"}
                secondary={secondary}
                selected={key === selectedKey}
                onClick={() => choose(user)}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface PickerRowProps {
  avatar: ReactNode;
  primary: string;
  secondary?: string;
  selected?: boolean;
  onClick: () => void;
}

function PickerRow({ avatar, primary, secondary, selected, onClick }: PickerRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left outline-none",
        "hover:bg-accent/15 focus-visible:bg-accent/15",
      )}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fg">{primary}</span>
        {secondary && <span className="block truncate text-[11px] text-faint">{secondary}</span>}
      </span>
      {selected && <Check size={14} className="ml-auto shrink-0 text-accent" />}
    </button>
  );
}
