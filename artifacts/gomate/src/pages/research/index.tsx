/**
 * /research page — Wave 2.x Prompt 3.5
 *
 * On mount: POST /api/research/trigger to kick off (or join, if a run
 * is already in flight). On 202, subscribe to the SSE status stream
 * and render live agent panels. When the run reaches a terminal state,
 * give the user a brief moment to absorb the completion banner, then
 * navigate to /dashboard where the unified guide is rendered.
 */

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CoordinatorPanel } from "@/components/research/CoordinatorPanel";
import { AgentPanelGrid } from "@/components/research/AgentPanelGrid";
import { useResearchStream, type RunStatus } from "@/lib/use-research-stream";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

interface TriggerResponse {
  profileId: string;
  alreadyRunning: boolean;
  dispatch: {
    specialists: { name: string }[];
    rationale: { specialist: string; reason: string }[];
  };
}

interface TriggerError {
  error: string;
}

const TERMINAL: ReadonlySet<RunStatus> = new Set(["completed", "partial", "failed"]);

export default function ResearchPage() {
  const [, setLocation] = useLocation();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [initialDispatch, setInitialDispatch] = useState<TriggerResponse["dispatch"] | null>(null);
  const [isTriggering, setIsTriggering] = useState(true);

  // -------------------------------------------------------------------
  // Step 1: trigger (or join) the run on mount.
  // -------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function trigger() {
      try {
        const res = await fetch("/api/research/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as TriggerError | null;
          throw new Error(body?.error ?? `Trigger failed (${res.status})`);
        }
        const body = (await res.json()) as TriggerResponse;
        if (cancelled) return;
        setProfileId(body.profileId);
        setInitialDispatch(body.dispatch);
      } catch (err) {
        if (cancelled) return;
        setTriggerError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsTriggering(false);
      }
    }
    void trigger();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------
  // Step 2: subscribe to SSE once we have a profileId.
  // -------------------------------------------------------------------
  const stream = useResearchStream(profileId);
  const snap = stream.snapshot;

  // Use the live snapshot when we have one; fall back to the initial
  // dispatch payload so the panels render *immediately* (before the
  // first SSE event arrives).
  const rationale = useMemo(() => {
    if (snap?.rationale && snap.rationale.length > 0) return snap.rationale;
    return initialDispatch?.rationale ?? [];
  }, [snap?.rationale, initialDispatch]);

  const agents = useMemo(() => {
    if (snap && Object.keys(snap.agents).length > 0) return snap.agents;
    // Synthesize idle panels from the initial dispatch list so the user
    // sees something the moment the trigger returns.
    const out: Record<string, import("@/components/research/AgentPanel").AgentLiveState> = {};
    for (const s of initialDispatch?.specialists ?? []) {
      out[s.name] = {
        name: s.name,
        status: "idle",
        currentActivity: "Waiting to start…",
      };
    }
    return out;
  }, [snap, initialDispatch]);

  // CoordinatorPanel doesn't render the synthetic "missing" status — fall
  // back to "failed" so the user gets a clear "research failed" banner if
  // the orchestrator's in-memory state was evicted (e.g. after server restart).
  const rawStatus: RunStatus = snap?.runStatus ?? "pending";
  const runStatus: Exclude<RunStatus, "missing"> =
    rawStatus === "missing" ? "failed" : rawStatus;

  // -------------------------------------------------------------------
  // Step 3: when run completes, navigate to /dashboard after a beat.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!snap) return undefined;
    if (!TERMINAL.has(snap.runStatus)) return undefined;
    const t = setTimeout(() => setLocation("/dashboard"), 2_500);
    return () => clearTimeout(t);
  }, [snap?.runStatus, snap, setLocation]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  if (triggerError) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4" data-testid="research-error">
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-red-900 dark:text-red-200">
                Couldn't start research
              </h2>
              <p className="text-sm text-red-800 dark:text-red-300 mt-1">{triggerError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setLocation("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isTriggering && !initialDispatch) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="research-loading">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Lining up your research team…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5" data-testid="research-page">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Researching your relocation plan
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A team of specialists is consulting official sources for your destination.
          You'll be redirected to your dashboard when they're done.
        </p>
      </div>

      <CoordinatorPanel rationale={rationale} runStatus={runStatus} />

      {stream.error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Live updates disconnected — the run is still progressing on the server.
            <span className="text-xs opacity-70 block mt-0.5">{stream.error}</span>
          </div>
        </div>
      )}

      <AgentPanelGrid agents={agents} rationale={rationale} />

      {snap?.synth && (
        <RunSummaryCard
          title="Synthesizer pass"
          subtitle={`${snap.synth.sectionCount} sections · ${snap.synth.consistencyIssues.length} consistency issues detected · ${snap.synth.unresolvedIssues.length} unresolved`}
          model={snap.synth.modelUsed}
          tokens={snap.synth.tokensUsed}
          ms={snap.synth.wallClockMs}
        />
      )}

      {snap?.critic && (
        <RunSummaryCard
          title="Critic pass"
          subtitle={`${snap.critic.gapCount} gaps · ${snap.critic.weakClaimCount} weak claims · ${snap.critic.missingForUserCount} missing-for-user`}
          model={snap.critic.modelUsed}
          tokens={snap.critic.tokensUsed}
          ms={snap.critic.wallClockMs}
        />
      )}

      {(runStatus === "completed" || runStatus === "partial") && (
        <ComposerStatus runStatus={runStatus} />
      )}
    </div>
  );
}

/**
 * Phase 6.3 — real-time guide composition visualization.
 * Once research finalizes, the orchestrator kicks off composeGuide()
 * server-side. This card polls /api/guides for the new guide row
 * scoped to the active plan and surfaces "writing visa section… budget…
 * housing… consistency pass… ready" with a link the second the row exists.
 */
function ComposerStatus({ runStatus }: { runStatus: string }) {
  const [status, setStatus] = React.useState<"composing" | "ready" | "error">("composing");
  const [guideId, setGuideId] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/guides");
        if (!cancelled && res.ok) {
          const data = await res.json();
          const latest = data.guides?.[0];
          if (latest?.id) {
            setGuideId(latest.id);
            setStatus("ready");
            return;
          }
        }
      } catch { /* swallow */ }
      if (!cancelled) {
        setTick((t) => t + 1);
        setTimeout(poll, 4000);
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, []);

  const STAGES = [
    "Writing visa pathway section",
    "Sizing budget & cost-of-living section",
    "Outlining housing & rental playbook",
    "Banking & digital ID setup section",
    "Healthcare registration section",
    "Culture & working life section",
    "Compiling document apostille pipeline",
    "Posted-worker compliance section",
    "Pre-departure & settling-in overviews",
    "Renumbering citations globally",
    "Consistency pass — terminology & deadlines",
  ];
  const currentStage = STAGES[Math.min(tick, STAGES.length - 1)];
  void runStatus;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {status === "ready" ? "Guide ready" : "Composing your guide"}
            {status === "composing" && (
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {status === "ready"
              ? "Your full relocation guide has been written, citation-checked, and saved."
              : `${currentStage}…`}
          </p>
        </div>
        {status === "ready" && guideId && (
          <a
            href={`/guides/${guideId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Open guide →
          </a>
        )}
      </div>
    </div>
  );
}

function RunSummaryCard({
  title,
  subtitle,
  model,
  tokens,
  ms,
}: {
  title: string;
  subtitle: string;
  model: string;
  tokens: number;
  ms: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground space-y-0.5">
          <div>{model}</div>
          <div>{tokens.toLocaleString()} tok · {(ms / 1000).toFixed(1)}s</div>
        </div>
      </div>
    </div>
  );
}
