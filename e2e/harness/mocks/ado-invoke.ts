// Browser mock of @tauri-apps/api/core for the Playwright board harness. Routes
// the Rust `ado_request` command to data seeded on window.__board (set via
// addInitScript before load), so the real client/invoke stack runs unchanged.

interface SeedType {
  name: string;
  /** Allowed state names; `null` makes this type's states call fail (#22). */
  states: string[] | null;
}
interface SeedItem {
  id: number;
  title: string;
  state: string;
  type: string;
}
interface BoardSeed {
  types: SeedType[];
  items: SeedItem[];
}

declare global {
  interface Window {
    __board?: BoardSeed;
  }
}

const seed = (): BoardSeed => window.__board ?? { types: [], items: [] };

function adoBody(url: string, method: string): { status: number; ok: boolean; body: unknown } {
  const s = seed();
  const stateMatch = url.match(/workitemtypes\/([^/]+)\/states/i);
  if (stateMatch) {
    const type = s.types.find((t) => t.name === decodeURIComponent(stateMatch[1]));
    if (!type || type.states === null) return { status: 500, ok: false, body: { message: "states failed" } };
    return {
      status: 200,
      ok: true,
      body: { value: type.states.map((name) => ({ name, stateCategory: "InProgress" })) },
    };
  }
  if (/workitemtypes/i.test(url)) {
    return { status: 200, ok: true, body: { value: s.types.map((t) => ({ name: t.name, color: "5b6cff" })) } };
  }
  if (/wiql/i.test(url) && method === "POST") {
    return { status: 200, ok: true, body: { workItems: s.items.map((i) => ({ id: i.id })) } };
  }
  if (/workitemsbatch/i.test(url) && method === "POST") {
    return {
      status: 200,
      ok: true,
      body: {
        value: s.items.map((i) => ({
          id: i.id,
          rev: 1,
          fields: { "System.Title": i.title, "System.State": i.state, "System.WorkItemType": i.type },
        })),
      },
    };
  }
  return { status: 200, ok: true, body: {} };
}

export async function invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (command === "ado_request" || command === "ado_request_with_pat") {
    return adoBody(String(args?.url ?? ""), String(args?.method ?? "GET")) as T;
  }
  if (command === "ado_fetch_image") return { status: 404, ok: false, dataUrl: null } as T;
  if (command === "has_pat") return true as T;
  return undefined as T;
}
