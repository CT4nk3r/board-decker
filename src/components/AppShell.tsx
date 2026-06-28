import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Board } from "@/components/Board";
import { HierarchyView } from "@/components/HierarchyView";
import { DetailPanel } from "@/components/DetailPanel";
import { CreateDialog } from "@/components/CreateDialog";
import { useBoardStore } from "@/store/board";

export function AppShell() {
  const view = useBoardStore((s) => s.view);
  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-fg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {view === "tree" ? <HierarchyView /> : <Board />}
      </div>
      <DetailPanel />
      <CreateDialog />
    </div>
  );
}
