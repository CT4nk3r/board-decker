import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { DownloadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "available" | "downloading" | "installing" | "error";

// The updater APIs only exist inside the Tauri webview. In a plain browser
// (e.g. `vite dev`/`vite preview`) the IPC bridge is absent, so guard on it to
// keep the UI a no-op there instead of throwing.
const inTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Non-intrusive update affordance for the top bar: silently checks for a newer
 * release on mount and, only if one exists, renders a small button. Clicking it
 * downloads + installs the update and relaunches the app. No dialogs/popups.
 */
export function UpdateButton() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [status, setStatus] = useState<Status>("available");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!inTauri) return;
    let cancelled = false;
    check()
      .then((found) => {
        if (!cancelled && found) setUpdate(found);
      })
      // Offline, no release yet, or dev build without an endpoint: stay hidden.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  const busy = status === "downloading" || status === "installing";

  async function install() {
    if (!update || busy) return;
    setStatus("downloading");
    setPct(0);
    try {
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((e) => {
        switch (e.event) {
          case "Started":
            total = e.data.contentLength ?? 0;
            break;
          case "Progress":
            received += e.data.chunkLength;
            setPct(total ? Math.round((received / total) * 100) : 0);
            break;
          case "Finished":
            setStatus("installing");
            break;
        }
      });
      // Relaunch into the freshly installed version.
      await relaunch();
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "downloading"
      ? `Updating… ${pct}%`
      : status === "installing"
        ? "Restarting…"
        : status === "error"
          ? "Update failed — retry"
          : `Update to ${update.version}`;

  return (
    <Button
      variant="secondary"
      size="md"
      className="gap-1.5 text-accent"
      disabled={busy}
      onClick={install}
      title={
        status === "error"
          ? "Retry update"
          : `Install version ${update.version} and restart`
      }
    >
      {busy ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <DownloadCloud size={15} />
      )}
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}
