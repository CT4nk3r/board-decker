// Browser mock of @tauri-apps/api/core for the Playwright harness. Records every
// invoke and answers ADO/PAT commands the UI relies on, so e2e can drive sign-out
// and detail rendering without a real Tauri backend. Board scenarios seed
// window.__board to serve types/states/items for the kanban harness; mutation
// specs route by URL and may force a comment failure via __adoMock.
interface SeedType { name: string; states: string[] | null }
interface SeedItem { id: number; title: string; state: string; type: string }

const ok = (body: unknown) => ({ status: 200, ok: true, body });

function adoBody(url: string, method: string, body?: { text?: string }): { status: number; ok: boolean; body: unknown } {
  const b = window.__board;
  if (b) {
    const stateMatch = url.match(/workitemtypes\/([^/]+)\/states/i);
    if (stateMatch) {
      const t = b.types.find((x) => x.name === decodeURIComponent(stateMatch[1]));
      if (!t || t.states === null) return { status: 500, ok: false, body: { message: "states failed" } };
      return ok({ value: t.states.map((name) => ({ name, stateCategory: "InProgress" })) });
    }
    if (/workitemtypes/i.test(url)) return ok({ value: b.types.map((t) => ({ name: t.name, color: "5b6cff" })) });
    if (/wiql/i.test(url) && method === "POST") return ok({ workItems: b.items.map((i) => ({ id: i.id })) });
    if (/workitemsbatch/i.test(url) && method === "POST") {
      return ok({
        value: b.items.map((i) => ({
          id: i.id,
          rev: 1,
          fields: { "System.Title": i.title, "System.State": i.state, "System.WorkItemType": i.type },
        })),
      });
    }
    return ok({ value: [] });
  }
  // Detail/create harness routing for the write-path specs.
  if (url.includes("/comments")) {
    if (method === "POST") {
      if (window.__adoMock?.failComment) return { status: 500, ok: false, body: { message: "send failed" } };
      return ok({ id: 1, text: body?.text ?? "" });
    }
    return ok({ comments: [] });
  }
  if (url.includes("/states")) return ok({ value: [{ name: "Active" }] });
  if (url.includes("/workitemtypes")) return ok({ value: [{ name: "Task" }] });
  if (url.includes("/workitems") && method === "POST")
    return ok({ id: 99, rev: 1, fields: { "System.Title": "New one", "System.State": "New", "System.WorkItemType": "Task" } });
  if (/workitems\/1\b/.test(url))
    return ok({ id: 1, rev: 3, fields: { "System.Title": "Demo item", "System.State": "Active", "System.WorkItemType": "Task" } });
  return ok({ value: [] });
}

export async function invoke<T = unknown>(cmd: string, args?: unknown): Promise<T> {
  window.__invokes = window.__invokes ?? [];
  window.__invokes.push(cmd);
  switch (cmd) {
    case "delete_pat":
    case "save_pat":
      return undefined as T;
    case "has_pat":
      return true as T;
    case "ado_request":
    case "ado_request_with_pat": {
      const a = (args ?? {}) as { url?: string; method?: string; body?: { text?: string } };
      return adoBody(String(a.url ?? ""), String(a.method ?? "GET"), a.body) as T;
    }
    case "ado_fetch_image":
      return { status: 200, ok: true, dataUrl: null } as T;
    default:
      return undefined as T;
  }
}

declare global {
  interface Window {
    __invokes?: string[];
    __adoHtml?: string;
    __pwned?: boolean;
    __board?: { types: SeedType[]; items: SeedItem[] };
    __adoMock?: { failComment?: boolean };
  }
}
