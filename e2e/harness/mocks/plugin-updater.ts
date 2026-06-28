// Browser mock of @tauri-apps/plugin-updater for the Playwright harness.
// Scenarios are driven entirely from window.__updaterMock, which the spec sets
// via page.addInitScript before the app loads.

export type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export interface Update {
  version: string;
  currentVersion: string;
  downloadAndInstall(onEvent?: (e: DownloadEvent) => void): Promise<void>;
}

export interface MockConfig {
  /** When true, check() resolves to null (no update available). */
  none?: boolean;
  version?: string;
  current?: string;
  /** Total bytes reported by the "Started" event. */
  total?: number;
  /** Bytes for the single "Progress" event — drives the displayed percentage. */
  chunk?: number;
  /** Leave the promise pending after this event so a state can be screenshotted. */
  freezeAfter?: "progress" | "finished" | null;
  /** Reject downloadAndInstall to exercise the error state. */
  fail?: boolean;
}

declare global {
  interface Window {
    __updaterMock?: MockConfig;
    __relaunched?: boolean;
  }
}

const cfg = (): MockConfig =>
  (typeof window !== "undefined" && window.__updaterMock) || {};

export async function check(): Promise<Update | null> {
  const c = cfg();
  if (c.none) return null;
  return {
    version: c.version ?? "1.0.0",
    currentVersion: c.current ?? "0.1.1",
    downloadAndInstall(onEvent) {
      const cur = cfg();
      if (cur.fail) return Promise.reject(new Error("mock download failure"));
      const total = cur.total ?? 100;
      const chunk = cur.chunk ?? total;
      onEvent?.({ event: "Started", data: { contentLength: total } });
      onEvent?.({ event: "Progress", data: { chunkLength: chunk } });
      if (cur.freezeAfter === "progress") return new Promise<void>(() => {});
      onEvent?.({ event: "Finished" });
      if (cur.freezeAfter === "finished") return new Promise<void>(() => {});
      return Promise.resolve();
    },
  };
}
