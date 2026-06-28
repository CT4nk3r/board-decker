import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import { UpdateButton } from "@/components/UpdateButton";
import { Sidebar } from "@/components/Sidebar";
import { sanitizeAdoHtml } from "@/lib/sanitize";
import { queryClient } from "@/lib/queryClient";
import { useConnectionStore } from "@/store/connection";

// __TAURI_INTERNALS__ is set by an inline script in index.html (before this
// module loads) so UpdateButton's module-level `inTauri` guard sees it.

function UpdaterPanel() {
  return (
    <div className="min-h-screen bg-bg p-6">
      {/* Mirrors the real TopBar layout so the screenshots reflect production. */}
      <header className="flex h-14 items-center gap-3 rounded-lg border border-border bg-surface px-4">
        <h2 className="text-[15px] font-semibold">My Board</h2>
        <span className="text-xs text-faint">42 items</span>
        <div className="ml-auto flex items-center gap-2">
          <UpdateButton />
          <span className="text-xs text-faint">search · refresh · new</span>
        </div>
      </header>
    </div>
  );
}

// Renders untrusted ADO HTML exactly like the detail panel, through the real
// sanitizer, so e2e can prove injected scripts never execute.
function SanitizePanel() {
  const html = sanitizeAdoHtml(window.__adoHtml ?? "");
  return (
    <div className="min-h-screen bg-bg p-6">
      <div data-testid="ado" className="ado-html" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// Mounts the real Sidebar with a pre-seeded query cache + connection so e2e can
// verify sign-out empties the cache (no cross-identity leak).
function SignOutPanel() {
  const conn = useConnectionStore((s) => s.connection);
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-bg">
        {conn ? <Sidebar /> : <div data-testid="signed-out">signed out</div>}
        <span data-testid="cache-count">{queryClient.getQueryCache().getAll().length}</span>
      </div>
    </QueryClientProvider>
  );
}

const panel = new URLSearchParams(window.location.search).get("panel");
if (panel === "signout") {
  // Seed once before mount so the post-sign-out render reflects a cleared cache.
  useConnectionStore.setState({ connection: { org: "o", project: "p", identity: "id-1" } });
  queryClient.setQueryData(["board-items", "id-1", "o", "p"], [{ id: 1 }]);
}
const App = panel === "sanitize" ? SanitizePanel : panel === "signout" ? SignOutPanel : UpdaterPanel;

createRoot(document.getElementById("root")!).render(<App />);
