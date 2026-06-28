import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Optional dot/border color (e.g. an ADO state or tag color). */
  color?: string;
}

/** A small pill. When `color` is set it renders a subtle tinted chip. */
export function Badge({ className, color, style, children, ...props }: BadgeProps) {
  const tinted: React.CSSProperties | undefined = color
    ? { backgroundColor: `${color}1f`, color: color, borderColor: `${color}3d`, ...style }
    : style;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        !color && "border-border bg-surface-2 text-muted",
        className,
      )}
      style={tinted}
      {...props}
    >
      {children}
    </span>
  );
}
