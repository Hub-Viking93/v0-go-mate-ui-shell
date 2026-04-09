"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Landmark,
  Smartphone,
  FileText,
  MapPin,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { FullPageGate } from "@/components/tier-gate"
import { useTier } from "@/hooks/use-tier"
import { cn } from "@/lib/utils"

interface BankInfo {
  name: string
  type: string
  features: string[]
  url?: string
}

interface BankingWizardData {
  planId: string
  destination: string
  city: string
  banks: BankInfo[]
  bankingNotes: string
  steps: string[]
  documentsNeeded: string[]
  digitalBridgeOptions: Array<{ name: string; url: string; features: string[] }>
  officialLinks: Array<{ name: string; url: string }>
  tips: string[]
  estimatedTime: string | null
}

const WIZARD_STEPS = [
  { key: "banks", label: "Choose Your Bank", icon: Landmark },
  { key: "bridge", label: "Digital Bridge", icon: Smartphone },
  { key: "documents", label: "Gather Documents", icon: FileText },
  { key: "visit", label: "Visit the Branch", icon: MapPin },
]

function getStorageKey(planId: string) {
  return `gomate:banking-wizard-step:${planId}`
}

export default function BankingPage() {
  const router = useRouter()
  const { tier } = useTier()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BankingWizardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/banking-wizard")
        if (!res.ok) {
          const body = await res.json()
          setError(body.error || "Failed to load")
          return
        }
        const result = await res.json()
        setData(result)
        // Restore step from localStorage
        const saved = localStorage.getItem(getStorageKey(result.planId))
        if (saved) {
          const step = parseInt(saved, 10)
          if (step >= 0 && step <= 3) setCurrentStep(step)
        }
      } catch {
        setError("Failed to load banking wizard")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  function goToStep(step: number) {
    setCurrentStep(step)
    if (data) localStorage.setItem(getStorageKey(data.planId), String(step))
  }

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
          <Landmark className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">{error || "Could not load banking wizard"}</h2>
          <p className="text-muted-foreground">Try refreshing the page.</p>
          <Button asChild><Link href="/settling-in">Back to Settling In</Link></Button>
        </div>
      </div>
    )
  }

  const StepIcon = WIZARD_STEPS[currentStep].icon

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
              <h1 className="text-2xl font-bold text-foreground">Banking Setup Wizard</h1>
              <p className="text-muted-foreground">
                Open a bank account in {data.destination}{data.city ? ` (${data.city})` : ""}
              </p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {WIZARD_STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <button
                    onClick={() => goToStep(i)}
                    className={cn(
                      "flex flex-col items-center gap-1 flex-1",
                      "cursor-pointer"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                      i < currentStep && "bg-emerald-500 border-emerald-500 text-white",
                      i === currentStep && "bg-primary border-primary text-primary-foreground",
                      i > currentStep && "border-muted-foreground/30 text-muted-foreground bg-background",
                    )}>
                      {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={cn(
                      "text-[10px] text-center leading-tight",
                      i === currentStep ? "text-primary font-medium" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </button>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={cn(
                      "h-0.5 flex-1 mx-1 mt-[-18px]",
                      i < currentStep ? "bg-emerald-500" : "bg-muted-foreground/20"
                    )} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Step content */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            {currentStep === 0 && <StepBanks data={data} />}
            {currentStep === 1 && <StepDigitalBridge data={data} />}
            {currentStep === 2 && <StepDocuments data={data} />}
            {currentStep === 3 && <StepBranch data={data} />}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => goToStep(currentStep - 1)}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            {currentStep < 3 ? (
              <Button onClick={() => goToStep(currentStep + 1)}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button asChild>
                <Link href="/settling-in">Done <CheckCircle2 className="w-4 h-4 ml-1" /></Link>
              </Button>
            )}
          </div>

          {/* Disclaimer */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              We don&apos;t have commercial relationships with these institutions. Recommendations are based on expat community feedback.
            </p>
          </div>
        </div>
      </div>
    </FullPageGate>
  )
}

// ── Step 1: Choose Your Bank ──
function StepBanks({ data }: { data: BankingWizardData }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Choose Your Bank</h2>
      {data.bankingNotes && (
        <p className="text-sm text-muted-foreground">{data.bankingNotes}</p>
      )}
      {data.banks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No specific bank recommendations available for {data.destination}. Check local expat forums for advice.
        </p>
      ) : (
        <div className="grid gap-3">
          {data.banks.map((bank) => (
            <div key={bank.name} className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{bank.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {bank.type === "digital" ? "Digital" : "Traditional"}
                </Badge>
              </div>
              {bank.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {bank.features.map((f) => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{f}</span>
                  ))}
                </div>
              )}
              {bank.url && (
                <a href={bank.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> Visit website
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {data.estimatedTime && (
        <p className="text-xs text-muted-foreground">Estimated time to open account: {data.estimatedTime}</p>
      )}
    </div>
  )
}

// ── Step 2: Digital Bridge ──
function StepDigitalBridge({ data }: { data: BankingWizardData }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Get a Digital Bridge</h2>
      <p className="text-sm text-muted-foreground">
        While waiting for your traditional bank account to be set up, use a digital bank to receive money and make payments.
      </p>
      <div className="grid gap-3">
        {data.digitalBridgeOptions.map((opt) => (
          <a key={opt.name} href={opt.url} target="_blank" rel="noopener noreferrer"
            className="p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">{opt.name}</h3>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {opt.features.map((f) => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{f}</span>
                ))}
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Step 3: Gather Documents ──
function StepDocuments({ data }: { data: BankingWizardData }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Gather Your Documents</h2>
      <p className="text-sm text-muted-foreground">
        You&apos;ll typically need these documents to open a bank account.
      </p>
      {data.documentsNeeded.length > 0 ? (
        <ul className="space-y-2">
          {data.documentsNeeded.map((doc, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span className="text-foreground">{doc}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Check with your chosen bank for their specific document requirements.
        </p>
      )}
      <Button variant="outline" size="sm" asChild>
        <Link href="/documents">
          <FileText className="w-4 h-4 mr-1" /> View Document Vault
        </Link>
      </Button>
    </div>
  )
}

// ── Step 4: Visit the Branch ──
function StepBranch({ data }: { data: BankingWizardData }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Visit the Branch</h2>
      {data.steps.length > 0 ? (
        <ol className="space-y-3">
          {data.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-foreground">{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          Contact your chosen bank for appointment booking and branch location details.
        </p>
      )}
      {data.tips.length > 0 && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
          <p className="text-xs font-medium text-foreground">Tips</p>
          {data.tips.map((tip, i) => (
            <p key={i} className="text-xs text-muted-foreground">- {tip}</p>
          ))}
        </div>
      )}
      {data.officialLinks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Official Links</p>
          {data.officialLinks.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> {link.name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
