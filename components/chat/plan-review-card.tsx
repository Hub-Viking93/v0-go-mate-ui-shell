"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlanReviewCardProps {
  summary: string
  items?: string[]
  onProceed?: () => void
  onCancel?: () => void
  className?: string
}

export function PlanReviewCard({ summary, items, onProceed, onCancel, className }: PlanReviewCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card p-6",
      className
    )}>
      <h4 className="font-semibold text-foreground mb-2">Plan Review</h4>
      <p className="text-sm text-muted-foreground mb-4">{summary}</p>
      
      {items && items.length > 0 && (
        <ul className="space-y-2 mb-6">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      )}
      
      <div className="flex gap-3">
        <Button onClick={onProceed} className="flex-1 gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Proceed
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1 gap-2 bg-transparent">
          <XCircle className="w-4 h-4" />
          Cancel
        </Button>
      </div>
    </div>
  )
}
