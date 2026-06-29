import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import { queryClient } from "@/lib/queryClient";
import { Sidebar } from "@/components/Sidebar";
import { useConnectionStore } from "@/store/connection";
import { useBoardStore } from "@/store/board";

// Seed an active connection so the Sidebar renders its scope nav + area picker
// without onboarding. invoke() is aliased to a browser mock in the harness.
useConnectionStore.setState({ connection: { org: "Org", project: "Proj" } });

// Mirrors how the board reads scope: a readout the spec can assert on, proving
// the picker actually drives shared board state (#21).
function ScopeReadout() {
  const scope = useBoardStore((s) => s.scope);
  return (
    <p data-testid="scope" className="p-4 text-sm">
      scope: {scope.id}
      {scope.arg ? ` / ${scope.arg}` : ""}
    </p>
  );
}

function Harness() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-bg">
        <Sidebar />
        <ScopeReadout />
      </div>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
