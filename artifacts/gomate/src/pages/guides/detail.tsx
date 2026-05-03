

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "@/lib/router-compat"
import { Link } from "wouter"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { CountryFlag } from "@/components/country-flag"
import { 
  ArrowLeft,
  Loader2,
  FileText,
  Plane,
  Wallet,
  Home,
  Building2,
  Heart,
  Users,
  Briefcase,
  GraduationCap,
  Calendar,
  CheckSquare,
  ExternalLink,
  Lightbulb,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Clock,
  Globe,
  Download
} from "lucide-react"
import { downloadGuidePDF } from "@/lib/gomate/pdf-generator"
import { ContentDisclaimer } from "@/components/legal-disclaimer"
import { useCurrencyConversion } from "@/hooks/use-currency-conversion"
import { PreMoveTimeline } from "@/components/pre-move-timeline"

/** Renders a multi-paragraph enrichment string as styled prose with
 *  inline markdown (bold, code, links) + Phase 6.2 [n] citation
 *  superscripts wired to source URLs. */
type InlineCitation = { number: number; sourceUrl: string; sourceName: string }
function renderInlineMarkdown(raw: string): React.ReactNode[] {
  // Light tokeniser: **bold**, `code`, [text](url), plain text.
  // Pre-existing `[n]` citations are NOT consumed here; the outer parser
  // handles them so we can render <a>-superscripts.
  const out: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = pattern.exec(raw)) !== null) {
    if (m.index > last) out.push(<span key={`t-${i++}`}>{raw.slice(last, m.index)}</span>)
    const tok = m[0]
    if (tok.startsWith("**")) {
      out.push(<strong key={`b-${i++}`} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={`c-${i++}`} className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-200 font-mono text-[0.88em]">
          {tok.slice(1, -1)}
        </code>,
      )
    } else {
      const linkMatch = tok.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
      if (linkMatch) {
        out.push(
          <a key={`a-${i++}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium">
            {linkMatch[1]}
          </a>,
        )
      } else {
        out.push(<span key={`o-${i++}`}>{tok}</span>)
      }
    }
    last = m.index + tok.length
  }
  if (last < raw.length) out.push(<span key={`t-${i++}`}>{raw.slice(last)}</span>)
  return out
}

function EnrichedProse({
  content,
  className,
  citations,
}: {
  content?: string
  className?: string
  citations?: InlineCitation[]
}) {
  if (!content) return null
  const paragraphs = content.split(/\n\n+/).filter(Boolean)
  const citationByNumber = new Map<number, InlineCitation>()
  for (const c of citations ?? []) citationByNumber.set(c.number, c)

  return (
    <div className={className}>
      {paragraphs.map((p, i) => {
        const parts: Array<string | InlineCitation> = []
        let last = 0
        const re = /\[(\d+)\]/g
        let m: RegExpExecArray | null
        while ((m = re.exec(p)) !== null) {
          if (m.index > last) parts.push(p.slice(last, m.index))
          const num = Number(m[1])
          const cite = citationByNumber.get(num)
          parts.push(cite ?? `[${num}]`)
          last = m.index + m[0].length
        }
        if (last < p.length) parts.push(p.slice(last))
        return (
          <p key={i} className="text-muted-foreground mb-4 leading-[1.7]">
            {parts.map((part, j) =>
              typeof part === "string" ? (
                <React.Fragment key={j}>{renderInlineMarkdown(part)}</React.Fragment>
              ) : (
                <a
                  key={j}
                  href={part.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={part.sourceName}
                  className="inline-flex items-baseline align-super text-[0.7em] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline mx-0.5"
                >
                  [{part.number}]
                </a>
              ),
            )}
          </p>
        )
      })}
    </div>
  )
}

/** Per-section sources panel — listed below the section's prose so the
 * citation [n] markers map onto a visible footer with names + URLs. */
function SectionSources({ citations }: { citations?: InlineCitation[] }) {
  if (!citations || citations.length === 0) return null
  return (
    <div className="mt-6 border-t border-stone-200 dark:border-stone-800 pt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400 mb-2">
        Sources
      </p>
      <ol className="space-y-1.5">
        {citations.map((c) => (
          <li key={c.number} className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground mr-1">[{c.number}]</span>
            <a
              href={c.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              {c.sourceName}
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface GuideSection {
  [key: string]: unknown
}

interface Guide {
  id: string
  plan_id?: string
  title: string
  destination: string
  destination_city?: string
  purpose: string
  currency?: string
  overview: {
    title: string
    subtitle: string
    summary: string
    keyFacts: { label: string; value: string }[]
    lastUpdated: string
  }
  visa_section: {
    recommendedVisa: string
    visaType: string
    eligibility: string
    processingTime: string
    estimatedCost: string
    requirements: string[]
    applicationSteps: string[]
    tips: string[]
    warnings: string[]
    officialLink?: string
    detailedProcess?: string
  }
  budget_section: {
    monthlyBudget: { minimum: number; comfortable: number; breakdown: Record<string, number> }
    savingsTarget: { emergencyFund: number; movingCosts: number; initialSetup: number; visaFees: number; total: number; timeline: string }
    costComparison?: string
    savingStrategy?: string
    tips: string[]
  }
  housing_section: {
    overview: string
    averageRent: { studio: string; oneBed: string; twoBed: string }
    rentalPlatforms: { name: string; url: string; description: string }[]
    depositInfo: string
    tips: string[]
    warnings: string[]
    neighborhoodGuide?: string
    rentalProcess?: string
  }
  banking_section: {
    overview: string
    recommendedBanks: { name: string; type: string; features: string[] }[]
    requirements: string[]
    digitalBanks: { name: string; features: string[] }[]
    tips: string[]
    accountOpeningGuide?: string
  }
  healthcare_section: {
    overview: string
    systemType: string
    insuranceRequirements: string
    registrationSteps: string[]
    emergencyInfo: string
    tips: string[]
    registrationGuide?: string
    insuranceAdvice?: string
  }
  culture_section: {
    overview: string
    language: { official: string; englishLevel: string; learningTips: string[] }
    socialNorms: string[]
    workCulture: string[]
    doAndDonts: { dos: string[]; donts: string[] }
    localTips: string[]
    deepDive?: string
    workplaceCulture?: string
    socialIntegration?: string
  }
  jobs_section?: {
    overview: string
    jobMarket: string
    inDemandSkills: string[]
    jobPlatforms: { name: string; url: string; description: string }[]
    salaryExpectations: string
    workPermitInfo: string
    networkingTips: string[]
    marketOverview?: string
    searchStrategy?: string
  }
  education_section?: {
    overview: string
    systemType: string
    applicationProcess: string[]
    tuitionInfo: string
    scholarships: string[]
    tips: string[]
    systemOverview?: string
    applicationStrategy?: string
  }
  timeline_section: {
    totalMonths: number
    overview?: string
    phases: { name: string; duration: string; tasks: string[]; tips: string[] }[]
  }
  checklist_section: {
    categories: { name: string; items: { task: string; priority: "high" | "medium" | "low"; timeframe: string }[] }[]
  }
  official_links: { name: string; url: string; category: string }[]
  useful_tips: string[]
  created_at: string
  updated_at: string
  status: string
  guide_version?: number
  is_stale?: boolean
  stale_reason?: string
  is_current?: boolean
  profile_snapshot?: Record<string, unknown>
  hero_image_url?: string
  hero_image_attribution?: { photographerName: string; photographerUrl: string }
  /** v2 — Composer output. Contains paragraphs with [n] markers + citations. */
  sections?: Array<{
    key: string
    title: string
    paragraphs: string[]
    citations: Array<{ number: number; sourceUrl: string; sourceName: string; retrievedAt?: string; agentWhoAdded?: string }>
  }>
}

/** Pull the citations array for a given v2 section key (visa, budget, etc.). */
function citationsFor(guide: Guide | null, key: string): InlineCitation[] {
  return (guide?.sections?.find((s) => s.key === key)?.citations ?? []).map((c) => ({
    number: c.number,
    sourceUrl: c.sourceUrl,
    sourceName: c.sourceName,
  }))
}

export default function GuideDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const [guide, setGuide] = useState<Guide | null>(null)
  const [homeCurrency, setHomeCurrency] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [targetDate, setTargetDate] = useState<string | null>(null)
  const [guidePlanId, setGuidePlanId] = useState<string | null>(null)

  // Currency conversion: guide amounts (destination currency) → user's home currency
  const guideCurrency = guide?.currency || "EUR"
  const { formatDual } = useCurrencyConversion(guideCurrency, homeCurrency)

  useEffect(() => {
    async function fetchGuide() {
      try {
        const response = await fetch(`/api/guides/${id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.homeCurrency) {
            setHomeCurrency(data.homeCurrency)
          }
          // Ensure the guide has all required default structures
          const guideData = data.guide
          if (guideData) {
            // Add defaults for potentially missing sections
            guideData.overview = guideData.overview || { title: guideData.title || "Guide", subtitle: "", summary: "", keyFacts: [], lastUpdated: new Date().toISOString() }
            guideData.visa_section = guideData.visa_section || { recommendedVisa: "Not available", visaType: "", eligibility: "", processingTime: "", estimatedCost: "", requirements: [], applicationSteps: [], tips: [], warnings: [] }
            guideData.budget_section = guideData.budget_section || { monthlyBudget: { minimum: 0, comfortable: 0, breakdown: {} }, savingsTarget: { emergencyFund: 0, movingCosts: 0, initialSetup: 0, visaFees: 0, total: 0, timeline: "" }, tips: [] }
            guideData.housing_section = guideData.housing_section || { overview: "", averageRent: {}, rentalPlatforms: [], depositInfo: "", tips: [], warnings: [] }
            guideData.banking_section = guideData.banking_section || { overview: "", recommendedBanks: [], requirements: [], digitalBanks: [], tips: [] }
            guideData.healthcare_section = guideData.healthcare_section || { overview: "", systemType: "", insuranceRequirements: "", registrationSteps: [], emergencyInfo: "", tips: [] }
            guideData.culture_section = guideData.culture_section || { overview: "", language: { official: "", englishLevel: "", learningTips: [] }, socialNorms: [], workCulture: [] }
            guideData.timeline_section = guideData.timeline_section || { phases: [] }
            guideData.checklist_section = guideData.checklist_section || { items: [] }
            guideData.useful_tips = guideData.useful_tips || []
            guideData.official_links = guideData.official_links || []
            setGuide(guideData)
            if (guideData.plan_id) setGuidePlanId(guideData.plan_id)
          } else {
            router.push("/guides")
          }
        } else {
          router.push("/guides")
        }
      } catch (error) {
        console.error("Error fetching guide:", error)
        router.push("/guides")
      } finally {
        setLoading(false)
      }
    }
    fetchGuide()
  }, [id, router])

  // Fetch target_date from profile for timeline
  useEffect(() => {
    async function fetchTargetDate() {
      try {
        const res = await fetch("/api/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.plan?.profile_data?.target_date) {
            setTargetDate(data.plan.profile_data.target_date)
          }
        }
      } catch {
        // Non-critical
      }
    }
    fetchTargetDate()
  }, [])

  const handleDownloadPDF = async () => {
    if (!guide) return
    setDownloading(true)
    try {
      await downloadGuidePDF(guide)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF")
    } finally {
      setDownloading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!guide) return
    setRegenerating(true)
    try {
      // Composer-only regen — uses the specialist outputs already
      // persisted in research_meta.specialists. ~20-30s, no specialist
      // re-runs, no extra API spend. Returns the new guide id which we
      // navigate to.
      const response = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: guide.plan_id,
          guideId: guide.id,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.guideId) {
        router.push(`/guides/${data.guideId}`)
        // Force a fresh fetch on the new id
        setTimeout(() => window.location.reload(), 50)
        return
      }
      alert(data.error || "Failed to regenerate guide. Please try again.")
    } catch (error) {
      console.error("Error regenerating guide:", error)
      alert("Failed to regenerate guide. Please try again.")
    } finally {
      setRegenerating(false)
    }
  }

  const handleDelete = async () => {
    if (!guide || !confirm("Are you sure you want to delete this guide?")) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/guides/${guide.id}`, { method: "DELETE" })
      if (response.ok) {
        router.push("/guides")
      }
    } catch (error) {
      console.error("Error deleting guide:", error)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-10">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!guide) {
    return (
      <div className="p-6 md:p-8 lg:p-10">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Guide not found</p>
          <Button asChild className="mt-4">
            <Link href="/guides">Back to Guides</Link>
          </Button>
        </div>
      </div>
    )
  }

  const priorityColors = {
    high: "text-red-600 bg-red-50 border-red-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    low: "text-green-600 bg-green-50 border-green-200",
  }

  return (
    <div className="p-6 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          asChild
          className="mb-4 -ml-2"
        >
          <Link href="/guides" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Guides
          </Link>
        </Button>

        {guide.hero_image_url && (
          <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden mb-6">
            <img
              src={guide.hero_image_url}
              alt={guide.destination_city ? `${guide.destination_city}, ${guide.destination}` : guide.destination}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            {guide.hero_image_attribution?.photographerName && (
              <p className="absolute bottom-2 right-3 text-xs text-white/70">
                Photo by{" "}
                <a
                  href={`${guide.hero_image_attribution.photographerUrl}?utm_source=gomate&utm_medium=referral`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {guide.hero_image_attribution.photographerName}
                </a>{" "}
                on{" "}
                <a
                  href="https://unsplash.com?utm_source=gomate&utm_medium=referral"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Unsplash
                </a>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <CountryFlag country={guide.destination} size="lg" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {guide.overview?.title || guide.title}
              </h1>
              <p className="text-muted-foreground mt-1">
                {guide.overview?.subtitle}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{guide.purpose}</Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {new Date(guide.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="gap-2 bg-transparent"
            >
              {regenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Regenerate
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2 text-destructive hover:text-destructive bg-transparent"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Staleness Banner */}
      {guide.is_stale && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                This guide may be outdated
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your profile has changed since this guide was generated.
                {guide.stale_reason === "destination_changed" && " Your destination was updated."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="shrink-0 gap-1.5"
          >
            {regenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Regenerate
          </Button>
        </div>
      )}

      {/* Content Disclaimer */}
      <ContentDisclaimer />

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/50">
          <TabsTrigger value="overview" className="gap-1.5">
            <FileText className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="visa" className="gap-1.5">
            <Plane className="w-4 h-4" />
            Visa
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-1.5">
            <Wallet className="w-4 h-4" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="housing" className="gap-1.5">
            <Home className="w-4 h-4" />
            Housing
          </TabsTrigger>
          <TabsTrigger value="practical" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            Practical
          </TabsTrigger>
          <TabsTrigger value="culture" className="gap-1.5">
            <Users className="w-4 h-4" />
            Culture
          </TabsTrigger>
          {guide.jobs_section && (
            <TabsTrigger value="jobs" className="gap-1.5">
              <Briefcase className="w-4 h-4" />
              Jobs
            </TabsTrigger>
          )}
          {guide.education_section && (
            <TabsTrigger value="education" className="gap-1.5">
              <GraduationCap className="w-4 h-4" />
              Education
            </TabsTrigger>
          )}
          <TabsTrigger value="timeline" className="gap-1.5">
            <Calendar className="w-4 h-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5">
            <CheckSquare className="w-4 h-4" />
            Checklist
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">About This Guide</h2>
            <EnrichedProse content={guide.overview?.summary} className="mb-6" />
            
            <h3 className="font-semibold mb-3">Key Facts</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {guide.overview?.keyFacts?.map((fact, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{fact.label}</p>
                  <p className="font-medium">{fact.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Useful Tips */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Useful Tips
            </h2>
            <ul className="space-y-2">
              {guide.useful_tips?.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                  <span className="text-primary mt-1">-</span>
                  {tip}
                </li>
              ))}
            </ul>
          </Card>

          {/* Official Links */}
          {guide.official_links?.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Official Resources
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {guide.official_links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{link.name}</p>
                      <Badge variant="outline" className="text-xs mt-1">{link.category}</Badge>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Visa Tab */}
        <TabsContent value="visa" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">
                  {guide.visa_section?.recommendedVisa || "Visa Information"}
                </h2>
                {guide.visa_section?.visaType && (
                  <p className="text-muted-foreground">{guide.visa_section.visaType}</p>
                )}
              </div>
              {guide.visa_section?.estimatedCost && (
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {guide.visa_section.estimatedCost}
                </Badge>
              )}
            </div>

            {!guide.visa_section?.recommendedVisa && !guide.visa_section?.processingTime && (
              <div className="p-4 rounded-lg bg-muted/50 mb-6">
                <p className="text-sm text-muted-foreground">
                  Detailed visa recommendations are not yet available for this guide. Regenerate the guide to get updated visa pathway information.
                </p>
              </div>
            )}

            {(guide.visa_section?.processingTime || guide.visa_section?.eligibility) && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                {guide.visa_section?.processingTime && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Processing Time</p>
                    <p className="font-semibold">{guide.visa_section.processingTime}</p>
                  </div>
                )}
                {guide.visa_section?.eligibility && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Eligibility</p>
                    <p className="font-semibold">{guide.visa_section.eligibility}</p>
                  </div>
                )}
              </div>
            )}

            {guide.visa_section?.detailedProcess && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Detailed Visa Process</h3>
                <EnrichedProse content={guide.visa_section.detailedProcess} citations={citationsFor(guide, "visa")} />
                <SectionSources citations={citationsFor(guide, "visa")} />
              </div>
            )}

            {guide.visa_section?.requirements && guide.visa_section.requirements.length > 0 && (
              <>
                <h3 className="font-semibold mb-3">Requirements</h3>
                <ul className="space-y-2 mb-6">
                  {guide.visa_section.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {guide.visa_section?.applicationSteps && guide.visa_section.applicationSteps.length > 0 && (
              <>
                <h3 className="font-semibold mb-3">Application Steps</h3>
                <ol className="space-y-3 mb-6">
                  {guide.visa_section.applicationSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium shrink-0">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {guide.visa_section?.warnings && guide.visa_section.warnings.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Important Notes
                </h4>
                <ul className="space-y-1">
                  {guide.visa_section.warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-amber-700">- {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget" className="space-y-6">
          {guide.budget_section?.costComparison && guide.budget_section.costComparison.length > 100 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Cost of Living Overview</h2>
              <EnrichedProse content={guide.budget_section.costComparison} citations={citationsFor(guide, "budget")} />
              <SectionSources citations={citationsFor(guide, "budget")} />
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Monthly Budget</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Minimum</span>
                  <span className="text-2xl font-bold">
                    {guide.budget_section?.monthlyBudget?.minimum != null ? formatDual(guide.budget_section.monthlyBudget.minimum) : "N/A"}/mo
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Comfortable</span>
                  <span className="text-2xl font-bold text-primary">
                    {guide.budget_section?.monthlyBudget?.comfortable != null ? formatDual(guide.budget_section.monthlyBudget.comfortable) : "N/A"}/mo
                  </span>
                </div>
              </div>

              <h3 className="font-semibold mt-6 mb-3">Breakdown</h3>
              <div className="space-y-2">
                {guide.budget_section?.monthlyBudget?.breakdown &&
                  Object.entries(guide.budget_section.monthlyBudget.breakdown).map(([category, amount]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{category}</span>
                      <span>{formatDual(amount as number)}</span>
                    </div>
                  ))
                }
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Savings Target</h2>
              <div className="text-3xl font-bold text-primary mb-2">
                {guide.budget_section?.savingsTarget?.total != null ? formatDual(guide.budget_section.savingsTarget.total) : "N/A"}
              </div>
              <p className="text-muted-foreground mb-4">
                Save over {guide.budget_section?.savingsTarget?.timeline}
              </p>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Emergency Fund (3 months)</span>
                  <span>{guide.budget_section?.savingsTarget?.emergencyFund != null ? formatDual(guide.budget_section.savingsTarget.emergencyFund) : ""}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Moving Costs</span>
                  <span>{guide.budget_section?.savingsTarget?.movingCosts != null ? formatDual(guide.budget_section.savingsTarget.movingCosts) : ""}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Initial Setup</span>
                  <span>{guide.budget_section?.savingsTarget?.initialSetup != null ? formatDual(guide.budget_section.savingsTarget.initialSetup) : ""}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Visa & Fees</span>
                  <span>{guide.budget_section?.savingsTarget?.visaFees != null ? formatDual(guide.budget_section.savingsTarget.visaFees) : ""}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Budget Tips
            </h2>
            <ul className="space-y-2">
              {guide.budget_section?.tips?.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                  <span className="text-primary">-</span>
                  {tip}
                </li>
              ))}
            </ul>
          </Card>

          {guide.budget_section?.savingStrategy && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Saving & Financial Strategy</h2>
              <EnrichedProse content={guide.budget_section.savingStrategy} />
            </Card>
          )}
        </TabsContent>

        {/* Housing Tab */}
        <TabsContent value="housing" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Housing Overview</h2>
            <EnrichedProse content={guide.housing_section?.overview} className="mb-6" citations={citationsFor(guide, "housing")} />
            
            <h3 className="font-semibold mb-3">Average Rent</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">Studio</p>
                <p className="font-semibold">{guide.housing_section?.averageRent?.studio}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">1 Bedroom</p>
                <p className="font-semibold">{guide.housing_section?.averageRent?.oneBed}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">2 Bedroom</p>
                <p className="font-semibold">{guide.housing_section?.averageRent?.twoBed}</p>
              </div>
            </div>

            <h3 className="font-semibold mb-3">Rental Platforms</h3>
            <div className="space-y-2 mb-6">
              {guide.housing_section?.rentalPlatforms?.map((platform, i) => (
                <a
                  key={i}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium">{platform.name}</p>
                    <p className="text-sm text-muted-foreground">{platform.description}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              <strong>Deposit:</strong> {guide.housing_section?.depositInfo}
            </p>
          </Card>

          {guide.housing_section?.neighborhoodGuide && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Neighborhood Guide</h2>
              <EnrichedProse content={guide.housing_section.neighborhoodGuide} />
            </Card>
          )}

          {guide.housing_section?.rentalProcess && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Rental Process</h2>
              <EnrichedProse content={guide.housing_section.rentalProcess} citations={citationsFor(guide, "housing")} />
              <SectionSources citations={citationsFor(guide, "housing")} />
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Tips & Warnings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-green-600" />
                  Tips
                </h3>
                <ul className="space-y-2">
                  {guide.housing_section?.tips?.map((tip, i) => (
                    <li key={i} className="text-sm text-muted-foreground">- {tip}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Warnings
                </h3>
                <ul className="space-y-2">
                  {guide.housing_section?.warnings?.map((warning, i) => (
                    <li key={i} className="text-sm text-muted-foreground">- {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Practical Tab (Banking & Healthcare) */}
        <TabsContent value="practical" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Banking
            </h2>
            <EnrichedProse content={guide.banking_section?.overview} className="mb-6" citations={citationsFor(guide, "banking")} />

            <h3 className="font-semibold mb-3">Recommended Banks</h3>
            <div className="space-y-3 mb-6">
              {guide.banking_section?.recommendedBanks?.map((bank, i) => (
                <div key={i} className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{bank.name}</p>
                    <Badge variant="outline">{bank.type}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {bank.features?.map((feature, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">{feature}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h3 className="font-semibold mb-3">Digital Banks (Easy Setup)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {guide.banking_section?.digitalBanks?.map((bank, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium">{bank.name}</p>
                  <p className="text-sm text-muted-foreground">{bank.features?.join(", ")}</p>
                </div>
              ))}
            </div>

            {guide.banking_section?.accountOpeningGuide && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">How to Open a Bank Account</h3>
                <EnrichedProse content={guide.banking_section.accountOpeningGuide} citations={citationsFor(guide, "banking")} />
                <SectionSources citations={citationsFor(guide, "banking")} />
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Healthcare
            </h2>
            <EnrichedProse content={guide.healthcare_section?.overview} className="mb-4" citations={citationsFor(guide, "healthcare")} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">System Type</p>
                <p className="font-medium">{guide.healthcare_section?.systemType}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Emergency</p>
                <p className="font-medium">{guide.healthcare_section?.emergencyInfo}</p>
              </div>
            </div>

            <h3 className="font-semibold mb-3">Registration Steps</h3>
            <ol className="space-y-2 mb-6">
              {guide.healthcare_section?.registrationSteps?.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <p className="text-sm text-muted-foreground">
              <strong>Insurance:</strong> {guide.healthcare_section?.insuranceRequirements}
            </p>

            {guide.healthcare_section?.registrationGuide && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Registration Guide</h3>
                <EnrichedProse content={guide.healthcare_section.registrationGuide} />
              </div>
            )}

            {guide.healthcare_section?.insuranceAdvice && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Insurance Advice</h3>
                <EnrichedProse content={guide.healthcare_section.insuranceAdvice} citations={citationsFor(guide, "healthcare")} />
                <SectionSources citations={citationsFor(guide, "healthcare")} />
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Culture Tab */}
        <TabsContent value="culture" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Cultural Overview</h2>
            <EnrichedProse content={guide.culture_section?.overview} className="mb-6" citations={citationsFor(guide, "culture")} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Official Language</p>
                <p className="font-medium">{guide.culture_section?.language?.official}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">English Level</p>
                <p className="font-medium">{guide.culture_section?.language?.englishLevel}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Learning Tips</p>
                <p className="font-medium text-sm">{guide.culture_section?.language?.learningTips?.[0]}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Do's and Don'ts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <h3 className="font-semibold text-green-800 mb-3">Do</h3>
                <ul className="space-y-2">
                  {guide.culture_section?.doAndDonts?.dos?.map((item, i) => (
                    <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                      <span className="text-green-600">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <h3 className="font-semibold text-red-800 mb-3">Don't</h3>
                <ul className="space-y-2">
                  {guide.culture_section?.doAndDonts?.donts?.map((item, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                      <span className="text-red-600">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {guide.culture_section?.deepDive && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Cultural Deep Dive</h2>
              <EnrichedProse content={guide.culture_section.deepDive} />
            </Card>
          )}

          {guide.culture_section?.workplaceCulture && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Workplace Culture</h2>
              <EnrichedProse content={guide.culture_section.workplaceCulture} />
            </Card>
          )}

          {guide.culture_section?.socialIntegration && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Social Integration</h2>
              <EnrichedProse content={guide.culture_section.socialIntegration} citations={citationsFor(guide, "culture")} />
              <SectionSources citations={citationsFor(guide, "culture")} />
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Social Norms & Local Tips</h2>
            <ul className="space-y-2">
              {guide.culture_section?.localTips?.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                  <span className="text-primary">-</span>
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        {/* Jobs Tab */}
        {guide.jobs_section && (
          <TabsContent value="jobs" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Job Market Overview</h2>
              <EnrichedProse content={guide.jobs_section?.overview} className="mb-6" citations={citationsFor(guide, "jobs")} />
              
              <h3 className="font-semibold mb-3">In-Demand Skills</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {guide.jobs_section?.inDemandSkills?.map((skill, i) => (
                  <Badge key={i} variant="secondary">{skill}</Badge>
                ))}
              </div>

              <h3 className="font-semibold mb-3">Job Platforms</h3>
              <div className="space-y-2">
                {guide.jobs_section?.jobPlatforms?.map((platform, i) => (
                  <a
                    key={i}
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{platform.name}</p>
                      <p className="text-sm text-muted-foreground">{platform.description}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>

              {guide.jobs_section?.marketOverview && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Market Analysis</h3>
                  <EnrichedProse content={guide.jobs_section.marketOverview} />
                </div>
              )}

              {guide.jobs_section?.searchStrategy && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Search Strategy</h3>
                  <EnrichedProse content={guide.jobs_section.searchStrategy} citations={citationsFor(guide, "jobs")} />
                  <SectionSources citations={citationsFor(guide, "jobs")} />
                </div>
              )}
            </Card>
          </TabsContent>
        )}

        {/* Education Tab */}
        {guide.education_section && (
          <TabsContent value="education" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Education Overview</h2>
              <EnrichedProse content={guide.education_section?.overview} className="mb-6" citations={citationsFor(guide, "education")} />
              <SectionSources citations={citationsFor(guide, "education")} />
              
              <h3 className="font-semibold mb-3">Application Process</h3>
              <ol className="space-y-2 mb-6">
                {guide.education_section?.applicationProcess?.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Tuition</p>
                  <p className="font-medium">{guide.education_section?.tuitionInfo}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Scholarships</p>
                  <p className="font-medium text-sm">{guide.education_section?.scholarships?.join(", ")}</p>
                </div>
              </div>

              {guide.education_section?.systemOverview && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Education System</h3>
                  <EnrichedProse content={guide.education_section.systemOverview} />
                </div>
              )}

              {guide.education_section?.applicationStrategy && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Application Strategy</h3>
                  <EnrichedProse content={guide.education_section.applicationStrategy} />
                </div>
              )}
            </Card>
          </TabsContent>
        )}

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          {guide.timeline_section?.overview && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Timeline Overview</h2>
              <EnrichedProse content={guide.timeline_section.overview} />
            </Card>
          )}

          {guidePlanId ? (
            <PreMoveTimeline
              timelineSection={guide.timeline_section}
              planId={guidePlanId}
              targetDate={targetDate}
            />
          ) : (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                Timeline data is loading...
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-6">
          {guide.checklist_section?.categories?.map((category, i) => (
            <Card key={i} className="p-6">
              <h2 className="text-xl font-semibold mb-4">{category.name}</h2>
              <div className="space-y-2">
                {category.items?.map((item, j) => (
                  <div 
                    key={j} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <CheckSquare className="w-4 h-4 text-muted-foreground" />
                      <span>{item.task}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={priorityColors[item.priority]}
                      >
                        {item.priority}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{item.timeframe}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
