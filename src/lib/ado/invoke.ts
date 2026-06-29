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
  /** Max automatic retries for transient throttling (429/503). Defaults to 3. */
  maxRetries?: number;
}

/** HTTP statuses worth retrying with backoff (throttling / transient outage). */
const RETRYABLE = new Set([429, 503]);
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Backoff for attempt N (0-based). Honors a server `Retry-After` (seconds,
 * capped at 60s), else exponential (500ms, 1s, 2s, …) capped at 8s with ±20%
 * jitter to avoid thundering-herd retries.
 */
function backoffMs(attempt: number, retryAfter?: number): number {
  if (typeof retryAfter === "number" && Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 60_000);
  }
  const base = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

/** Best-effort `Retry-After` (seconds) parse from an ADO error body. */
function retryAfterSeconds(body: unknown): number | undefined {
  if (body && typeof body === "object") {
    const v = (body as Record<string, unknown>).retryAfter ?? (body as Record<string, unknown>)["Retry-After"];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
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
 *
 * Transient throttling (429) and unavailability (503) are retried centrally
 * with exponential backoff (honoring `Retry-After` when ADO sends it) so a
 * busy/large org degrades gracefully instead of failing loads outright.
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

  const maxRetries = init.maxRetries ?? 3;
  for (let attempt = 0; ; attempt++) {
    const res = await invoke<AdoResponse<T>>(command, args);
    // ADO answers a bad/expired PAT with 203 + an HTML sign-in page (sometimes
    // even on a 2xx), so treat those as auth failures the client can react to.
    const htmlSignIn = typeof res.body === "string" && /<html|<!doctype/i.test(res.body);
    if (res.ok && !htmlSignIn) return res.body;
    if (RETRYABLE.has(res.status) && attempt < maxRetries) {
      await sleep(backoffMs(attempt, retryAfterSeconds(res.body)));
      continue;
    }
    const status = res.ok && htmlSignIn ? 203 : res.status;
    throw new AdoError(extractMessage(status, res.body), status, res.body);
  }
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
