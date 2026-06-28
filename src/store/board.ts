import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScopeSpec } from "@/lib/ado";

/** How the active scope's work items are laid out. */
export type BoardView = "board" | "tree";

interface BoardState {
  /** Active board scope/filter (persisted). */
  scope: ScopeSpec;
  setScope: (scope: ScopeSpec) => void;

  /** Layout for the loaded items: kanban board or hierarchy tree (persisted). */
  view: BoardView;
  setView: (view: BoardView) => void;

  /** Free-text search applied client-side over loaded cards. */
  search: string;
  setSearch: (search: string) => void;

  /** Work item id open in the detail panel, if any (ephemeral). */
  selectedId: number | null;
  select: (id: number | null) => void;

  /** Whether the create-work-item dialog is open (ephemeral). */
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      scope: { id: "active" },
      setScope: (scope) => set({ scope }),
      view: "board",
      setView: (view) => set({ view }),
      search: "",
      setSearch: (search) => set({ search }),
      selectedId: null,
      select: (selectedId) => set({ selectedId }),
      createOpen: false,
      setCreateOpen: (createOpen) => set({ createOpen }),
    }),
    {
      name: "deck.board",
      // Remember the scope and the chosen layout between launches.
      partialize: (state) => ({ scope: state.scope, view: state.view }),
    },
  ),
);
