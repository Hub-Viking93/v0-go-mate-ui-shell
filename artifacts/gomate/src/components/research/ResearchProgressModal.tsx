import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useResearchStream } from "@/lib/use-research-stream";
import type { AgentLiveState } from "@/components/research/AgentPanel";

interface ResearchProgressModalProps {
  /** The relocation plan id — used as profileId for the SSE stream. */
  profileId: string | null;
  /** Whether the modal should be open. */
  open: boolean;
  /**
   * Whether the dashboard's underlying data is now hydrated (visa_research,
   * local_requirements_research populated, or research_status moved to a
   * terminal value). The modal only closes when SSE is terminal AND this
   * flips true — meaning the dashboard behind it is ready to be revealed.
   */
  dataReady: boolean;
  /** Called when the modal is ready to close. Parent should set open=false. */
  onComplete: () => void;
}

const SPECIALIST_LABEL: Record<string, { verb: string; subject: string; emoji: string }> = {
  visa_specialist: { verb: "Researching", subject: "visa options", emoji: "🛂" },
  tax_strategist: { verb: "Calculating", subject: "tax implications", emoji: "📊" },
  cost_specialist: { verb: "Pricing", subject: "cost of living", emoji: "💰" },
  housing_specialist: { verb: "Scouting", subject: "housing market", emoji: "🏠" },
  cultural_adapter: { verb: "Capturing", subject: "cultural context", emoji: "🌍" },
  documents_specialist: { verb: "Listing", subject: "required documents", emoji: "📜" },
  healthcare_navigator: { verb: "Mapping", subject: "healthcare system", emoji: "⚕️" },
  banking_helper: { verb: "Comparing", subject: "banking options", emoji: "🏦" },
  schools_specialist: { verb: "Reviewing", subject: "schools & childcare", emoji: "🎓" },
  study_program_specialist: { verb: "Researching", subject: "study programs & scholarships", emoji: "📚" },
  pet_specialist: { verb: "Checking", subject: "pet import rules", emoji: "🐾" },
  posted_worker_specialist: { verb: "Verifying", subject: "posted-worker rules", emoji: "🤝" },
  digital_nomad_compliance: { verb: "Checking", subject: "nomad-visa compliance", emoji: "💻" },
  job_compliance_specialist: { verb: "Verifying", subject: "work eligibility", emoji: "💼" },
  family_reunion_specialist: { verb: "Researching", subject: "family-reunion routes", emoji: "👨‍👩‍👧" },
  departure_tax_specialist: { verb: "Reviewing", subject: "departure-tax exposure", emoji: "🛫" },
  vehicle_import_specialist: { verb: "Checking", subject: "vehicle-import rules", emoji: "🚗" },
  property_purchase_specialist: { verb: "Checking", subject: "property-purchase rules", emoji: "🏡" },
  trailing_spouse_career_specialist: { verb: "Researching", subject: "spouse career options", emoji: "👥" },
  pension_continuity_specialist: { verb: "Verifying", subject: "pension continuity", emoji: "👴" },
};

function labelFor(name: string): { verb: string; subject: string; emoji: string } {
  return (
    SPECIALIST_LABEL[name] ?? {
      verb: "Researching",
      subject: name.replace(/_/g, " "),
      emoji: "🤖",
    }
  );
}

const TERMINAL_RUN: ReadonlySet<string> = new Set([
  "completed",
  "partial",
  "failed",
  "missing",
]);

export function ResearchProgressModal({
  profileId,
  open,
  dataReady,
  onComplete,
}: ResearchProgressModalProps) {
  const stream = useResearchStream(open ? profileId : null);
  const snap = stream.snapshot;

  const agents = useMemo<AgentLiveState[]>(() => {
    if (!snap) return [];
    return Object.values(snap.agents);
  }, [snap]);

  const total = agents.length || snap?.rationale.length || 0;
  const done = agents.filter((a) => a.status === "complete" || a.status === "failed").length;
  const inFlight = agents.filter(
    (a) => a.status === "researching" || a.status === "drafting" || a.status === "validating",
  );

  const sseTerminal = snap ? TERMINAL_RUN.has(snap.runStatus) : false;
  const isFinishing = sseTerminal && !dataReady;
  const allDone = sseTerminal && dataReady;

  // Once both conditions are met, give the user a brief moment to read
  // "All set" before closing — so the transition into the dashboard
  // doesn't feel abrupt.
  const completedRef = useRef(false);
  useEffect(() => {
    if (!allDone || completedRef.current) return;
    completedRef.current = true;
    const t = setTimeout(() => onComplete(), 1_200);
    return () => clearTimeout(t);
  }, [allDone, onComplete]);

  // Cycle through in-flight specialists every 1.6s so the headline
  // message changes even when one specialist is taking a while.
  const [tickIndex, setTickIndex] = useState(0);
  useEffect(() => {
    if (inFlight.length <= 1) return;
    const t = setInterval(
      () => setTickIndex((i) => (i + 1) % inFlight.length),
      1_600,
    );
    return () => clearInterval(t);
  }, [inFlight.length]);

  const headline = useMemo(() => {
    if (allDone) return { verb: "All set", subject: "your dashboard is ready", emoji: "✨" };
    if (isFinishing)
      return { verb: "Almost done", subject: "setting up your dashboard", emoji: "✨" };
    if (inFlight.length === 0) {
      if (snap?.runStatus === "synthesizing")
        return { verb: "Synthesizing", subject: "everything we found", emoji: "🧠" };
      if (snap?.runStatus === "critiquing")
        return { verb: "Double-checking", subject: "for accuracy", emoji: "🔍" };
      if (snap?.runStatus === "redispatching")
        return { verb: "Filling", subject: "remaining gaps", emoji: "🧩" };
      return { verb: "Lining up", subject: "your research team", emoji: "👋" };
    }
    const current = inFlight[tickIndex % inFlight.length];
    return labelFor(current.name);
  }, [allDone, isFinishing, inFlight, snap?.runStatus, tickIndex]);

  const recent = useMemo(() => {
    return agents
      .filter((a) => a.status === "complete")
      .slice(-3)
      .reverse();
  }, [agents]);

  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md gm-card border-0 shadow-2xl [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="research-progress-modal"
      >
        <DialogTitle className="sr-only">Building your relocation plan</DialogTitle>
        <DialogDescription className="sr-only">
          Live progress while specialist agents research your move.
        </DialogDescription>

        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <div className="relative mb-4">
            <motion.div
              className="absolute inset-0 rounded-full bg-[#5EE89C]/30 blur-xl"
              animate={{ scale: allDone ? [1, 1.1, 1] : [0.9, 1.1, 0.9] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#5EE89C]/20 to-[#1B3A2D]/10 ring-1 ring-[#5EE89C]/40">
              <AnimatePresence mode="wait">
                <motion.div
                  key={headline.emoji}
                  initial={{ scale: 0.4, opacity: 0, rotate: -15 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.4, opacity: 0, rotate: 15 }}
                  transition={{ duration: 0.35 }}
                  className="text-4xl"
                >
                  {headline.emoji}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="min-h-[4.5rem] flex flex-col items-center justify-center gap-1">
            <AnimatePresence mode="wait">
              <motion.h2
                key={`${headline.verb}-${headline.subject}`}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                {allDone ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    {headline.verb}
                  </span>
                ) : (
                  <>
                    {headline.verb}
                    <span className="ml-1 text-muted-foreground font-normal">
                      {headline.subject}
                      {!allDone && "…"}
                    </span>
                  </>
                )}
              </motion.h2>
            </AnimatePresence>
            <p className="text-xs text-muted-foreground">
              {allDone
                ? "Taking you to your plan…"
                : isFinishing
                  ? "Hydrating your dashboard cards…"
                  : "A team of specialists is consulting official sources."}
            </p>
          </div>

          {total > 0 && (
            <div className="mt-5 w-full">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                <span>Progress</span>
                <span className="tabular-nums">
                  {done}/{total} specialists
                </span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          )}

          {recent.length > 0 && !allDone && (
            <div className="mt-5 w-full text-left space-y-1.5">
              <AnimatePresence initial={false}>
                {recent.map((a) => {
                  const lbl = labelFor(a.name);
                  return (
                    <motion.div
                      key={a.name}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">
                        <span aria-hidden className="mr-1.5">
                          {lbl.emoji}
                        </span>
                        {lbl.verb} {lbl.subject} — done
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {!allDone && stream.error && (
            <p className="mt-4 text-[11px] text-amber-700 dark:text-amber-400 max-w-xs">
              Live updates dropped — research is still running on the server. We'll
              keep waiting for the dashboard data to land.
            </p>
          )}

          {!snap && !stream.error && (
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <Sparkles className="h-3.5 w-3.5 text-[#5EE89C]" />
              Connecting to your research team…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
