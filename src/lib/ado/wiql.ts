/**
 * Scope -> Azure DevOps WIQL. Ported from the ado-plane-sync project's
 * `azureDevOpsBackfill.ts`. These are the preset "filter buttons" for the board.
 * `@Me` / `@project` / `@Today` are ADO server-side macros. Pure + testable.
 */

const DONE_STATES = ["Done", "Closed", "Removed", "Resolved", "Completed"];

export type ScopeId =
  | "assigned-to-me"
  | "created-by-me"
  | "active"
  | "recent"
  | "sprint"
  | "area"
  | "all";

export interface ScopeSpec {
  id: ScopeId;
  /** Optional argument (sprint/area name, recent days). */
  arg?: string;
}

/** Human-readable labels for the scope picker. */
export const SCOPE_LABELS: Record<ScopeId, string> = {
  "assigned-to-me": "Assigned to me",
  "created-by-me": "Created by me",
  active: "Active",
  recent: "Recently changed",
  sprint: "Current sprint",
  area: "By area",
  all: "All",
};

/** Escape single quotes for a WIQL string literal. */
function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Build a WIQL query selecting work item ids for the given scope.
 * Throws on a missing required argument.
 */
export function buildWorkItemWiql(scope: ScopeSpec, project: string): string {
  const base =
    "SELECT [System.Id] FROM workitems WHERE [System.TeamProject] = @project";
  const order = " ORDER BY [System.ChangedDate] DESC";
  let clause = "";

  switch (scope.id) {
    case "assigned-to-me":
      clause = " AND [System.AssignedTo] = @Me";
      break;
    case "created-by-me":
      clause = " AND [System.CreatedBy] = @Me";
      break;
    case "active":
      clause = ` AND [System.State] NOT IN (${DONE_STATES.map((s) => `'${s}'`).join(", ")})`;
      break;
    case "recent": {
      const days = scope.arg ? Number(scope.arg) : 14;
      if (!Number.isFinite(days) || days <= 0) {
        throw new Error("recent: days must be a positive number");
      }
      clause = ` AND [System.ChangedDate] >= @Today - ${Math.floor(days)}`;
      break;
    }
    case "sprint":
      if (!scope.arg) throw new Error("Select a sprint first.");
      clause = ` AND [System.IterationPath] UNDER '${esc(project)}\\${esc(scope.arg)}'`;
      break;
    case "area":
      if (!scope.arg) throw new Error("Enter an area path first.");
      clause = ` AND [System.AreaPath] UNDER '${esc(project)}\\${esc(scope.arg)}'`;
      break;
    case "all":
      clause = "";
      break;
    default:
      throw new Error(`Unknown scope "${(scope as ScopeSpec).id}"`);
  }

  // Exclude the Removed bucket from the board by default for the broad scopes
  // so deleted-ish items don't clutter columns (Active already excludes them).
  return `${base}${clause}${order}`;
}
