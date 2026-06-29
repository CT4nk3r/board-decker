// Browser mock of @tauri-apps/api/core for the Playwright harness. Records every
// invoke and answers ADO/PAT commands the UI relies on, so e2e can drive sign-out
// and detail rendering without a real Tauri backend. Board scenarios seed
// window.__board to serve types/states/items for the kanban harness.
interface SeedType { name: string; states: string[] | null }
interface SeedItem { id: number; title: string; state: string; type: string }

function adoBody(url: string, method: string): { status: number; ok: boolean; body: unknown } {
  const b = window.__board;
  if (!b) return { status: 200, ok: true, body: { value: [] } };
  const stateMatch = url.match(/workitemtypes\/([^/]+)\/states/i);
  if (stateMatch) {
    const t = b.types.find((x) => x.name === decodeURIComponent(stateMatch[1]));
    if (!t || t.states === null) return { status: 500, ok: false, body: { message: "states failed" } };
    return { status: 200, ok: true, body: { value: t.states.map((name) => ({ name, stateCategory: "InProgress" })) } };
  }
  if (/workitemtypes/i.test(url)) {
    return { status: 200, ok: true, body: { value: b.types.map((t) => ({ name: t.name, color: "5b6cff" })) } };
  }
  if (/wiql/i.test(url) && method === "POST") {
    return { status: 200, ok: true, body: { workItems: b.items.map((i) => ({ id: i.id })) } };
  }
  if (/workitemsbatch/i.test(url) && method === "POST") {
    return {
      status: 200,
      ok: true,
      body: {
        value: b.items.map((i) => ({
          id: i.id,
          rev: 1,
          fields: { "System.Title": i.title, "System.State": i.state, "System.WorkItemType": i.type },
        })),
      },
    };
  }
  return { status: 200, ok: true, body: { value: [] } };
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
      const a = (args ?? {}) as { url?: string; method?: string };
      return adoBody(String(a.url ?? ""), String(a.method ?? "GET")) as T;
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
  }
}
