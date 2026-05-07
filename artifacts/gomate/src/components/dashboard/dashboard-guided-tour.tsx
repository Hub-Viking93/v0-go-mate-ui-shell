import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Compass,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Shield,
  Plane,
  HomeIcon,
  FolderClosed,
  RefreshCw,
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
}

// 6-step orientation tour for first-time users post-research.
// Maps 1:1 to the current sidebar IA (Immigration → Pre-move → Documents
// → Post-move → Plan & Guidance) and answers the "what do I start with?"
// question explicitly. No tab metaphors — the dashboard tabs were
// retired in the IA refresh and the rest of the product is route-based.
const STEPS: TourStep[] = [
  {
    emoji: "👋",
    icon: <Sparkles className="h-5 w-5 text-[#0D9488]" />,
    title: "Your plan is ready — start here",
    body:
      "Research is done. The sidebar on the left is your map; this dashboard is the at-a-glance view. Recommended order: Immigration → Pre-move → Documents → Post-move (after you arrive).",
  },
  {
    emoji: "🛂",
    icon: <Shield className="h-5 w-5 text-[#1B7A40]" />,
    title: "Immigration — pick your path",
    body:
      "Open Immigration first. You'll see your primary pathway, a Plan B, and any rule changes that affect entry. Confirming the route here makes the rest of the plan adapt to it.",
  },
  {
    emoji: "✈️",
    icon: <Plane className="h-5 w-5 text-[#0D9488]" />,
    title: "Pre-move — the actual checklist",
    body:
      "Pre-move is your daily driver until move day: deadlines, urgency, what's blocked, what's next. This is where the real work happens before you leave.",
  },
  {
    emoji: "📁",
    icon: <FolderClosed className="h-5 w-5 text-amber-600" />,
    title: "Documents — proof and paperwork",
    body:
      "Two halves: Vault for files you've uploaded, and What you need for everything still missing — with prep guidance for each one. Upload as you collect.",
  },
  {
    emoji: "🏡",
    icon: <HomeIcon className="h-5 w-5 text-rose-500" />,
    title: "Post-move — unlocks after arrival",
    body:
      "Once you mark yourself arrived, Post-move opens up: registration, banking, healthcare, licence and orientation. It stays out of the way until you actually need it.",
  },
  {
    emoji: "🧭",
    icon: <Compass className="h-5 w-5 text-purple-500" />,
    title: "Plan & Guidance — and refreshing your plan",
    body:
      "Plan & Guidance covers housing, departure, pets, tax and rule monitoring — context, not your daily list. One last thing: Refresh research pulls fresh facts for a section; Regenerate applies them to your checklist. Refresh first, then regenerate.",
  },
]

export function DashboardGuidedTour({
  open,
  onClose,
}: DashboardGuidedTourProps) {
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  useEffect(() => {
    setMounted(true)
  }, [])

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

  return createPortal(
    <AnimatePresence>
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
                  className="space-y-1"
                >
                  <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                    {current.icon}
                    {current.title}
                  </h2>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {current.body}
                  </p>
                  {isLast && (
                    <p className="text-[11px] text-muted-foreground/80 mt-2 flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3" />
                      Replay anytime via the Tour button in the dashboard header.
                    </p>
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
