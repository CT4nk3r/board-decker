import type { ReactNode } from "react";

/** Centered empty/error/loading-adjacent state used by the board and tree views. */
export function Empty({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-muted">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {subtitle && <p className="mt-1 max-w-xs text-sm text-muted">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
