/**
 * High-level Azure DevOps client. Builds REST URLs (it knows org/project) and
 * routes every call through Rust via {@link adoRequest}, which attaches the PAT.
 * Ported in spirit from the ado-plane-sync `azureDevOps.ts` client.
 */

import { adoRequest } from "./invoke";
import { mapWorkItem } from "./mapper";
import { CARD_FIELDS, JSON_PATCH_CONTENT_TYPE, type AdoPatchOp } from "./fields";
import type {
  AdoComment,
  AdoConnection,
  AdoIteration,
  AdoState,
  AdoWorkItem,
  AdoWorkItemType,
  WorkItem,
} from "./types";

const API = "7.0";
const COMMENTS_API = "7.0-preview.4";
const ADO_HOST = "https://dev.azure.com";

const enc = encodeURIComponent;

function orgBase(conn: AdoConnection): string {
  return `${ADO_HOST}/${enc(conn.org)}`;
}

function projBase(conn: AdoConnection): string {
  return `${orgBase(conn)}/${enc(conn.project)}`;
}

function withVersion(url: string, version = API): string {
  return url.includes("?") ? `${url}&api-version=${version}` : `${url}?api-version=${version}`;
}

/** Validate org/project/PAT during onboarding (PAT supplied inline). */
export async function validateConnection(
  conn: AdoConnection,
  pat: string,
): Promise<{ id: string; name: string }> {
  const url = withVersion(`${orgBase(conn)}/_apis/projects/${enc(conn.project)}`);
  const project = await adoRequest<{ id: string; name: string }>({ method: "GET", url, pat });
  return project;
}

/** Run a WIQL query, returning the matching work item ids (in query order). */
export async function queryWorkItemIds(conn: AdoConnection, wiql: string): Promise<number[]> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/wiql`);
  const res = await adoRequest<{ workItems?: { id?: number }[] }>({
    method: "POST",
    url,
    body: { query: wiql },
  });
  return (res.workItems ?? [])
    .map((w) => w.id)
    .filter((id): id is number => typeof id === "number");
}

/** Batch-fetch work items (chunked at 200) with the lean card field set. */
export async function getWorkItemsBatch(
  conn: AdoConnection,
  ids: number[],
  fields: string[] = CARD_FIELDS,
): Promise<AdoWorkItem[] > {
  if (ids.length === 0) return [];
  const url = withVersion(`${projBase(conn)}/_apis/wit/workitemsbatch`);
  const out: AdoWorkItem[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const res = await adoRequest<{ value?: AdoWorkItem[] }>({
      method: "POST",
      url,
      body: { ids: chunk, fields },
    });
    out.push(...(res.value ?? []));
  }
  return out;
}

/** Load and map work items for a WIQL query, preserving query order. */
export async function loadBoardItems(conn: AdoConnection, wiql: string): Promise<WorkItem[]> {
  const ids = await queryWorkItemIds(conn, wiql);
  if (ids.length === 0) return [];
  const items = await getWorkItemsBatch(conn, ids);
  const byId = new Map(items.map((w) => [w.id, w] as const));
  return ids
    .map((id) => byId.get(id))
    .filter((w): w is AdoWorkItem => Boolean(w))
    .map(mapWorkItem);
}

/** Full single work item with relations (for the detail panel). */
export async function getWorkItem(conn: AdoConnection, id: number): Promise<WorkItem> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/workitems/${id}?$expand=all`);
  const wi = await adoRequest<AdoWorkItem>({ method: "GET", url });
  return mapWorkItem(wi);
}

/** Create a work item of `type` from a JSON-Patch document. */
export async function createWorkItem(
  conn: AdoConnection,
  type: string,
  ops: AdoPatchOp[],
): Promise<WorkItem> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/workitems/$${enc(type)}`);
  const wi = await adoRequest<AdoWorkItem>({
    method: "POST",
    url,
    body: ops,
    contentType: JSON_PATCH_CONTENT_TYPE,
  });
  return mapWorkItem(wi);
}

/** Update a work item by id from a JSON-Patch document. */
export async function updateWorkItem(
  conn: AdoConnection,
  id: number,
  ops: AdoPatchOp[],
): Promise<WorkItem> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/workitems/${id}`);
  const wi = await adoRequest<AdoWorkItem>({
    method: "PATCH",
    url,
    body: ops,
    contentType: JSON_PATCH_CONTENT_TYPE,
  });
  return mapWorkItem(wi);
}

/** Work item types defined by the project's process. */
export async function getWorkItemTypes(conn: AdoConnection): Promise<AdoWorkItemType[]> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/workitemtypes`);
  const res = await adoRequest<{ value?: AdoWorkItemType[] }>({ method: "GET", url });
  return (res.value ?? []).filter((t) => !t.isDisabled);
}

/** Allowed states (board columns) for a work item type. */
export async function getStatesForType(
  conn: AdoConnection,
  type: string,
): Promise<AdoState[]> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/workitemtypes/${enc(type)}/states`);
  const res = await adoRequest<{
    value?: { name: string; color?: string; stateCategory?: string }[];
  }>({ method: "GET", url });
  return (res.value ?? []).map((s) => ({
    name: s.name,
    color: s.color,
    category: s.stateCategory,
  }));
}

/** Team iterations (sprints). Uses the project default team unless one is set. */
export async function getIterations(conn: AdoConnection): Promise<AdoIteration[]> {
  const teamSeg = conn.team ? `/${enc(conn.team)}` : "";
  const url = withVersion(`${orgBase(conn)}/${enc(conn.project)}${teamSeg}/_apis/work/teamsettings/iterations`);
  const res = await adoRequest<{ value?: AdoIteration[] }>({ method: "GET", url });
  return res.value ?? [];
}

/** Comments on a work item (newest API preview surface). */
export async function getComments(conn: AdoConnection, id: number): Promise<AdoComment[]> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/workItems/${id}/comments`, COMMENTS_API);
  const res = await adoRequest<{ comments?: AdoComment[] }>({ method: "GET", url });
  return res.comments ?? [];
}

/** Add a comment to a work item. */
export async function addComment(
  conn: AdoConnection,
  id: number,
  text: string,
): Promise<AdoComment> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/workItems/${id}/comments`, COMMENTS_API);
  return adoRequest<AdoComment>({ method: "POST", url, body: { text } });
}
