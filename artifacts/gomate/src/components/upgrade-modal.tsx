

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles, Crown } from "lucide-react"
import type { Tier } from "@/components/tier-gate"

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTier: Tier
  onUpgradeComplete?: () => void
}

type ProCycle = "monthly" | "annual"

const PRO_FEATURES = [
  "Unlimited relocation plans",
  "Visa recommendations & full research",
  "AI-generated relocation guides with citations",
  "Local requirements & cost of living analysis",
  "Budget planner & affordability analysis",
  "Document checklist with status tracking",
  "Pre-move timeline & checklist",
  "Visa application tracker",
  "Post-arrival settling-in checklist",
  "Banking & tax registration guides",
  "Compliance calendar, alerts & iCal export",
  "Post-arrival AI assistant & free chat",
  "Wellbeing check-ins",
  "Plan consistency monitoring",
]

export function UpgradeModal({ open, onOpenChange, currentTier }: UpgradeModalProps) {
  const [cycle, setCycle] = useState<ProCycle>("annual")
  const [notice, setNotice] = useState<string | null>(null)

  const monthlyPrice = "$39/mo"
  const annualPrice = "$299/yr"
  const annualSavings = "Saves ~36%"
  const isPro = currentTier === "pro"

  function handleUpgrade() {
    setNotice(
      "GoMate is currently in beta. Plan upgrades will go live at launch — stay tuned!",
    )
  }

  function handleDowngrade() {
    setNotice("GoMate is currently in beta. Plan changes will be available when we launch.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {isPro ? "Manage your plan" : "Upgrade to Pro"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isPro
              ? "You're on Pro — full access to every GoMate feature."
              : "One simple upgrade unlocks everything GoMate can do for your move."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Free tier */}
          <div
            className={`relative rounded-2xl border p-5 flex flex-col ${
              currentTier === "free"
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Free</h3>
              {currentTier === "free" && (
                <Badge variant="secondary" className="text-xs">
                  Current
                </Badge>
              )}
            </div>
            <div className="mt-2 mb-4">
              <span className="text-2xl font-bold text-foreground">$0</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {[
                "Full chat interview",
                "Profile building (65+ fields)",
                "Basic country overview",
                "1 active relocation plan",
              ].map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier !== "free" ? (
              <Button
                variant="outline"
                className="w-full rounded-xl bg-transparent"
                onClick={handleDowngrade}
              >
                Downgrade
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full rounded-xl bg-transparent"
                disabled
              >
                Current plan
              </Button>
            )}
          </div>

          {/* Pro tier */}
          <div
            className={`relative rounded-2xl border-2 p-5 flex flex-col ${
              isPro
                ? "border-primary/50 bg-primary/5"
                : "border-amber-500/40 bg-amber-500/5"
            }`}
          >
            {!isPro && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500 text-xs font-medium">
                  Recommended
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-foreground">Pro</h3>
              {isPro && (
                <Badge variant="secondary" className="text-xs">
                  Current
                </Badge>
              )}
            </div>

            {/* Cycle toggle */}
            <div className="mt-2 mb-4 inline-flex items-center rounded-xl border border-border p-0.5 bg-background self-start">
              <button
                type="button"
                onClick={() => setCycle("monthly")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  cycle === "monthly"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCycle("annual")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  cycle === "annual"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
                <span
                  className={`text-[10px] ${
                    cycle === "annual"
                      ? "text-background/80"
                      : "text-amber-600"
                  }`}
                >
                  −36%
                </span>
              </button>
            </div>

            <div className="mb-1">
              <span className="text-3xl font-bold text-foreground">
                {cycle === "monthly" ? monthlyPrice : annualPrice}
              </span>
              {cycle === "annual" && (
                <span className="ml-2 text-xs text-amber-600 font-medium">
                  {annualSavings}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {cycle === "monthly"
                ? "Cancel anytime."
                : "Billed yearly — best value."}
            </p>

            <ul className="space-y-2 mb-6 flex-1">
              {PRO_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            {isPro ? (
              <Button
                variant="outline"
                className="w-full rounded-xl bg-transparent"
                disabled
              >
                Current plan
              </Button>
            ) : (
              <Button
                className="w-full rounded-xl bg-amber-500 text-amber-950 hover:bg-amber-600"
                onClick={handleUpgrade}
              >
                {cycle === "monthly" ? "Get Pro" : "Get Pro for the year"}
              </Button>
            )}
          </div>
        </div>

        {notice && (
          <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-lg px-4 py-3 text-center mt-4">
            {notice}
          </p>
        )}

        <p className="text-xs text-muted-foreground text-center mt-4">
          GoMate is in beta. Beta testers have full Pro access — billing goes live at launch.
        </p>
      </DialogContent>
    </Dialog>
  )
}
