"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Scale,
  Loader2,
  ExternalLink,
  FileText,
  CheckCircle2,
  Info,
  Building2,
  Clock,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { FullPageGate } from "@/components/tier-gate"
import { useTier } from "@/hooks/use-tier"
import { cn } from "@/lib/utils"

interface TaxGuideData {
  planId: string
  destination: string
  taxIdName: string
  officeName: string
  registrationSteps: string[]
  documentsNeeded: string[]
  officialLink: string | null
  relatedOfficialLinks: Array<{ name: string; url: string }>
  estimatedTime: string | null
  cost: string | null
  tips: string[]
  fallbackToOfficialLink: boolean
}

export default function TaxRegistrationPage() {
  const router = useRouter()
  const { tier } = useTier()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TaxGuideData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [savingStep, setSavingStep] = useState<number | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/tax-guide")
        if (!res.ok) {
          const body = await res.json()
          setError(body.error || "Failed to load")
          return
        }
        const result: TaxGuideData = await res.json()
        setData(result)

        // Fetch existing progress
        const progressRes = await fetch(`/api/checklist-progress?plan_id=${result.planId}&prefix=tax_guide_`)
        if (progressRes.ok) {
          const progressData = await progressRes.json()
          const done = new Set<number>()
          for (const item of progressData.items || []) {
            if (item.completed) {
              const idx = parseInt(item.item_id.replace("tax_guide_", ""), 10)
              if (!isNaN(idx)) done.add(idx)
            }
          }
          setCompletedSteps(done)
        }
      } catch {
        setError("Failed to load tax registration guide")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const toggleStep = useCallback(async (stepIndex: number) => {
    if (!data) return
    const isCompleted = completedSteps.has(stepIndex)
    const newCompleted = !isCompleted

    // Optimistic update
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      if (newCompleted) next.add(stepIndex)
      else next.delete(stepIndex)
      return next
    })

    setSavingStep(stepIndex)
    try {
      await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: data.planId,
          itemId: `tax_guide_${stepIndex}`,
          completed: newCompleted,
        }),
      })
    } catch {
      // Revert on error
      setCompletedSteps((prev) => {
        const next = new Set(prev)
        if (isCompleted) next.add(stepIndex)
        else next.delete(stepIndex)
        return next
      })
    } finally {
      setSavingStep(null)
    }
  }, [data, completedSteps])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">{error || "Could not load tax guide"}</h2>
          <p className="text-muted-foreground">Try refreshing the page.</p>
          <Button asChild><Link href="/settling-in">Back to Settling In</Link></Button>
        </div>
      </div>
    )
  }

  const stepsCompleted = completedSteps.size
  const totalSteps = data.registrationSteps.length

  return (
    <FullPageGate tier={tier} feature="post_arrival_assistant" onUpgrade={() => router.push("/settings")}>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/settling-in"><ArrowLeft className="w-5 h-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tax Registration Guide</h1>
              <p className="text-muted-foreground">{data.destination}</p>
            </div>
          </div>

          {/* Tax ID Info Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">What is it called?</h2>
            </div>
            <p className="text-2xl font-bold text-foreground">{data.taxIdName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Issued by: <span className="font-medium text-foreground">{data.officeName}</span>
            </p>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
              {data.estimatedTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {data.estimatedTime}
                </span>
              )}
              {data.cost && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> {data.cost}
                </span>
              )}
            </div>
          </div>

          {/* Fallback view */}
          {data.fallbackToOfficialLink ? (
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <p className="text-sm text-muted-foreground">
                Detailed step-by-step instructions are not yet available for {data.destination}.
                Visit the official website for registration instructions.
              </p>
              {data.officialLink && (
                <Button asChild>
                  <a href={data.officialLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Visit Official Website
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Progress */}
              {totalSteps > 0 && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {stepsCompleted} / {totalSteps} steps done
                  </Badge>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${totalSteps > 0 ? (stepsCompleted / totalSteps) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Steps */}
              <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
                <h2 className="text-lg font-semibold text-foreground">Registration Steps</h2>
                <div className="space-y-2">
                  {data.registrationSteps.map((step, i) => {
                    const isDone = completedSteps.has(i)
                    const isSaving = savingStep === i
                    return (
                      <button
                        key={i}
                        onClick={() => toggleStep(i)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left",
                          isDone
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
                            : "bg-card border-border hover:bg-muted/30"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                          isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30"
                        )}>
                          {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isDone ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                          )}
                        </div>
                        <span className={cn(
                          "text-sm flex-1",
                          isDone ? "text-muted-foreground line-through" : "text-foreground"
                        )}>
                          {step}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Documents needed */}
              {data.documentsNeeded.length > 0 && (
                <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
                  <h2 className="text-lg font-semibold text-foreground">Documents Needed</h2>
                  <ul className="space-y-2">
                    {data.documentsNeeded.map((doc, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-foreground">{doc}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/documents">
                      <FileText className="w-4 h-4 mr-1" /> View Document Vault
                    </Link>
                  </Button>
                </div>
              )}

              {/* Tips */}
              {data.tips.length > 0 && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
                  <p className="text-xs font-medium text-foreground">Tips</p>
                  {data.tips.map((tip, i) => (
                    <p key={i} className="text-xs text-muted-foreground">- {tip}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Official links */}
          {(data.officialLink || data.relatedOfficialLinks.length > 0) && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Official Resources</p>
              {data.officialLink && (
                <a href={data.officialLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> Tax Authority
                </a>
              )}
              {data.relatedOfficialLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> {link.name}
                </a>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              This is a general guide based on AI research. Requirements can change. Always verify with the official tax authority.
            </p>
          </div>
        </div>
      </div>
    </FullPageGate>
  )
}
