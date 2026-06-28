// Browser mock of @tauri-apps/plugin-process for the Playwright harness.
export async function relaunch(): Promise<void> {
  if (typeof window !== "undefined") window.__relaunched = true;
}
