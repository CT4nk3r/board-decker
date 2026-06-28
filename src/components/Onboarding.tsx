import { useState, type FormEvent } from "react";
import { KeyRound, ArrowRight, ExternalLink, AlertTriangle } from "lucide-react";
import { useConnectionStore } from "@/store/connection";
import { validateConnection, savePat, AdoError } from "@/lib/ado";
import { queryClient } from "@/lib/queryClient";
import { openExternal } from "@/lib/open";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function Onboarding() {
  const setConnection = useConnectionStore((s) => s.setConnection);
  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [team, setTeam] = useState("");
  const [pat, setPat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const conn = {
      org: org.trim(),
      project: project.trim(),
      team: team.trim() || undefined,
    };
    if (!conn.org || !conn.project || !pat.trim()) {
      setError("Organization, project and PAT are all required.");
      return;
    }
    setBusy(true);
    try {
      const project = await validateConnection(conn, pat.trim());
      await savePat(pat.trim());
      // Drop any cache from a prior session so a reconnecting user never sees
      // the previous identity's data; pin the connection to that identity.
      queryClient.clear();
      setConnection({ ...conn, identity: project.id });
      // App re-gates to the board once the connection is set.
    } catch (err) {
      const msg =
        err instanceof AdoError
          ? err.status === 401 || err.status === 203
            ? "Authentication failed — check the PAT and that it has Work Items (Read & Write) scope."
            : err.status === 404
              ? "Project not found in that organization. Double-check the names."
              : err.message
          : (err as Error).message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-lg shadow-accent/30">
            <span className="text-lg font-bold">D</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Connect to Azure DevOps</h1>
            <p className="text-sm text-muted">Board Decker reads & writes your work items directly.</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-xl shadow-black/20"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="org">Organization</Label>
              <Input
                id="org"
                placeholder="contoso"
                autoFocus
                value={org}
                onChange={(e) => setOrg(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project">Project</Label>
              <Input
                id="project"
                placeholder="My Project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team">
              Team <span className="text-faint">(optional · for sprints)</span>
            </Label>
            <Input
              id="team"
              placeholder="My Project Team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pat">Personal Access Token</Label>
            <div className="relative">
              <KeyRound
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <Input
                id="pat"
                type="password"
                placeholder="••••••••••••••••"
                className="pl-8 font-mono"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
              />
            </div>
            <p className="text-xs text-faint">
              Stored in your OS keychain — never written to disk or sent anywhere but Azure DevOps.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? (
              <>
                <Spinner className="h-4 w-4" /> Validating…
              </>
            ) : (
              <>
                Connect <ArrowRight size={16} />
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() =>
              openExternal(
                `https://dev.azure.com/${encodeURIComponent(org.trim() || "{org}")}/_usersSettings/tokens`,
              )
            }
            className="flex w-full items-center justify-center gap-1 text-xs text-muted hover:text-fg"
          >
            Create a PAT in Azure DevOps <ExternalLink size={12} />
          </button>
        </form>
      </div>
    </div>
  );
}
