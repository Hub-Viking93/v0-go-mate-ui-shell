"use client"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Check, Sparkles, Zap, Crown } from "lucide-react"
import type { Tier } from "@/components/tier-gate"

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTier: Tier
  onUpgradeComplete?: () => void
}

type ProPlusCycle = "monthly" | "quarterly" | "biannual" | "annual"

const PRO_PLUS_CYCLES: { value: ProPlusCycle; label: string; price: string; note: string | null }[] = [
  { value: "monthly", label: "Monthly", price: "249 kr/mo", note: null },
  { value: "quarterly", label: "3 Months", price: "599 kr", note: "Save 20%" },
  { value: "biannual", label: "6 Months", price: "999 kr", note: "Save 33%" },
  { value: "annual", label: "Annual", price: "1 699 kr", note: "Save 43%" },
]

export function UpgradeModal({ open, onOpenChange, currentTier, onUpgradeComplete }: UpgradeModalProps) {
  const [selectedCycle, setSelectedCycle] = useState<ProPlusCycle>("monthly")

  const selectedCycleData = PRO_PLUS_CYCLES.find((c) => c.value === selectedCycle)

  const [notice, setNotice] = useState<string | null>(null)

  function handleUpgrade() {
    setNotice("Plan upgrades are not yet available. Payment integration is coming soon.")
  }

  function handleDowngrade() {
    setNotice("Plan changes are not yet available. Please contact support for assistance.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Unlock the full GoMate relocation experience. Upgrade anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Free Tier */}
          <div className={`relative rounded-2xl border p-5 flex flex-col ${
            currentTier === "free"
              ? "border-primary/50 bg-primary/5"
              : "border-border bg-card"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Free</h3>
              {currentTier === "free" && (
                <Badge variant="secondary" className="text-xs">Current</Badge>
              )}
            </div>
            <div className="mt-2 mb-4">
              <span className="text-2xl font-bold text-foreground">0 kr</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {[
                "Full chat interview",
                "Profile building",
                "Basic relocation overview",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
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
                disabled={false}
              >
                Downgrade
              </Button>
            ) : (
              <Button variant="outline" className="w-full rounded-xl bg-transparent" disabled>
                Current plan
              </Button>
            )}
          </div>

          {/* Pro Single */}
          <div className={`relative rounded-2xl border p-5 flex flex-col ${
            currentTier === "pro_single"
              ? "border-primary/50 bg-primary/5"
              : "border-border bg-card"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Pro Single</h3>
              {currentTier === "pro_single" && (
                <Badge variant="secondary" className="text-xs">Current</Badge>
              )}
            </div>
            <div className="mt-2 mb-1">
              <span className="text-2xl font-bold text-foreground">699 kr</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">One-time payment</p>
            <ul className="space-y-2 mb-6 flex-1">
              {[
                "Everything in Free",
                "Visa recommendations",
                "Local requirements",
                "Cost of living analysis",
                "Budget planner",
                "Full relocation guide",
                "Document checklist",
                "Flight search",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "pro_single" ? (
              <Button variant="outline" className="w-full rounded-xl bg-transparent" disabled>
                Current plan
              </Button>
            ) : currentTier === "pro_plus" ? (
              <Button
                variant="outline"
                className="w-full rounded-xl bg-transparent"
                onClick={handleUpgrade}
                disabled={false}
              >
                Switch to Pro Single
              </Button>
            ) : (
              <Button
                className="w-full rounded-xl"
                onClick={handleUpgrade}
                disabled={false}
              >
                Get Pro Single
              </Button>
            )}
          </div>

          {/* Pro+ */}
          <div className={`relative rounded-2xl border-2 p-5 flex flex-col ${
            currentTier === "pro_plus"
              ? "border-amber-500/50 bg-amber-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500 text-xs font-medium">
                Recommended
              </Badge>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-foreground">Pro+</h3>
              {currentTier === "pro_plus" && (
                <Badge variant="secondary" className="text-xs">Current</Badge>
              )}
            </div>
            <div className="mt-2 mb-1">
              <span className="text-2xl font-bold text-foreground">{selectedCycleData?.price}</span>
            </div>

            {/* Billing cycle selector */}
            <div className="mb-4">
              <Select value={selectedCycle} onValueChange={(v) => setSelectedCycle(v as ProPlusCycle)}>
                <SelectTrigger className="w-full rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRO_PLUS_CYCLES.map((cycle) => (
                    <SelectItem key={cycle.value} value={cycle.value}>
                      <span className="flex items-center gap-2">
                        {cycle.label}
                        {cycle.note && (
                          <span className="text-xs text-amber-600 font-medium">{cycle.note}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ul className="space-y-2 mb-6 flex-1">
              {[
                "Everything in Pro Single",
                "Unlimited relocation plans",
                "Post-relocation checklist",
                "Post-arrival AI assistant",
                "Compliance alerts",
                "Budget reality tracking",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "pro_plus" ? (
              <Button variant="outline" className="w-full rounded-xl bg-transparent" disabled>
                Current plan
              </Button>
            ) : (
              <Button
                className="w-full rounded-xl bg-amber-500 text-amber-950 hover:bg-amber-600"
                onClick={handleUpgrade}
                disabled={false}
              >
                Get Pro+
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
          Payment integration coming soon. Plan changes will be available after Stripe integration.
        </p>
      </DialogContent>
    </Dialog>
  )
}
