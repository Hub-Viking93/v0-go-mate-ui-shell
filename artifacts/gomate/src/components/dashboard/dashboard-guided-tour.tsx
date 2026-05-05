import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Compass,
  Stamp,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  LayoutGrid,
  UserSquare2,
  Wallet,
  Home,
  Menu,
} from "lucide-react"
import type { DashboardTabId } from "@/components/dashboard-tabs"

interface DashboardGuidedTourProps {
  open: boolean
  onClose: () => void
  /**
   * Called when the tour wants to switch the active dashboard tab.
   * The dashboard owns the tab state and re-renders the tab content
   * behind the tour popup so the user sees what each step describes.
   */
  onTabChange?: (tab: DashboardTabId) => void
}

interface TourStep {
  emoji: string
  icon: React.ReactNode
  title: string
  body: string
  /** Switch the dashboard to this tab when this step is shown. */
  tab?: DashboardTabId
}

const STEPS: TourStep[] = [
  {
    emoji: "👋",
    icon: <Sparkles className="h-5 w-5 text-[#5EE89C]" />,
    title: "Welcome to your relocation plan",
    body:
      "Your specialists just finished researching. Everything you need lives on this dashboard — let's take a 30-second tour. Tabs at the top group the content; the sidebar on the left jumps to deeper tools.",
  },
  {
    emoji: "🗺️",
    icon: <LayoutGrid className="h-5 w-5 text-[#5EE89C]" />,
    title: "Overview",
    body:
      "Your move at a glance: destination, purpose, key dates, and how confident the plan is. Start every visit here for the high-level picture.",
    tab: "overview",
  },
  {
    emoji: "👤",
    icon: <UserSquare2 className="h-5 w-5 text-blue-500" />,
    title: "Profile",
    body:
      "Everything we know about you — citizenship, savings, family, timeline. Edit a field here and the whole plan re-flows around it.",
    tab: "profile",
  },
  {
    emoji: "🛂",
    icon: <Stamp className="h-5 w-5 text-amber-600" />,
    title: "Visa & Legal",
    body:
      "Side-by-side visa routes shortlisted for your profile, plus the documents and deadlines each one demands. Pick a path here and the rest of the plan adapts.",
    tab: "visa",
  },
  {
    emoji: "💰",
    icon: <Wallet className="h-5 w-5 text-emerald-600" />,
    title: "Money",
    body:
      "Budget, cost of living, currency, tax exposure — your move's financials in one place so you know what's affordable and what's not.",
    tab: "money",
  },
  {
    emoji: "🏡",
    icon: <Home className="h-5 w-5 text-rose-500" />,
    title: "Settling",
    body:
      "After arrival this becomes your day-by-day playbook: population register, bank, healthcare, schools, taxes — every local admin step in order.",
    tab: "settling",
  },
  {
    emoji: "🧭",
    icon: <Menu className="h-5 w-5 text-purple-500" />,
    title: "Sidebar shortcuts",
    body:
      "Look at the left sidebar — Chat opens the AI assistant for questions, Visa is the application tracker, Checklist is your task list, Guides holds the long-form playbooks, Pre-departure handles the move week, Settings manages your account.",
  },
  {
    emoji: "✨",
    icon: <Compass className="h-5 w-5 text-[#5EE89C]" />,
    title: "You're set",
    body:
      "Re-run this tour anytime from the “Tour” button in the dashboard header. Good luck with the move!",
  },
]

export function DashboardGuidedTour({
  open,
  onClose,
  onTabChange,
}: DashboardGuidedTourProps) {
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Reset to step 0 every time the tour opens.
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Whenever the active step has a tab, switch to it so the dashboard
  // content behind the popup matches what the step describes.
  useEffect(() => {
    if (!open) return
    const t = STEPS[step]?.tab
    if (t && onTabChange) onTabChange(t)
  }, [open, step, onTabChange])

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
              <div className="absolute inset-0 rounded-full bg-[#5EE89C]/20 blur-lg" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#5EE89C]/15 to-[#1B3A2D]/10 ring-1 ring-[#5EE89C]/40">
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
                      ? "w-5 bg-[#1B3A2D] dark:bg-[#5EE89C]"
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
