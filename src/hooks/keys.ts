/** Centralized React Query keys so queries and optimistic mutations stay in sync. */

import type { AdoConnection, ScopeSpec } from "@/lib/ado";

/** Identity/session component so cached data can't leak across sign-out/reconnect. */
const idOf = (c: AdoConnection) => c.identity ?? "anon";

export const keys = {
  columns: (c: AdoConnection) => ["columns", idOf(c), c.org, c.project] as const,
  board: (c: AdoConnection, scope: ScopeSpec) =>
    ["board-items", idOf(c), c.org, c.project, scope.id, scope.arg ?? ""] as const,
  boardAll: (c: AdoConnection) => ["board-items", idOf(c), c.org, c.project] as const,
  workItem: (c: AdoConnection, id: number) => ["work-item", idOf(c), c.org, c.project, id] as const,
  comments: (c: AdoConnection, id: number) => ["comments", idOf(c), c.org, c.project, id] as const,
  iterations: (c: AdoConnection) => ["iterations", idOf(c), c.org, c.project, c.team ?? ""] as const,
  members: (c: AdoConnection) => ["members", idOf(c), c.org, c.project, c.team ?? ""] as const,
  avatar: (c: AdoConnection, url: string) => ["avatar", idOf(c), url] as const,
};
