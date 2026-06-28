import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdoConnection } from "@/lib/ado";

interface ConnectionState {
  connection: AdoConnection | null;
  /** Set the active org/project/team (called after a validated onboarding). */
  setConnection: (conn: AdoConnection) => void;
  /** Forget the connection (sign out). PAT removal is handled separately. */
  clear: () => void;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set) => ({
      connection: null,
      setConnection: (connection) => set({ connection }),
      clear: () => set({ connection: null }),
    }),
    { name: "deck.connection" },
  ),
);
