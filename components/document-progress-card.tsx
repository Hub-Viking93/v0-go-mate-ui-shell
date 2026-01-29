"use client"

import { useMemo } from "react"
import Link from "next/link"
import { FileCheck, ArrowRight, CheckCircle2, Circle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export interface DocumentItem {
  id: string
  document: string
  priority: "critical" | "high" | "medium" | "low"
  required: boolean
}

export interface DocumentStatus {
  completed: boolean
  completedAt?: string
}

interface DocumentProgressCardProps {
  items: DocumentItem[]
  statuses: Record<string, DocumentStatus>
  planId?: string
}

export function DocumentProgressCard({ items, statuses, planId }: DocumentProgressCardProps) {
  const { completedCount, totalCount, progress, criticalRemaining, topIncomplete } = useMemo(() => {
    const completed = items.filter((item) => statuses[item.id]?.completed).length
    const total = items.length
    const prog = total > 0 ? Math.round((completed / total) * 100) : 0

    let criticalIncomplete = 0
    for (const item of items) {
      if (!statuses[item.id]?.completed && item.priority === "critical") {
        criticalIncomplete++
      }
    }

    const incomplete = items
      .filter((item) => !statuses[item.id]?.completed)
      .filter((item) => item.priority === "critical" || item.priority === "high")
      .slice(0, 3)

    return {
      completedCount: completed,
      totalCount: total,
      progress: prog,
      criticalRemaining: criticalIncomplete,
      topIncomplete: incomplete,
    }
  }, [items, statuses])

  const getStatusColor = () => {
    if (progress === 100) return "text-emerald-500"
    if (criticalRemaining > 0) return "text-amber-500"
    if (progress >= 50) return "text-primary"
    return "text-muted-foreground"
  }

  const getStatusMessage = () => {
    if (progress === 100) return "All documents ready!"
    if (criticalRemaining > 0)
      return `${criticalRemaining} critical document${criticalRemaining > 1 ? "s" : ""} remaining`
    if (progress >= 75) return "Almost there!"
    if (progress >= 50) return "Good progress"
    return "Get started on your documents"
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-primary" />
          Document Checklist
        </h3>
        <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80">
          <Link href="/documents">
            View All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Progress Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${getStatusColor()}`}>{getStatusMessage()}</span>
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Quick Status Indicators */}
      {totalCount > 0 && (
        <div className="space-y-2">
          {topIncomplete.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground font-medium mb-2">Priority items:</p>
              {topIncomplete.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30"
                >
                  {item.priority === "critical" ? (
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-foreground truncate">{item.document}</span>
                  {item.required && (
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">Required</span>
                  )}
                </div>
              ))}
            </>
          ) : progress === 100 ? (
            <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                All documents are ready! You&apos;re prepared for your move.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="text-primary font-medium">
                All critical documents complete. Keep going!
              </span>
            </div>
          )}
        </div>
      )}

      {/* CTA Button */}
      <Button className="w-full mt-4" variant={criticalRemaining > 0 ? "default" : "outline"} asChild>
        <Link href="/documents">
          <FileCheck className="w-4 h-4 mr-2" />
          {progress === 100 ? "Review Documents" : "Complete Checklist"}
        </Link>
      </Button>
    </div>
  )
}
