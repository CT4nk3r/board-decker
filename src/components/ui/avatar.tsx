import { useState } from "react";
import { cn, initials, colorFromString } from "@/lib/utils";
import { useAvatarImage } from "@/hooks/queries";
import type { AdoUser } from "@/lib/ado";

interface AvatarProps {
  user?: AdoUser | null;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * A small identity bubble. When the user has an ADO avatar URL we fetch the
 * image through Rust (which attaches the PAT) and render it as a base64 data
 * URL — the webview can't authenticate to ADO itself. We fall back to an
 * initials bubble while the image loads, on error, or when no URL is available.
 */
export function Avatar({ user, size = 22, className, title }: AvatarProps) {
  const name = user?.displayName ?? user?.uniqueName ?? user?.mail;
  const label = title ?? name ?? "Unassigned";
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  const [imgError, setImgError] = useState(false);
  const { data: dataUrl } = useAvatarImage(name ? user?.imageUrl : undefined);

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

  if (dataUrl && !imgError) {
    return (
      <img
        src={dataUrl}
        alt={label}
        title={label}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        className={cn("inline-block shrink-0 rounded-full object-cover", className)}
        style={dim}
      />
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
