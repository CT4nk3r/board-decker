import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Board } from "@/components/Board";
import { DetailPanel } from "@/components/DetailPanel";
import { CreateDialog } from "@/components/CreateDialog";

export function AppShell() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-fg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <Board />
      </div>
      <DetailPanel />
      <CreateDialog />
    </div>
  );
}
