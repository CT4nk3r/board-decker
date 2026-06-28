import { openUrl } from "@tauri-apps/plugin-opener";

/** Open a URL in the user's default browser (falls back to window.open). */
export async function openExternal(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
