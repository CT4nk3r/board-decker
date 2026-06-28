/** ADO domain types for Deck. Ported/adapted from the ado-plane-sync project. */

/** A user reference as it appears in ADO identity fields. */
export interface AdoUser {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  mail?: string;
  imageUrl?: string;
}

/** A work item relation (links: parent/child, PRs, branches, hyperlinks...). */
export interface AdoRelation {
  rel: string;
  url: string;
  attributes?: Record<string, unknown>;
}

/** The authoritative work item returned by the ADO REST API. */
export interface AdoWorkItem {
  id: number;
  rev: number;
  fields: Record<string, unknown>;
  relations?: AdoRelation[];
  url?: string;
  _links?: { html?: { href?: string } };
}

/** A connection to a single ADO org/project (the active workspace). */
export interface AdoConnection {
  org: string;
  project: string;
  /** Optional team for iteration (sprint) queries; defaults to project default team. */
  team?: string;
}

/** A work item type as defined by the project's process. */
export interface AdoWorkItemType {
  name: string;
  referenceName?: string;
  color?: string;
  icon?: { id?: string; url?: string };
  isDisabled?: boolean;
}

/** ADO state categories, in canonical board order. */
export type AdoStateCategory =
  | "Proposed"
  | "InProgress"
  | "Resolved"
  | "Completed"
  | "Removed";

/** A state definition for a work item type (a board column candidate). */
export interface AdoState {
  name: string;
  color?: string;
  category?: AdoStateCategory | string;
}

/** A team iteration (sprint). */
export interface AdoIteration {
  id: string;
  name: string;
  path: string;
  attributes?: { startDate?: string | null; finishDate?: string | null; timeFrame?: string };
}

/** A work item comment. */
export interface AdoComment {
  id: number;
  text: string;
  createdBy?: AdoUser;
  createdDate?: string;
  modifiedDate?: string;
}

/** Normalized, UI-friendly view of a work item used across the board. */
export interface WorkItem {
  id: number;
  rev: number;
  title: string;
  state: string;
  type: string;
  assignee: AdoUser | null;
  tags: string[];
  priority?: number;
  iterationPath?: string;
  iterationLeaf?: string;
  areaPath?: string;
  parentId?: number;
  descriptionHtml?: string;
  createdBy?: AdoUser;
  createdDate?: string;
  changedDate?: string;
  url?: string;
  raw: AdoWorkItem;
}

/** Canonical ordering weight for a state category (lower = earlier column). */
export const STATE_CATEGORY_ORDER: Record<string, number> = {
  Proposed: 0,
  InProgress: 1,
  Resolved: 2,
  Completed: 3,
  Removed: 4,
};
