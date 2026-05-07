import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, CheckCircle2, Clock, Info } from "lucide-react";
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

// Generic descriptors for the "currently doing" rotation. Strings are
// abstract verb-phrases — never fabricate specific URLs, agency names, or
// claims about exact source freshness. NO MOCK DATA: these describe the
// *kind* of work the specialist does, not specific facts they've found.
const SPECIALIST_BUSY_LINES: Record<string, string[]> = {
  visa_specialist: [
    "Reading the official immigration site",
    "Comparing eligible visa pathways for your profile",
    "Checking processing times and document requirements",
    "Validating fees and recent rule changes",
  ],
  tax_strategist: [
    "Mapping double-tax-treaty coverage",
    "Estimating residency-based tax exposure",
    "Reviewing income-bracket rules in destination",
  ],
  cost_specialist: [
    "Pricing housing, groceries, and transit",
    "Cross-referencing recent cost indices",
    "Compiling a monthly-budget breakdown",
  ],
  housing_specialist: [
    "Sampling rental listings in your target city",
    "Checking deposit and lease conventions",
    "Noting newcomer-friendly neighborhoods",
  ],
  cultural_adapter: [
    "Summarizing local customs and norms",
    "Capturing language-friction notes for your origin",
    "Pulling community/expat-network signals",
  ],
  documents_specialist: [
    "Listing every document the visa demands",
    "Flagging which originals need apostille or translation",
    "Sequencing the order paperwork should be obtained",
  ],
  healthcare_navigator: [
    "Mapping how public healthcare enrollment works",
    "Checking private insurance options for newcomers",
    "Noting any pre-arrival coverage gaps",
  ],
  banking_helper: [
    "Comparing banks that accept newcomer customers",
    "Checking which ID and proofs each bank requires",
    "Noting digital-bank alternatives if useful",
  ],
  schools_specialist: [
    "Reviewing public, private, and international school routes",
    "Checking enrollment windows and language tracks",
  ],
  pet_specialist: [
    "Checking microchip and rabies-titre requirements",
    "Reviewing quarantine rules for your destination",
    "Noting airline pet-cargo constraints",
  ],
  posted_worker_specialist: [
    "Verifying posted-worker A1 / equivalent rules",
    "Checking employer notification requirements",
  ],
  digital_nomad_compliance: [
    "Checking nomad-visa eligibility thresholds",
    "Reviewing income/proof-of-funds rules",
  ],
  job_compliance_specialist: [
    "Verifying right-to-work documentation",
    "Checking sponsorship and quota rules",
  ],
  family_reunion_specialist: [
    "Researching family-reunion routes",
    "Checking dependent-visa eligibility rules",
  ],
  departure_tax_specialist: [
    "Reviewing exit-tax exposure in your origin",
    "Noting capital-gains realization rules",
  ],
  vehicle_import_specialist: [
    "Checking import duty and homologation rules",
    "Reviewing temporary-import allowances",
  ],
  property_purchase_specialist: [
    "Checking foreigner property-purchase rights",
    "Noting notary, tax, and registration steps",
  ],
  trailing_spouse_career_specialist: [
    "Researching spouse work-permit options",
    "Noting career-portability constraints",
  ],
  pension_continuity_specialist: [
    "Verifying pension portability and bilateral agreements",
    "Checking continued-contribution rules",
  ],
  study_program_specialist: [
    "Researching study programs in your field",
    "Checking scholarship and tuition options",
  ],
};

const FALLBACK_BUSY_LINES = [
  "Consulting official sources",
  "Cross-referencing your profile",
  "Compiling findings",
];

function labelFor(name: string): { verb: string; subject: string; emoji: string } {
  return (
    SPECIALIST_LABEL[name] ?? {
      verb: "Researching",
      subject: name.replace(/_/g, " "),
      emoji: "🤖",
    }
  );
}

function busyLinesFor(name: string): string[] {
  return SPECIALIST_BUSY_LINES[name] ?? FALLBACK_BUSY_LINES;
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

  // Hold the latest `onComplete` in a ref so the close-effect below can
  // depend ONLY on `allDone`. Previously the effect listed `onComplete`
  // in its deps, which made it re-run every time the parent dashboard
  // re-rendered (the dashboard polls /api/profile every 8s and updates
  // many state slices, so `handleResearchModalComplete` got a fresh
  // identity often). Each re-run cleared the pending 1.2s timeout
  // before it could fire — so the modal reached "All set" and never
  // closed. The ref pattern keeps the timeout alive across re-renders.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // Once both conditions are met, give the user a brief moment to read
  // "All set" before closing — so the transition into the dashboard
  // doesn't feel abrupt. Schedule the close exactly once per modal
  // lifetime (guarded by completedRef) and read the latest onComplete
  // from the ref at fire time.
  const completedRef = useRef(false);
  useEffect(() => {
    if (!allDone || completedRef.current) return;
    completedRef.current = true;
    const t = setTimeout(() => onCompleteRef.current(), 1_200);
    return () => clearTimeout(t);
  }, [allDone]);

  // Defensive URL cleanup. If the user lands here with
  // `?research=triggered` in the URL (set by the onboarding redirect),
  // strip it as soon as the SSE run is terminal — regardless of
  // whether `onComplete` ever fires. This makes the fix self-healing
  // for any user who already has a stuck URL today: refresh and the
  // dashboard will no longer auto-reopen the modal.
  const urlCleanedRef = useRef(false);
  useEffect(() => {
    if (!sseTerminal || urlCleanedRef.current) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("research")) {
      url.searchParams.delete("research");
      window.history.replaceState({}, "", url.toString());
    }
    urlCleanedRef.current = true;
  }, [sseTerminal]);

  // Manual escape hatch: after the modal has been showing "All set"
  // for ~3s, expose a "Continue to dashboard" button so the user is
  // never trapped if the auto-close fails for any reason. The button
  // stays visible indefinitely once it appears.
  const [showManualEscape, setShowManualEscape] = useState(false);
  useEffect(() => {
    if (!allDone) {
      setShowManualEscape(false);
      return;
    }
    const t = setTimeout(() => setShowManualEscape(true), 3_000);
    return () => clearTimeout(t);
  }, [allDone]);

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

  // Elapsed-time counter — a tickable proof to the user that the app
  // hasn't frozen even when the progress count sits still for 30+ seconds
  // (the visa specialist alone runs ~175s for some personas). Resets
  // whenever the modal reopens for a fresh run.
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open || allDone) return;
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    const t = setInterval(() => {
      if (startedAtRef.current == null) return;
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1_000);
    return () => clearInterval(t);
  }, [open, allDone]);

  // Stagnation detector: track when `done` last changed via refs (no
  // re-render). A single always-on interval re-evaluates "has it been
  // >5s since last progress?" so shimmer turns on whether we're stuck
  // before any progress OR between increments. The previous version
  // early-returned on `done` change and never re-started the interval,
  // which meant shimmer stayed off after the first specialist completed.
  const lastDoneRef = useRef<number>(0);
  const lastDoneChangeAtRef = useRef<number>(Date.now());
  if (done !== lastDoneRef.current) {
    lastDoneRef.current = done;
    lastDoneChangeAtRef.current = Date.now();
  }
  const [isStagnant, setIsStagnant] = useState(false);
  useEffect(() => {
    if (allDone) {
      setIsStagnant(false);
      return;
    }
    const tick = () => {
      const stagnant = Date.now() - lastDoneChangeAtRef.current > 5_000;
      setIsStagnant((prev) => (prev !== stagnant ? stagnant : prev));
    };
    tick();
    const t = setInterval(tick, 1_000);
    return () => clearInterval(t);
  }, [allDone]);

  // Rotating "currently doing" microcopy. The headline tells you WHAT
  // specialist is running; this line tells you WHAT THEY'RE DOING right
  // now — so even when the headline pauses, this keeps moving. Gated
  // behind "current specialist has been running >10s" so we don't flash
  // text the moment a specialist starts (per task spec).
  const [busyLineIndex, setBusyLineIndex] = useState(0);
  const currentSpecialistName = inFlight[tickIndex % Math.max(inFlight.length, 1)]?.name;
  useEffect(() => {
    setBusyLineIndex(0);
  }, [currentSpecialistName]);
  const busyLines = useMemo(
    () => (currentSpecialistName ? busyLinesFor(currentSpecialistName) : FALLBACK_BUSY_LINES),
    [currentSpecialistName],
  );
  const [showBusyLine, setShowBusyLine] = useState(false);
  useEffect(() => {
    if (allDone || !currentSpecialistName) {
      setShowBusyLine(false);
      return;
    }
    setShowBusyLine(false);
    const reveal = setTimeout(() => setShowBusyLine(true), 10_000);
    return () => clearTimeout(reveal);
  }, [currentSpecialistName, allDone]);
  useEffect(() => {
    if (allDone || !showBusyLine || busyLines.length <= 1) return;
    const t = setInterval(
      () => setBusyLineIndex((i) => (i + 1) % busyLines.length),
      4_500,
    );
    return () => clearInterval(t);
  }, [busyLines.length, allDone, showBusyLine]);

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
  const currentBusyLine = busyLines[busyLineIndex] ?? busyLines[0];

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
              className="absolute inset-0 rounded-full bg-[#0D9488]/30 blur-xl"
              animate={{ scale: allDone ? [1, 1.1, 1] : [0.9, 1.1, 0.9] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#0D9488]/20 to-[#0F172A]/10 ring-1 ring-[#0D9488]/40">
              <AnimatePresence mode="wait">
                <motion.div
                  key={headline.emoji}
                  initial={{ scale: 0.4, opacity: 0, rotate: -15 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    rotate: 0,
                    // Subtle sway during long stagnant waits — cheap visual
                    // proof that the modal itself is alive.
                    y: isStagnant && !allDone ? [0, -3, 0, 3, 0] : 0,
                  }}
                  exit={{ scale: 0.4, opacity: 0, rotate: 15 }}
                  transition={{
                    duration: 0.35,
                    y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  }}
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

            {/* Rotating busy-line — describes WHAT the active specialist is
                doing right now. Generic verb-phrases only (no fabricated
                URLs / agency names per the NO MOCK DATA rule). Rotates
                every 4.5s so the user always sees something change. */}
            {!allDone && !isFinishing && currentSpecialistName && showBusyLine && (
              <div className="mt-1 h-4 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${currentSpecialistName}-${busyLineIndex}`}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-[11px] text-muted-foreground/80 italic"
                  >
                    {currentBusyLine}…
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="mt-5 w-full">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                <span>Progress</span>
                <span className="tabular-nums">
                  {done}/{total} specialists
                </span>
              </div>
              <div className="relative">
                <Progress value={progressPct} className="h-1.5" />
                {/* Indeterminate shimmer overlay — switches on whenever the
                    progress count has been static for >5s. A moving linear
                    gradient sweeps left-to-right so the bar feels alive
                    even when no specialist completes for a while. */}
                {isStagnant && !allDone && (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20"
                      initial={{ x: "-100%" }}
                      animate={{ x: "300%" }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  </motion.div>
                )}
              </div>
              {/* Elapsed-time + reassurance. The clock proves the app is
                  alive. The amber line tells anonymous users not to close
                  the window — losing it mid-research means the run keeps
                  going server-side but they have no way back to the
                  result. */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10.5px] tabular-nums text-muted-foreground/80">
                  <Clock className="h-3 w-3" />
                  Elapsed {formatElapsed(elapsedSec)}
                </span>
                {!allDone && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-amber-600 dark:text-amber-400">
                    <Info className="h-3 w-3" />
                    Keep this window open
                  </span>
                )}
              </div>
            </div>
          )}

          {!allDone && (
            <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-400 max-w-xs leading-relaxed">
              Hold tight — research can take a few minutes. We'll redirect you to
              the dashboard automatically when your plan is ready.
            </p>
          )}

          {allDone && showManualEscape && (
            <div className="mt-4 w-full flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => onCompleteRef.current()}
                className="rounded-md bg-[#0D9488] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#0B7A70] transition-colors"
                data-testid="research-modal-continue"
              >
                Continue to dashboard
              </button>
              <p className="text-[10.5px] text-muted-foreground">
                If this doesn't redirect on its own, click the button or refresh the page.
              </p>
            </div>
          )}

          {recent.length > 0 && !allDone && (
            <div className="mt-5 w-full text-left space-y-1.5">
              <AnimatePresence initial={false}>
                {recent.map((a, idx) => {
                  const lbl = labelFor(a.name);
                  const isNewest = idx === 0;
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
                      <span className="relative shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        {isNewest && (
                          <motion.span
                            aria-hidden
                            className="absolute inset-0 rounded-full ring-2 ring-emerald-400/50"
                            initial={{ scale: 1, opacity: 0.8 }}
                            animate={{ scale: 1.8, opacity: 0 }}
                            transition={{ duration: 1.4, ease: "easeOut" }}
                          />
                        )}
                      </span>
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
              <Sparkles className="h-3.5 w-3.5 text-[#0D9488]" />
              Connecting to your research team…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
