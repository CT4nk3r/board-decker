/** ADO field reference names + JSON-Patch helpers for create/update. */

import type { AdoUser } from "./types";

export const FIELD = {
  Title: "System.Title",
  State: "System.State",
  WorkItemType: "System.WorkItemType",
  AssignedTo: "System.AssignedTo",
  Tags: "System.Tags",
  Description: "System.Description",
  ReproSteps: "Microsoft.VSTS.TCM.ReproSteps",
  Priority: "Microsoft.VSTS.Common.Priority",
  IterationPath: "System.IterationPath",
  AreaPath: "System.AreaPath",
  Parent: "System.Parent",
  CreatedBy: "System.CreatedBy",
  CreatedDate: "System.CreatedDate",
  ChangedDate: "System.ChangedDate",
} as const;

/** The media type ADO requires for create/update bodies. */
export const JSON_PATCH_CONTENT_TYPE = "application/json-patch+json";

/** A single Azure DevOps JSON-Patch operation. */
export interface AdoPatchOp {
  op: "add" | "replace" | "remove" | "test";
  path: string;
  value?: unknown;
  from?: string;
}

/** Set a field value (ADO uses `add` for both create and replace of fields). */
export function setField(refName: string, value: unknown): AdoPatchOp {
  return { op: "add", path: `/fields/${refName}`, value };
}

/**
 * Optimistic-concurrency guard: ADO rejects the patch (409/412) unless the item
 * is still at this revision. Prepend before field ops to detect lost updates.
 */
export function revTest(rev: number): AdoPatchOp {
  return { op: "test", path: "/rev", value: rev };
}

/** Convenience: patch op to change `System.State`. */
export function stateChangeOps(newState: string): AdoPatchOp[] {
  return [setField(FIELD.State, newState)];
}

/**
 * Patch op(s) to (re)assign a work item, or clear the assignee when `user` is
 * null. ADO resolves the identity from the unique name (UPN/email); an empty
 * string clears `System.AssignedTo`.
 */
export function assignOps(user: AdoUser | null): AdoPatchOp[] {
  const value = user ? (user.uniqueName ?? user.mail ?? user.displayName ?? "") : "";
  return [setField(FIELD.AssignedTo, value)];
}

/** Fields requested for board cards (keep this lean for fast batch loads). */
export const CARD_FIELDS: string[] = [
  FIELD.Title,
  FIELD.State,
  FIELD.WorkItemType,
  FIELD.AssignedTo,
  FIELD.Tags,
  FIELD.Priority,
  FIELD.IterationPath,
  FIELD.AreaPath,
  FIELD.Parent,
  FIELD.CreatedBy,
  FIELD.CreatedDate,
  FIELD.ChangedDate,
];
