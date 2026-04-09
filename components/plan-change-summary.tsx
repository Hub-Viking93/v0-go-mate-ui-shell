"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  DollarSign,
  Globe,
  ListChecks,
  FileText,
  BookOpen,
  RefreshCw,
} from "lucide-react"

export type PlanChangeEffect = {
  area: "timeline" | "budget" | "visa" | "tasks" | "documents" | "guide"
  description: string
  severity: "info" | "attention" | "action_required"
}

export type PlanChangeSummaryData = {
  changedFields: string[]
  effects: PlanChangeEffect[]
  guideNeedsRegeneration: boolean
  previousSnapshot: Record<string, unknown> | null
}

interface PlanChangeSummaryProps {
  summary: PlanChangeSummaryData | null
  open: boolean
  onClose: () => void
  onRegenerateGuide?: () => void
}

const AREA_ICONS: Record<string, typeof Calendar> = {
  timeline: Calendar,
  budget: DollarSign,
  visa: Globe,
  tasks: ListChecks,
  documents: FileText,
  guide: BookOpen,
}

const AREA_LABELS: Record<string, string> = {
  timeline: "Timeline",
  budget: "Budget",
  visa: "Visa",
  tasks: "Tasks",
  documents: "Documents",
  guide: "Guide",
}

const SEVERITY_BADGE: Record<string, { variant: "destructive" | "secondary" | "outline"; label: string }> = {
  action_required: { variant: "destructive", label: "Action Required" },
  attention: { variant: "secondary", label: "Attention" },
  info: { variant: "outline", label: "Info" },
}

export function PlanChangeSummary({
  summary,
  open,
  onClose,
  onRegenerateGuide,
}: PlanChangeSummaryProps) {
  if (!summary || summary.effects.length === 0) return null

  // Group effects by area
  const byArea = new Map<string, PlanChangeEffect[]>()
  for (const effect of summary.effects) {
    const existing = byArea.get(effect.area) || []
    existing.push(effect)
    byArea.set(effect.area, existing)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plan Updated</DialogTitle>
          <DialogDescription>
            Your changes affect {byArea.size} area{byArea.size !== 1 ? "s" : ""} of your relocation plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
          {[...byArea.entries()].map(([area, effects]) => {
            const Icon = AREA_ICONS[area] || FileText
            return (
              <div key={area} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {AREA_LABELS[area] || area}
                </div>
                {effects.map((effect, i) => {
                  const badge = SEVERITY_BADGE[effect.severity]
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 pl-5.5 text-sm text-muted-foreground"
                    >
                      <span className="flex-1">{effect.description}</span>
                      <Badge variant={badge.variant} className="text-xs flex-shrink-0">
                        {badge.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {summary.guideNeedsRegeneration && onRegenerateGuide && (
            <Button onClick={onRegenerateGuide} size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Regenerate Guide
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Got it
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
