import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Shield,
  Plane,
  FolderClosed,
  Home as HomeIcon,
  Compass,
} from "lucide-react"

interface DashboardGuidedTourProps {
  open: boolean
  onClose: () => void
}

interface TourStep {
  emoji: string
  icon: React.ReactNode
  title: string
  body: string
  /** Where this step points the user — shown as a hint chip under the body. */
  destination?: { label: string; href: string }
}

// Five-step tour grounded in the current IA (Dashboard / Immigration /
// Pre-move / Post-move / Documents / Plan & Guidance). Order mirrors the
// recommended sequence: pick a visa pathway → run the move checklist →
// collect documents → unlock post-arrival admin → use Plan & Guidance for
// deeper context. The previous tour referenced retired tabs (overview /
// profile / visa / money / settling) and a no-op onTabChange callback —
// both have been removed.
const STEPS: TourStep[] = [
  {
    emoji: "✨",
    icon: <Sparkles className="h-5 w-5 text-[#0D9488]" />,
    title: "Your plan is ready",
    body:
      "Specialists just finished researching your move against official sources. The dashboard summarizes what they found — visa shortlist, costs, key risks. Everything else lives in dedicated workspaces in the left sidebar. 30-second tour?",
  },
  {
    emoji: "🛂",
    icon: <Shield className="h-5 w-5 text-amber-600" />,
    title: "Start in Immigration",
    body:
      "Your visa shortlist is here. Compare routes side-by-side, see eligibility, fees, processing times, then pick the one you'll pursue. Picking a path is what unlocks the right checklist in Pre-move.",
    destination: { label: "Open Immigration", href: "/immigration" },
  },
  {
    emoji: "✈️",
    icon: <Plane className="h-5 w-5 text-[#0D9488]" />,
    title: "Pre-move is your checklist",
    body:
      "Generates a dependency-aware timeline from your visa choice — apostilles, translations, bank, housing, insurance, sorted by deadline. Tick items off here as you do them.",
    destination: { label: "Open Pre-move", href: "/pre-move" },
  },
  {
    emoji: "📁",
    icon: <FolderClosed className="h-5 w-5 text-blue-500" />,
    title: "Documents lives separately",
    body:
      "\"What you need\" lists every document the visa demands. \"Vault\" is where you upload scans so they're at hand when an embassy or landlord asks. Both surfaces sit at /documents.",
    destination: { label: "Open Documents", href: "/documents" },
  },
  {
    emoji: "🏡",
    icon: <HomeIcon className="h-5 w-5 text-rose-500" />,
    title: "After you arrive",
    body:
      "Post-move unlocks once you mark arrival — population register, bank, healthcare, taxes. Plan & Guidance is the deeper-context surface (long-form explanations, source citations). Need to refresh research after a rule change? Use the refresh button on Immigration; regenerating the whole plan is in Settings.",
    destination: { label: "See Post-move", href: "/post-move" },
  },
]

export function DashboardGuidedTour({
  open,
  onClose,
}: DashboardGuidedTourProps) {
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Reset to step 0 every time the tour opens.
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  useEffect(() => {
    setMounted(true)
  }, [])

  // ESC closes the tour. The backdrop click already does the same; this
  // covers keyboard users.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!mounted || !open) return null

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  const next = () => {
    if (isLast) {
      onClose()
      return
    }
    setStep((s) => s + 1)
  }

  const prev = () => {
    if (isFirst) return
    setStep((s) => s - 1)
  }

  const goToDestination = () => {
    if (!current.destination) return
    onClose()
    if (typeof window !== "undefined") {
      window.location.assign(current.destination.href)
    }
  }

  return createPortal(
    <AnimatePresence>
      {/* Dimming backdrop — pulls focus to the tour popup. Click-to-close
          so power users can dismiss without hunting for the X button. */}
      <motion.div
        key="tour-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
        aria-hidden
      />

      <motion.div
        key="tour-popup"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md pointer-events-auto"
        data-testid="dashboard-guided-tour"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard tour"
      >
        <div className="relative rounded-2xl border-2 border-emerald-500/30 bg-card shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tour"
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors z-10"
            data-testid="tour-close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4 p-5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-[#0D9488]/20 blur-lg" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#0D9488]/15 to-[#0F172A]/10 ring-1 ring-[#0D9488]/40">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.emoji}
                    initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.5, opacity: 0, rotate: 10 }}
                    transition={{ duration: 0.25 }}
                    className="text-2xl"
                  >
                    {current.emoji}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -6, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                    {current.icon}
                    {current.title}
                  </h2>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {current.body}
                  </p>
                  {current.destination && (
                    <button
                      type="button"
                      onClick={goToDestination}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                      data-testid={`tour-goto-${current.destination.href.slice(1)}`}
                    >
                      <Compass className="h-3 w-3" />
                      {current.destination.label}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-1">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step
                      ? "w-5 bg-[#0F172A] dark:bg-[#0D9488]"
                      : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prev}
                  className="h-8 gap-1 px-2.5"
                  data-testid="tour-back"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={next}
                className="h-8 gap-1 rounded-full px-3.5"
                data-testid="tour-next"
              >
                {isLast ? "Done" : "Next"}
                {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
