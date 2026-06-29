import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import { Board } from "@/components/Board";
import { Toaster } from "@/components/ui/toast";
import { useConnectionStore } from "@/store/connection";

// Mounts the real Board with a seeded connection; ADO calls are served by the
// aliased core mock (mocks/core.ts) from window.__board.
useConnectionStore.setState({ connection: { org: "o", project: "p" } });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <div className="flex h-screen flex-col bg-bg text-fg">
      <Board />
    </div>
    <Toaster />
  </QueryClientProvider>,
);
