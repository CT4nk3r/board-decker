import { cn, initials, colorFromString } from "@/lib/utils";
import type { AdoUser } from "@/lib/ado";

interface AvatarProps {
  user?: AdoUser | null;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * A small identity bubble rendered from initials. We deliberately avoid ADO's
 * avatar image URLs: they require authentication, and a bare <img> from the
 * webview (which never sees the PAT) would just render broken.
 */
export function Avatar({ user, size = 22, className, title }: AvatarProps) {
  const name = user?.displayName ?? user?.uniqueName ?? user?.mail;
  const label = title ?? name ?? "Unassigned";
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (!name) {
    return (
      <span
        style={dim}
        title="Unassigned"
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed border-border-strong text-faint",
          className,
        )}
      >
        <span style={{ fontSize: Math.round(size * 0.5) }}>·</span>
      </span>
    );
  }

  return (
    <span
      style={{ ...dim, backgroundColor: colorFromString(name) }}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
