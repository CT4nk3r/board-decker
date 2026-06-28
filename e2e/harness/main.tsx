import { createRoot } from "react-dom/client";
import "@/index.css";
import { UpdateButton } from "@/components/UpdateButton";

// __TAURI_INTERNALS__ is set by an inline script in index.html (before this
// module loads) so UpdateButton's module-level `inTauri` guard sees it.

function Harness() {
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

createRoot(document.getElementById("root")!).render(<Harness />);
