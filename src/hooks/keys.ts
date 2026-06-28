/** Centralized React Query keys so queries and optimistic mutations stay in sync. */

import type { AdoConnection, ScopeSpec } from "@/lib/ado";

export const keys = {
  columns: (c: AdoConnection) => ["columns", c.org, c.project] as const,
  board: (c: AdoConnection, scope: ScopeSpec) =>
    ["board-items", c.org, c.project, scope.id, scope.arg ?? ""] as const,
  boardAll: (c: AdoConnection) => ["board-items", c.org, c.project] as const,
  workItem: (c: AdoConnection, id: number) => ["work-item", c.org, c.project, id] as const,
  comments: (c: AdoConnection, id: number) => ["comments", c.org, c.project, id] as const,
  iterations: (c: AdoConnection) => ["iterations", c.org, c.project, c.team ?? ""] as const,
};
