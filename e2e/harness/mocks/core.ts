// Browser mock of @tauri-apps/api/core for the Playwright harness. Records
// every invoke and answers the ADO/PAT commands the security UI relies on, so
// e2e can drive sign-out and detail rendering without a real Tauri backend.
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
    case "ado_request_with_pat":
      return { status: 200, ok: true, body: { value: [] } } as T;
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
  }
}
