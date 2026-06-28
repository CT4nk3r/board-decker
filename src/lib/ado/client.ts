/**
 * High-level Azure DevOps client. Builds REST URLs (it knows org/project) and
 * routes every call through Rust via {@link adoRequest}, which attaches the PAT.
 * Ported in spirit from the ado-plane-sync `azureDevOps.ts` client.
 */

import { adoRequest, AdoError } from "./invoke";
import { mapWorkItem, normalizeAdoUser } from "./mapper";
import { CARD_FIELDS, JSON_PATCH_CONTENT_TYPE, type AdoPatchOp } from "./fields";
import type {
  AdoComment,
  AdoConnection,
  AdoIteration,
  AdoState,
  AdoUser,
  AdoWorkItem,
  AdoWorkItemType,
  WorkItem,
} from "./types";

const API = "7.0";
const COMMENTS_API = "7.0-preview.4";
const ADO_HOST = "https://dev.azure.com";

/**
 * Upper bound on work items loaded for a board scope. Broad scopes (`all`, etc.)
 * can match thousands of items; capping the WIQL result keeps the batch fetch and
 * render bounded. The board flags when a scope is truncated so users can narrow it.
 */
export const MAX_BOARD_ITEMS = 500;

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
  const project = await adoRequest<{ id?: unknown; name?: unknown }>({ method: "GET", url, pat });
  // A bad PAT can yield a 2xx HTML body that isn't a real project; require the
  // ADO project shape so onboarding can't be fooled into storing junk creds.
  if (!project || typeof project.id !== "string" || typeof project.name !== "string") {
    throw new AdoError("Authentication failed (check your PAT and its scopes).", 203, project);
  }
  return { id: project.id, name: project.name };
}

/** Run a WIQL query, returning the matching work item ids (in query order). */
export async function queryWorkItemIds(
  conn: AdoConnection,
  wiql: string,
  top = MAX_BOARD_ITEMS,
): Promise<number[]> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/wiql?$top=${top}`);
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
export async function loadBoardItems(
  conn: AdoConnection,
  wiql: string,
): Promise<WorkItem[]> {
  // Fetch one over the cap so a full page reliably signals truncation.
  const ids = (await queryWorkItemIds(conn, wiql, MAX_BOARD_ITEMS + 1)).slice(0, MAX_BOARD_ITEMS);
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

/** Delete a work item by id (moves it to the project's recycle bin). */
export async function deleteWorkItem(conn: AdoConnection, id: number): Promise<void> {
  const url = withVersion(`${projBase(conn)}/_apis/wit/workitems/${id}`);
  await adoRequest({ method: "DELETE", url });
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

/** A raw team member entry as returned by the teams/members endpoint. */
interface RawTeamMember {
  identity?: { isContainer?: boolean } & Record<string, unknown>;
}

/** ADO's default page size for list endpoints; also the safe max for `$top`. */
const PAGE_SIZE = 100;

/**
 * Fetch every page of an ADO list endpoint. These endpoints cap results at 100
 * and require explicit `$top`/`$skip` paging, so we loop until a short page
 * signals the end. `baseUrl` must not yet carry an api-version.
 */
async function pagedAdoList<T>(baseUrl: string): Promise<T[]> {
  const out: T[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = withVersion(`${baseUrl}${sep}$top=${PAGE_SIZE}&$skip=${skip}`);
    const res = await adoRequest<{ value?: T[] }>({ method: "GET", url });
    const page = res.value ?? [];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

/** Teams defined in the project (used to gather the set of assignable people). */
export async function getTeams(conn: AdoConnection): Promise<{ id: string; name: string }[]> {
  return pagedAdoList<{ id: string; name: string }>(
    `${orgBase(conn)}/_apis/projects/${enc(conn.project)}/teams`,
  );
}

/** Members of a single team, normalized to {@link AdoUser} (groups excluded). */
export async function getTeamMembers(conn: AdoConnection, team: string): Promise<AdoUser[]> {
  const members = await pagedAdoList<RawTeamMember>(
    `${orgBase(conn)}/_apis/projects/${enc(conn.project)}/teams/${enc(team)}/members`,
  );
  return members
    .filter((m) => m.identity && !m.identity.isContainer)
    .map((m) => normalizeAdoUser(m.identity))
    .filter((u): u is AdoUser => u != null);
}

/**
 * Assignable people for the active workspace. When the connection pins a team we
 * return that team's members; otherwise we union the members of every team in the
 * project. Members are fetched with bounded concurrency, deduped by identity, and
 * sorted by display name. Throws only when *every* team lookup fails, so a partial
 * outage degrades gracefully while a total one surfaces instead of looking empty.
 */
export async function getProjectMembers(conn: AdoConnection): Promise<AdoUser[]> {
  const teams = conn.team ? [conn.team] : (await getTeams(conn)).map((t) => t.id);
  if (teams.length === 0) return [];

  const byKey = new Map<string, AdoUser>();
  let failures = 0;
  // Member fan-out runs against rate-limited list endpoints; keep it modest so
  // large orgs (many teams) don't trip 429s. adoRequest backs off on throttle.
  const CONCURRENCY = 4;

  for (let i = 0; i < teams.length; i += CONCURRENCY) {
    const batch = teams.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((team) => getTeamMembers(conn, team).then((members) => members, () => null)),
    );
    for (const members of results) {
      if (members === null) {
        failures++;
        continue;
      }
      for (const user of members) {
        const key = (user.id ?? user.uniqueName ?? user.displayName ?? "").toLowerCase();
        if (key && !byKey.has(key)) byKey.set(key, user);
      }
    }
  }

  if (failures === teams.length) {
    throw new Error("Couldn't load project members from Azure DevOps.");
  }

  return [...byKey.values()].sort((a, b) =>
    (a.displayName ?? a.uniqueName ?? "").localeCompare(b.displayName ?? b.uniqueName ?? ""),
  );
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
