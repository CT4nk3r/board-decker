import { invoke } from "@tauri-apps/api/core";

/** Shape returned by the Rust `ado_request` / `ado_request_with_pat` commands. */
export interface AdoResponse<T = unknown> {
  status: number;
  ok: boolean;
  body: T;
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface AdoRequestInit {
  method: HttpMethod;
  url: string;
  body?: unknown;
  /** Defaults to application/json; pass the JSON-Patch media type for PATCH/create. */
  contentType?: string;
  /** When provided, validates with this PAT inline (onboarding) instead of the keychain. */
  pat?: string;
}

/** Error carrying the HTTP status and best-effort ADO message. */
export class AdoError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AdoError";
    this.status = status;
    this.body = body;
  }
}

function extractMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const m = (body as Record<string, unknown>).message;
    if (typeof m === "string" && m.trim()) return m;
    const value = (body as Record<string, unknown>).value;
    if (value && typeof value === "object") {
      const vm = (value as Record<string, unknown>).Message ?? (value as Record<string, unknown>).message;
      if (typeof vm === "string" && vm.trim()) return vm;
    }
  }
  if (typeof body === "string" && body.trim()) {
    // ADO sometimes returns an HTML sign-in page for a bad/expired PAT.
    if (/<html/i.test(body)) return "Authentication failed (check your PAT and its scopes).";
    return body.slice(0, 300);
  }
  return `Request failed with HTTP ${status}.`;
}

/**
 * Low-level ADO request. Routes through Rust so the PAT (attached server-side)
 * never touches JS, and CORS does not apply. Throws {@link AdoError} on non-2xx.
 */
export async function adoRequest<T = unknown>(init: AdoRequestInit): Promise<T> {
  const command = init.pat ? "ado_request_with_pat" : "ado_request";
  const args: Record<string, unknown> = {
    method: init.method,
    url: init.url,
    body: init.body ?? null,
    contentType: init.contentType ?? null,
  };
  if (init.pat) args.pat = init.pat;

  const res = await invoke<AdoResponse<T>>(command, args);
  if (!res.ok) {
    throw new AdoError(extractMessage(res.status, res.body), res.status, res.body);
  }
  return res.body;
}

// --- Keychain PAT commands -------------------------------------------------

export function savePat(pat: string): Promise<void> {
  return invoke("save_pat", { pat });
}

export function hasPat(): Promise<boolean> {
  return invoke<boolean>("has_pat");
}

export function deletePat(): Promise<void> {
  return invoke("delete_pat");
}

/** Shape returned by the Rust `ado_fetch_image` command. */
interface AdoImageResponse {
  status: number;
  ok: boolean;
  dataUrl: string | null;
}

/**
 * Fetch an ADO avatar image through Rust (which attaches the PAT) and return it
 * as a base64 `data:` URL the webview can render. Resolves to `null` when the
 * image is missing/unauthorized so callers can fall back to initials.
 */
export async function fetchAdoImage(url: string): Promise<string | null> {
  const res = await invoke<AdoImageResponse>("ado_fetch_image", { url });
  return res.ok ? res.dataUrl : null;
}
