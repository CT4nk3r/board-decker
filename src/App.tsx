import { useEffect, useState } from "react";
import { useConnectionStore } from "@/store/connection";
import { hasPat } from "@/lib/ado";
import { Onboarding } from "@/components/Onboarding";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui/spinner";

type Gate = "checking" | "ready" | "onboard";

export default function App() {
  const connection = useConnectionStore((s) => s.connection);
  const [gate, setGate] = useState<Gate>("checking");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!connection) {
        if (active) setGate("onboard");
        return;
      }
      // A persisted org/project is only usable if the keychain still has the PAT.
      const ok = await hasPat().catch(() => false);
      if (active) setGate(ok ? "ready" : "onboard");
    })();
    return () => {
      active = false;
    };
  }, [connection]);

  if (gate === "checking") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (gate === "onboard" || !connection) return <Onboarding />;
  return <AppShell />;
}
