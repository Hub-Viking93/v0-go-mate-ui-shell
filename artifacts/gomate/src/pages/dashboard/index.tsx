

import { Link, useLocation } from "wouter"
import { useRouter } from "@/lib/router-compat"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrustBadge, type TrustSource } from "@/components/trust-badge"
import { StatCard } from "@/components/stat-card"
import { InfoCard } from "@/components/info-card"
import { CountdownTimer } from "@/components/countdown-timer"
import { BudgetPlanCard, type BudgetPlanData } from "@/components/budget-plan-card"
import { VisaRoutesCard, type VisaData } from "@/components/visa-routes-card"
import { VisaResearchCard, type VisaResearchData } from "@/components/visa-research-card"
import { LocalRequirementsCard, type LocalRequirementsData } from "@/components/local-requirements-card"
import { type DocumentItem, type DocumentStatus } from "@/components/document-progress-card"
import { CountryFlag } from "@/components/country-flag"
import { VisaStatusBadge } from "@/components/visa-status-badge"
import { ProfileDetailsCard } from "@/components/profile-details-card"
import { DashboardTabs, DashboardPanel, type DashboardTabId } from "@/components/dashboard-tabs"
import { computeInterviewProgress } from "@/lib/gomate/progress"
import { DashboardAuditProvider } from "@/lib/audit-context"
import { CostOfLivingCard } from "@/components/cost-of-living-card"
import { AffordabilityCard } from "@/components/affordability-card"
import { TaxOverviewCard } from "@/components/tax-overview-card"
import { getCurrencyFromCountry, resolveUserCurrency } from "@/lib/gomate/currency"
import { PlanConsistencyAlerts } from "@/components/plan-consistency-alerts"
import { CommonlyForgottenSection } from "@/components/commonly-forgotten-section"
import { PlanChangeSummary, type PlanChangeSummaryData } from "@/components/plan-change-summary"
import { PlanSwitcher } from "@/components/plan-switcher"
import { TierGate } from "@/components/tier-gate"
import { ArrivalBanner } from "@/components/arrival-banner"
import { VisaStatusTile, ChecklistStatusTile } from "@/components/dashboard-status-tiles"
import { normalizeDocumentStatus } from "@/lib/gomate/types/document-status"
import { ComplianceAlerts } from "@/components/compliance-alerts"
import { useTier } from "@/hooks/use-tier"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  MapPin, 
  Calendar, 
  TrendingUp, 
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  ExternalLink,
  MessageSquare,
  FileText,
  Sparkles,
  Lock,
  Unlock,
  Shield,
  Loader2,
  AlertCircle,
  Compass
} from "lucide-react"
import { type Profile } from "@/lib/gomate/profile-schema"
import { cn } from "@/lib/utils"
import {
  deriveDashboardState,
  computeVisibleCards,
  type CardId,
  type DashboardPlanSnapshot,
  type DashboardProgressSnapshot,
  type DashboardSettlingSummary,
  type VisibleCard,
} from "@/lib/gomate/dashboard-state"
import { PLACEHOLDER_CARD_REGISTRY } from "@/components/dashboard-cards/placeholder-cards"
import { ResearchProgressModal } from "@/components/research/ResearchProgressModal"
import { DashboardGuidedTour } from "@/components/dashboard/dashboard-guided-tour"

interface RelocationPlan {
  id: string
  user_id: string
  profile_data: Profile
  stage: string
  lifecycle: string
  title: string | null
  status: string
  is_current: boolean
  locked: boolean
  locked_at: string | null
  research_status: string | null
  research_completed_at: string | null
  user_triggered_research_at?: string | null
  user_triggered_pre_departure_at?: string | null
  /** Phase 7 wiring — per-specialist outputs persisted by the
   * research-orchestrator finalize step. Keyed by specialist name. */
  research_meta?: {
    specialists?: Record<string, {
      contentParagraphs?: string[]
      citations?: { url: string; label?: string; scraped?: boolean }[]
      domainSpecificData?: Record<string, unknown>
      quality?: "full" | "partial" | "fallback"
      retrievedAt?: string
      fallbackReason?: string
    }>
    [k: string]: unknown
  } | null
  visa_application: {
    selectedVisaType?: string | null
    applicationStatus?: string | null
    visaExpiryDate?: string | null
  } | null
  plan_version: number
  canEditProfile: boolean
  canLock: boolean
  readiness?: {
    requiredCount: number
    filledCount: number
    confirmedCount: number
    isStructurallyComplete: boolean
    isReadyForLock: boolean
  }
  created_at: string
  updated_at: string
}

interface UserGuide {
  id: string
  title: string
  destination: string
  purpose: string
  created_at: string
}

function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return "Not set"
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

// Default mock data for when profile is incomplete
const defaultMockData = {
  targetDate: "2026-06-15",
  checklistItems: [
    { id: 1, title: "Research visa requirements", status: "completed" },
    { id: 2, title: "Gather required documents", status: "completed" },
    { id: 3, title: "Schedule embassy appointment", status: "in-progress" },
    { id: 4, title: "Book accommodation", status: "pending" },
    { id: 5, title: "Open international bank account", status: "pending" },
  ],
  recentGuides: [
    { name: "Germany", slug: "germany", tag: "Work" },
    { name: "Japan", slug: "japan", tag: "Study" },
    { name: "Portugal", slug: "portugal", tag: "Settle" },
  ],
  savedSources: [
    { title: "German Embassy - Visa Information", url: "https://www.germany.info/us-en" },
    { title: "Federal Foreign Office - Entry Requirements", url: "https://www.auswaertiges-amt.de" },
  ],
}

// Generate budget based on profile
function generateBudgetFromProfile(profile: Profile, monthsUntilMove: number = 6): BudgetPlanData {
  const destination = profile.destination || "Germany"
  const purpose = profile.purpose || "work"
  
  // Adjust costs based on destination (simplified)
  const costMultiplier = destination.toLowerCase().includes("switzerland") ? 1.5 
    : destination.toLowerCase().includes("portugal") ? 0.7
    : destination.toLowerCase().includes("japan") ? 1.2
    : destination.toLowerCase().includes("singapore") ? 1.4
    : destination.toLowerCase().includes("london") || destination.toLowerCase().includes("uk") ? 1.3
    : destination.toLowerCase().includes("dubai") || destination.toLowerCase().includes("uae") ? 1.1
    : 1
  
  // Calculate total savings target based on cost of living and move complexity
  const baseSavings = 15000 * costMultiplier
  const totalTarget = Math.round(baseSavings)
  const monthlyTarget = monthsUntilMove > 0 ? Math.round(totalTarget / monthsUntilMove) : totalTarget
  
  // The numbers in this budget come from a USD-magnitude template (15000
  // baseline, dollar-denominated category buckets) — labelling them as the
  // destination's local currency mis-renders ($1500/mo becomes ₱1500/mo
  // which is ~$26 in real money). Force USD so the magnitude matches the
  // currency symbol. Same approach as the Cost-of-Living card. Real
  // localised budgets land when the cost specialist's output gets wired
  // into this card.
  void destination
  const destinationCurrency = "USD"

  return {
    currency: destinationCurrency,
    totalSavingsTarget: totalTarget,
    monthlySavingsTarget: monthlyTarget,
    monthsUntilMove,
    breakdown: [
      { category: "Visa & Immigration Fees", oneTime: Math.round(150 * costMultiplier), notes: `${purpose === "work" ? "Work permit" : purpose === "study" ? "Student visa" : "Residence permit"} application` },
      { category: "Flight & Initial Travel", oneTime: Math.round(800 * costMultiplier), notes: "One-way + luggage" },
      { category: "Security Deposit", oneTime: Math.round(3000 * costMultiplier), notes: "3 months rent upfront" },
      { category: "First Month Rent", oneTime: Math.round(1200 * costMultiplier), notes: `${destination} average` },
      { category: "Health Insurance", monthly: Math.round(200 * costMultiplier), notes: "Public or private" },
      { category: "Living Expenses", monthly: Math.round(1500 * costMultiplier), notes: "Food, transport, utilities" },
      { category: "Emergency Fund", oneTime: Math.round(3000 * costMultiplier), notes: "3 months buffer" },
    ],
    recommendations: [
      `Start learning the local language - even basic level helps with daily life`,
      "Open an international bank account before arrival for easier banking",
      "Register at local authorities within first 2 weeks of arrival",
    ],
  }
}

// Country-specific visa information with official sources
const VISA_DATABASE: Record<string, {
  workVisas: Array<{
    name: string
    difficulty: "Easy" | "Moderate" | "Hard"
    why_recommended: string
    processing_time: string
    estimated_cost: string
    validity_period: string
    path_to_residence: string
    requirements: string[]
    officialLink?: string
  }>
  studyVisas: Array<{
    name: string
    difficulty: "Easy" | "Moderate" | "Hard"
    why_recommended: string
    processing_time: string
    estimated_cost: string
    validity_period: string
    path_to_residence: string
    requirements: string[]
    officialLink?: string
  }>
  embassyUrl?: string
}> = {
  Japan: {
    workVisas: [
      {
        name: "Engineer/Specialist in Humanities Visa",
        difficulty: "Moderate",
        why_recommended: "Most common work visa for professionals with university degrees",
        processing_time: "1-3 months",
        estimated_cost: "¥4,000 (~€25)",
        validity_period: "1-5 years (renewable)",
        path_to_residence: "Permanent residence after 10 years (or 3 years with high points)",
        requirements: [
          "University degree or 10+ years work experience",
          "Job offer from Japanese company",
          "Certificate of Eligibility from Immigration",
          "Valid passport",
        ],
        officialLink: "https://www.mofa.go.jp/j_info/visit/visa/index.html",
      },
      {
        name: "Highly Skilled Professional Visa",
        difficulty: "Moderate",
        why_recommended: "Fast track to permanent residence with additional benefits",
        processing_time: "2-4 weeks",
        estimated_cost: "¥4,000 (~€25)",
        validity_period: "5 years",
        path_to_residence: "Permanent residence after 1-3 years based on points",
        requirements: [
          "Score 70+ points on HSP points system",
          "University degree",
          "Job offer with annual salary above threshold",
          "Certificate of Eligibility",
        ],
        officialLink: "https://www.moj.go.jp/isa/publications/materials/newimmiact_3_preferential_index.html",
      },
    ],
    studyVisas: [
      {
        name: "Student Visa (College Student)",
        difficulty: "Easy",
        why_recommended: "Standard visa for university or language school enrollment",
        processing_time: "1-2 months",
        estimated_cost: "¥4,000 (~€25)",
        validity_period: "Duration of studies (up to 4 years)",
        path_to_residence: "Can switch to work visa after graduation",
        requirements: [
          "Acceptance letter from accredited institution",
          "Proof of funds (¥2M+ or sponsor)",
          "Valid passport",
          "Certificate of Eligibility from school",
        ],
        officialLink: "https://www.studyinjapan.go.jp/en/planning/visa/",
      },
    ],
    embassyUrl: "https://www.mofa.go.jp/about/emb_cons/mofaserv.html",
  },
  Germany: {
    workVisas: [
      {
        name: "EU Blue Card",
        difficulty: "Moderate",
        why_recommended: "Best option for skilled workers - fast track to permanent residence",
        processing_time: "4-8 weeks",
        estimated_cost: "€75-100",
        validity_period: "4 years",
        path_to_residence: "Permanent residence after 21-27 months",
        requirements: [
          "University degree (recognized in Germany)",
          "Job offer with salary €45,300+/year (€41,000 for shortage occupations)",
          "Valid passport",
          "Health insurance",
        ],
        officialLink: "https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card",
      },
      {
        name: "Job Seeker Visa",
        difficulty: "Easy",
        why_recommended: "6-month visa to search for employment in Germany",
        processing_time: "2-4 weeks",
        estimated_cost: "€75",
        validity_period: "6 months",
        path_to_residence: "Convert to work permit if employed",
        requirements: [
          "University degree",
          "Proof of funds (€11,208 in blocked account)",
          "Health insurance",
          "CV and cover letter",
        ],
        officialLink: "https://www.make-it-in-germany.com/en/visa-residence/types/job-search",
      },
    ],
    studyVisas: [
      {
        name: "Student Visa (Studienvisum)",
        difficulty: "Easy",
        why_recommended: "Access to tuition-free public universities",
        processing_time: "4-8 weeks",
        estimated_cost: "€75",
        validity_period: "Duration of studies",
        path_to_residence: "18-month job search visa after graduation",
        requirements: [
          "University admission letter",
          "Proof of funds (€11,208/year in blocked account)",
          "Health insurance",
          "German language certificate (varies by program)",
        ],
        officialLink: "https://www.study-in-germany.de/en/plan-your-studies/visa-and-residence-permit/",
      },
    ],
    embassyUrl: "https://www.auswaertiges-amt.de/en/aussenpolitik/laenderinformationen",
  },
  "United Kingdom": {
    workVisas: [
      {
        name: "Skilled Worker Visa",
        difficulty: "Moderate",
        why_recommended: "Main route for sponsored employment in the UK",
        processing_time: "3-8 weeks",
        estimated_cost: "£719-1,420",
        validity_period: "Up to 5 years",
        path_to_residence: "ILR after 5 years",
        requirements: [
          "Job offer from licensed sponsor",
          "Salary threshold (£38,700+ or going rate)",
          "English language B1 level",
          "Valid passport",
        ],
        officialLink: "https://www.gov.uk/skilled-worker-visa",
      },
      {
        name: "Global Talent Visa",
        difficulty: "Hard",
        why_recommended: "For leaders and exceptional talent - no job offer needed",
        processing_time: "3-8 weeks",
        estimated_cost: "£716",
        validity_period: "5 years",
        path_to_residence: "ILR after 3-5 years",
        requirements: [
          "Endorsement from approved body",
          "Proof of exceptional talent or promise",
          "Valid passport",
        ],
        officialLink: "https://www.gov.uk/global-talent",
      },
    ],
    studyVisas: [
      {
        name: "Student Visa",
        difficulty: "Easy",
        why_recommended: "Standard route for higher education in the UK",
        processing_time: "3-4 weeks",
        estimated_cost: "£490",
        validity_period: "Duration of course + 4 months",
        path_to_residence: "Graduate visa (2-3 years) after completion",
        requirements: [
          "CAS from licensed institution",
          "Proof of funds (£1,334/month for London)",
          "English language CEFR B2",
          "Valid passport",
        ],
        officialLink: "https://www.gov.uk/student-visa",
      },
    ],
    embassyUrl: "https://www.gov.uk/world/embassies",
  },
  Singapore: {
    workVisas: [
      {
        name: "Employment Pass (EP)",
        difficulty: "Moderate",
        why_recommended: "For professionals earning $5,000+/month",
        processing_time: "3-8 weeks",
        estimated_cost: "S$105",
        validity_period: "Up to 2 years (first time)",
        path_to_residence: "PR application after 6 months",
        requirements: [
          "Job offer from Singapore company",
          "Minimum salary $5,000/month ($5,500 for finance)",
          "University degree",
          "Valid passport",
        ],
        officialLink: "https://www.mom.gov.sg/passes-and-permits/employment-pass",
      },
      {
        name: "Tech.Pass",
        difficulty: "Moderate",
        why_recommended: "For tech experts and entrepreneurs",
        processing_time: "4-8 weeks",
        estimated_cost: "S$105",
        validity_period: "2 years",
        path_to_residence: "Can apply for PR",
        requirements: [
          "Monthly salary $22,500+ or leadership role at tech company",
          "5+ years experience in tech",
          "Valid passport",
        ],
        officialLink: "https://www.edb.gov.sg/en/how-we-help/incentives-and-schemes/tech-pass.html",
      },
    ],
    studyVisas: [
      {
        name: "Student Pass",
        difficulty: "Easy",
        why_recommended: "For full-time studies at approved institutions",
        processing_time: "2-4 weeks",
        estimated_cost: "S$90",
        validity_period: "Duration of course",
        path_to_residence: "Can work part-time during studies",
        requirements: [
          "Acceptance from approved institution",
          "Proof of sufficient funds",
          "Valid passport",
        ],
        officialLink: "https://www.ica.gov.sg/enter-depart/stay/student-pass",
      },
    ],
    embassyUrl: "https://www.mfa.gov.sg/Overseas-Mission",
  },
}

// Generate visa data based on profile with destination-specific info
function generateVisaDataFromProfile(profile: Profile): VisaData {
  const destination = profile.destination || "Germany"
  const purpose = profile.purpose || "work"
  const citizenship = profile.citizenship || "your country"
  
  // Get country-specific data or default
  const countryData = VISA_DATABASE[destination] || VISA_DATABASE.Germany
  
  let routes
  if (purpose === "work" || purpose === "digital_nomad") {
    routes = countryData.workVisas.map(v => ({
      ...v,
      difficulty: v.difficulty as "Easy" | "Moderate" | "Hard",
    }))
  } else if (purpose === "study") {
    routes = countryData.studyVisas.map(v => ({
      ...v,
      difficulty: v.difficulty as "Easy" | "Moderate" | "Hard",
    }))
  } else {
    // Settlement/other - show both types
    routes = [...countryData.workVisas.slice(0, 1), ...countryData.studyVisas.slice(0, 1)].map(v => ({
      ...v,
      difficulty: v.difficulty as "Easy" | "Moderate" | "Hard",
    }))
  }
  
  return {
    summary: `Based on your profile as someone from ${citizenship} planning to ${purpose} in ${destination}, here are your recommended visa options.`,
    embassyLocation: countryData.embassyUrl || `${destination} Embassy or nearest consulate`,
    routes,
  }
}

// Generate document items based on profile
function generateDocumentItems(profile: Profile): DocumentItem[] {
  const purpose = profile.purpose || "work"
  
  const baseItems: DocumentItem[] = [
    { id: "passport", document: "Valid Passport (6+ months)", priority: "critical", required: true },
    { id: "insurance", document: "Health Insurance Proof", priority: "high", required: true },
    { id: "photo", document: "Biometric Photos", priority: "high", required: true },
    { id: "bank", document: "Bank Statements (3 months)", priority: "high", required: true },
  ]
  
  if (purpose === "work") {
    return [
      ...baseItems,
      { id: "degree", document: "University Degree (apostilled)", priority: "critical", required: true },
      { id: "contract", document: "Employment Contract", priority: "critical", required: true },
      { id: "cv", document: "Updated CV/Resume", priority: "medium", required: false },
    ]
  } else if (purpose === "study") {
    return [
      ...baseItems,
      { id: "admission", document: "University Admission Letter", priority: "critical", required: true },
      { id: "transcript", document: "Academic Transcripts", priority: "high", required: true },
      { id: "language", document: "Language Certificate", priority: "high", required: true },
    ]
  }
  
  return baseItems
}

export default function DashboardPage() {
  const router = useRouter()
  const { tier } = useTier()
  const goToUpgrade = () => router.push("/settings")
  const [plan, setPlan] = useState<RelocationPlan | null>(null)
  const [userGuide, setUserGuide] = useState<UserGuide | null>(null)
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, DocumentStatus>>({})
  const [loading, setLoading] = useState(true)
  const [lockLoading, setLockLoading] = useState(false)
  const [selectedVisaRoute, setSelectedVisaRoute] = useState<number | undefined>(0)
  const [visaResearch, setVisaResearch] = useState<VisaResearchData | null>(null)
  const [localRequirements, setLocalRequirements] = useState<LocalRequirementsData | null>(null)
  const [researchStatus, setResearchStatus] = useState<string | null>(null)
  const [showResearchModal, setShowResearchModal] = useState(false)
  const [showGuidedTour, setShowGuidedTour] = useState(false)
  const [preMoveSummary, setPreMoveSummary] = useState<{
    completed: number
    total: number
    criticalRemaining: number
  }>({ completed: 0, total: 0, criticalRemaining: 0 })

  // Pull pre-departure timeline progress so the Visa & Legal "Checklist"
  // tile reflects real numbers (was hardcoded 0/0 before). The endpoint
  // returns 404 if the user hasn't generated a timeline yet — leave the
  // summary at zeros in that case.
  useEffect(() => {
    if (!plan?.id) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/pre-departure")
        if (!active || !res.ok) return
        const data = await res.json()
        const actions: Array<{ status?: string; onCriticalPath?: boolean }> = data.actions ?? []
        const total = actions.length
        const completed = actions.filter((a) => a.status === "complete").length
        const criticalRemaining = actions.filter(
          (a) => a.onCriticalPath && a.status !== "complete" && a.status !== "skipped",
        ).length
        if (active) setPreMoveSummary({ completed, total, criticalRemaining })
      } catch {
        /* ignore — leave at zeros */
      }
    })()
    return () => { active = false }
  }, [plan?.id, plan?.research_status])

  // Open the progress modal whenever we land on the dashboard with
  // research in flight — either because the URL carries the
  // ?research=triggered hint from onboarding or because the plan row
  // already says research_status=in_progress (e.g. user reloaded mid-run).
  useEffect(() => {
    if (loading) return
    const fromOnboarding =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("research") === "triggered"
    if (fromOnboarding || researchStatus === "in_progress") {
      setShowResearchModal(true)
    }
    // We only want this to react to the loading -> false transition and
    // to a status flip into in_progress, not to subsequent status changes
    // that happen while the modal is already open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, researchStatus])

  // Poll the profile endpoint while research is in_progress so the banner
  // (and the "Tailored to your move" cards underneath) update without the
  // user having to hard-refresh.
  useEffect(() => {
    if (researchStatus !== "in_progress") return
    const tick = setInterval(async () => {
      try {
        const r = await fetch("/api/profile")
        if (!r.ok) return
        const d = await r.json()
        if (d.plan) {
          setPlan(d.plan)
          if (d.plan.research_status) setResearchStatus(d.plan.research_status)
          if (d.plan.visa_research) {
            setVisaResearch(d.plan.visa_research as VisaResearchData)
          }
          if (d.plan.local_requirements_research) {
            setLocalRequirements(d.plan.local_requirements_research as LocalRequirementsData)
          }
        }
      } catch { /* ignore */ }
    }, 8000)
    return () => clearInterval(tick)
  }, [researchStatus])
  const [progressData, setProgressData] = useState<
    (DashboardProgressSnapshot & {
      plan_id: string
      stage: string
      lifecycle: string
    }) | null
  >(null)
  const [settlingSummary, setSettlingSummary] = useState<DashboardSettlingSummary | null>(null)
  const [changeSummary, setChangeSummary] = useState<PlanChangeSummaryData | null>(null)
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview")
  const [changeSummaryOpen, setChangeSummaryOpen] = useState(false)

  // Fetch the user's plan, guide, and document statuses on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [planRes, guidesRes, docsRes, progressRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/guides"),
          fetch("/api/documents"),
          fetch("/api/progress"),
        ])
        
        if (planRes.ok) {
          const data = await planRes.json()
          setPlan(data.plan)
          // Check for cached research data and normalize old shapes
          if (data.plan?.visa_research) {
            const vr = data.plan.visa_research
            // Normalize old format: recommendedVisas -> visaOptions, eligibility values
            const eligMap: Record<string, string> = { likely_eligible: "high", possibly_eligible: "medium", unlikely_eligible: "low" }
            const visaOpts = (vr.visaOptions || vr.recommendedVisas || []).map((v: any) => ({
              ...v,
              eligibility: eligMap[v.eligibility] || v.eligibility || "unknown",
            }))
            setVisaResearch({ ...vr, visaOptions: visaOpts, citizenship: vr.citizenship || vr.nationality })
          }
          if (data.plan?.local_requirements_research) {
            setLocalRequirements(data.plan.local_requirements_research)
          }
          if (data.plan?.research_status) {
            setResearchStatus(data.plan.research_status)
          }
        }
        
        if (guidesRes.ok) {
          const data = await guidesRes.json()
          // Get the most recent guide
          if (data.guides && data.guides.length > 0) {
            setUserGuide(data.guides[0])
          }
        }
        
        if (docsRes.ok) {
          const data = await docsRes.json()
          setDocumentStatuses(data.statuses || {})
        }

        if (progressRes.ok) {
          const data = await progressRes.json()
          setProgressData(data)
        }
      } catch (error) {
        console.error("[GoMate] Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    let active = true

    async function fetchSettlingSummary() {
      if (!plan || plan.lifecycle !== "arrived" || tier !== "pro") {
        if (active) setSettlingSummary(null)
        return
      }

      try {
        const response = await fetch("/api/settling-in")
        if (!response.ok) {
          if (active) setSettlingSummary(null)
          return
        }

        const data = await response.json()
        if (!active) return

        setSettlingSummary({
          generated: Boolean(data.generated),
          stats: {
            total: data.stats?.total || 0,
            completed: data.stats?.completed || 0,
            overdue: data.stats?.overdue || 0,
            available: data.stats?.available || 0,
            locked: data.stats?.locked || 0,
            legalTotal: data.stats?.legalTotal || 0,
            legalCompleted: data.stats?.legalCompleted || 0,
            progressPercent: data.stats?.progressPercent || 0,
          },
        })
      } catch (error) {
        if (active) setSettlingSummary(null)
        console.error("[GoMate] Error fetching settling summary:", error)
      }
    }

    fetchSettlingSummary()

    return () => {
      active = false
    }
  }, [plan?.id, plan?.lifecycle, tier])

  // Lock/unlock handlers
  const handleLockPlan = async () => {
    if (!plan) return
    setLockLoading(true)
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lock",
          planId: plan.id,
          expectedVersion: plan.plan_version,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setPlan(data.plan)
      } else if (response.status === 409) {
        const refreshed = await fetch("/api/profile")
        if (refreshed.ok) {
          const latest = await refreshed.json()
          setPlan(latest.plan)
        }
      }
    } catch (error) {
      console.error("[GoMate] Error locking plan:", error)
    } finally {
      setLockLoading(false)
    }
  }

  const handleUnlockPlan = async () => {
    if (!plan) return
    setLockLoading(true)
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock",
          planId: plan.id,
          expectedVersion: plan.plan_version,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setPlan(data.plan)
      } else if (response.status === 409) {
        const refreshed = await fetch("/api/profile")
        if (refreshed.ok) {
          const latest = await refreshed.json()
          setPlan(latest.plan)
        }
      }
    } catch (error) {
      console.error("[GoMate] Error unlocking plan:", error)
    } finally {
      setLockLoading(false)
    }
  }

  // Extract profile data
  const profile = plan?.profile_data || {} as Profile
  const isLocked = plan?.locked || false
  const hasDestination = !!profile.destination
  const hasCitizenship = !!profile.citizenship
  const hasTimeline = !!profile.timeline
  
  // Compute interview_progress from profile_data using the shared lib
  // (same source-of-truth as ProfileDetailsCard's Journey Overview).
  // The /api/progress endpoint only returns checklist items, so we
  // augment progressData here rather than relying on a server roundtrip
  // for a pure computation we can do from data we already have.
  const interviewProgress = computeInterviewProgress(
    (plan?.profile_data ?? null) as Profile | null,
  )
  const enrichedProgress = {
    ...(progressData ?? {}),
    interview_progress: interviewProgress,
  }

  const dashboardState = deriveDashboardState({
    plan: plan as DashboardPlanSnapshot | null,
    progress: enrichedProgress as typeof progressData,
    settlingSummary,
  })

  // Profile-aware dynamic card visibility — single source of truth.
  // Existing card components keep their internal logic; this set controls
  // which ones get rendered and in what priority order.
  const visibleCards = computeVisibleCards(profile, {
    stage: plan?.stage ?? null,
    lifecycle: plan?.lifecycle ?? null,
    locked: plan?.locked ?? null,
    researchStatus,
    visaApplication: plan?.visa_application ?? null,
  })
  const visibleCardIds = new Set<CardId>(visibleCards.cards.map((c) => c.id))
  const isCardVisible = (id: CardId): boolean => visibleCardIds.has(id)
  // Specialist (placeholder) cards to render in the Profile-aware grid below.
  const specialistCards: VisibleCard[] = visibleCards.cards.filter(
    (c) => c.id in PLACEHOLDER_CARD_REGISTRY,
  )
  const progressPercent =
    enrichedProgress?.interview_progress?.confirmedPercentage ??
    enrichedProgress?.interview_progress?.percentage ??
    0

  // Aggregate trust sources from every research artifact attached to the
  // active plan. Powers the "Grounded in N official sources" badge in the
  // hero — the central source-provenance signal.
  const dashboardTrustSources: TrustSource[] = (() => {
    const out: TrustSource[] = []
    // Visa research — official immigration authority + visa portal
    const vr = visaResearch as unknown as {
      officialSources?: Array<{ name: string; url: string }>
      researchedAt?: string
      visaOptions?: Array<{ sourceUrls?: string[]; officialLink?: string; name?: string }>
    } | null
    if (vr?.officialSources) {
      for (const s of vr.officialSources) {
        if (s?.url) out.push({ name: s.name || s.url, url: s.url, authority: "official", lastVerified: vr.researchedAt?.slice(0, 10) })
      }
    }
    if (vr?.visaOptions) {
      for (const v of vr.visaOptions) {
        if (v?.officialLink) out.push({ name: v.name ? `${v.name} — official portal` : "Official immigration portal", url: v.officialLink, authority: "official", lastVerified: vr.researchedAt?.slice(0, 10) })
        for (const u of v?.sourceUrls ?? []) {
          out.push({ name: extractDomainHelper(u), url: u, authority: "official", lastVerified: vr.researchedAt?.slice(0, 10) })
        }
      }
    }
    // Local requirements
    const lr = localRequirements as unknown as {
      researchedAt?: string
      categories?: Array<{ items?: Array<{ source_url?: string; source?: string }> }>
      documentsDetailed?: Array<{ official_url?: string; name?: string }>
    } | null
    if (lr?.documentsDetailed) {
      for (const d of lr.documentsDetailed) {
        if (d?.official_url) out.push({ name: d.name ? `${d.name} — official source` : "Official source", url: d.official_url, authority: "official", lastVerified: lr.researchedAt?.slice(0, 10) })
      }
    }
    return out
  })()

  // Generate data based on profile or use defaults
  const targetCountry = profile.destination || "Germany"
  const citizenship = profile.citizenship || "United States"
  const targetDate = profile.timeline || defaultMockData.targetDate
  
  // Calculate months until move from timeline
  const calculateMonthsUntilMove = (timeline: string | null): number => {
    if (!timeline) return 6 // default
    
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    
    // Parse various timeline formats
    const timelineLower = timeline.toLowerCase()
    
    // Check for specific month mentions
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
    const monthMatch = months.findIndex(m => timelineLower.includes(m))
    
    // Check for year
    const yearMatch = timeline.match(/20\d{2}/)
    const targetYear = yearMatch ? parseInt(yearMatch[0]) : currentYear
    
    if (monthMatch >= 0) {
      // Calculate months difference
      const targetDate = new Date(targetYear, monthMatch, 1)
      const monthsDiff = (targetDate.getFullYear() - currentYear) * 12 + (targetDate.getMonth() - currentMonth)
      return Math.max(1, monthsDiff)
    }
    
    // Relative time parsing
    if (timelineLower.includes("asap") || timelineLower.includes("soon")) return 2
    if (timelineLower.includes("1 month") || timelineLower.includes("next month")) return 1
    if (timelineLower.includes("3 month")) return 3
    if (timelineLower.includes("6 month")) return 6
    if (timelineLower.includes("1 year") || timelineLower.includes("next year")) return 12
    if (timelineLower.includes("2 year")) return 24
    
    // Check for specific year
    if (targetYear > currentYear) {
      return (targetYear - currentYear) * 12
    }
    
    return 6 // default fallback
  }
  
  const monthsUntilMove = calculateMonthsUntilMove(profile.timeline)
  
  // Format duration for display
  const formatTimeUntilMove = (months: number): string => {
    if (months < 1) return "This month"
    if (months === 1) return "1 month"
    if (months < 12) return `${months} months`
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    if (remainingMonths === 0) return `${years} year${years > 1 ? "s" : ""}`
    return `${years} year${years > 1 ? "s" : ""} ${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`
  }
  
  const budgetData = generateBudgetFromProfile(profile, monthsUntilMove)
  const visaData = generateVisaDataFromProfile(profile)
  const documentItems = generateDocumentItems(profile)

  // Modal close-condition: research is "ready" the moment EITHER
  // (a) the per-card payloads are populated, OR (b) research_status has
  // moved to a terminal value. Either signal means the dashboard
  // behind the modal has something meaningful to show.
  const researchTerminalStatus =
    researchStatus === "completed" ||
    researchStatus === "partial" ||
    researchStatus === "failed"
  const hasResearchData = Boolean(visaResearch && localRequirements)
  const researchDataReady = researchTerminalStatus || hasResearchData

  const handleResearchModalComplete = () => {
    setShowResearchModal(false)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      if (url.searchParams.has("research")) {
        url.searchParams.delete("research")
        window.history.replaceState({}, "", url.toString())
      }
      const tourSeen = window.localStorage.getItem("gomate.guidedTourCompleted.v1")
      if (!tourSeen) {
        // Defer slightly so the modal close-animation doesn't collide
        // with the tour's first highlight ring fading in.
        setTimeout(() => setShowGuidedTour(true), 350)
      }
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  // Show onboarding prompt if profile is mostly empty
  if (dashboardState.showWelcome) {
    return (
      <div className="p-6 md:p-8 lg:p-10">
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="relative inline-block mb-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#1B3A2D] to-[#2D6A4F] flex items-center justify-center shadow-lg">
              <Sparkles className="w-12 h-12 text-[#5EE89C]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <MapPin className="w-4 h-4 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
            {dashboardState.title}
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-md mx-auto text-pretty">
            {dashboardState.description}
          </p>
          <Button asChild size="lg" className="rounded-xl gap-2 px-8 py-6 text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
            <Link href="/onboarding">
              <MessageSquare className="w-5 h-5" />
              {dashboardState.chatActionLabel}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <DashboardAuditProvider profileId={plan?.id ?? null}>
    <div className="p-6 md:p-8 lg:p-10">
      {/* Hero — editorial slab. Deep forest gradient + radial sage glow,
          serif display headline, status row, amber CTA. */}
      <div className="relative overflow-hidden rounded-3xl mb-8 gm-animate-in gm-delay-1"
        style={{
          background:
            "linear-gradient(135deg, #14302A 0%, #1B3A2D 38%, #234D3A 72%, #2D6A4F 100%)",
          boxShadow:
            "0 2px 8px rgba(20,48,42,0.18), 0 24px 48px rgba(20,48,42,0.20)",
        }}>
        {/* Sage glow + grain overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,rgba(141,183,138,0.30),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_-5%_120%,rgba(94,232,156,0.18),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }} />

        <div className="relative p-7 md:p-10 lg:p-12">
          {/* Section eyebrow */}
          <div className="flex items-center gap-2.5 mb-5">
            <span className="h-px w-8 bg-white/30" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Dashboard
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-3xl">
              <h1
                className="text-white"
                style={{
                  fontSize: "clamp(36px, 5.6vw, 56px)",
                  fontWeight: 600,
                  lineHeight: 1.02,
                  letterSpacing: "-0.018em",
                }}
              >
                {profile.name ? `${profile.name}'s move at a glance` : "Your move at a glance"}
              </h1>
              <p className="text-white/65 mt-4 max-w-xl text-pretty text-[16px] md:text-[17px] leading-[1.55]">
                {dashboardState.description}
              </p>

              {/* Status row — trust signals */}
              {hasDestination && (
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/70"
                  style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span>{dashboardState.profileProgressLabel} confirmed</span>
                  {targetCountry && (
                    <>
                      <span className="text-white/30">·</span>
                      <span>Destination: <span className="text-white/90 font-medium">{targetCountry}</span></span>
                    </>
                  )}
                </div>
              )}

              {/* Source provenance — visible "Verified by N official sources"
                  pill that opens a popover with every scraped source URL.
                  Aggregates visa research + local requirements + guides. */}
              {dashboardTrustSources.length > 0 && (
                <div className="mt-4">
                  <TrustBadge sources={dashboardTrustSources} variant="subtitle" onDark />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                onClick={() => setShowGuidedTour(true)}
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                data-testid="restart-tour-button"
                aria-label="Restart dashboard tour"
              >
                <Compass className="w-4 h-4" />
                Tour
              </Button>
              {isLocked && (
                <Badge variant="secondary" className="gap-1.5 bg-white/10 text-white/90 border-white/20 backdrop-blur-sm">
                  <Shield className="w-3.5 h-3.5" />
                  Plan locked
                </Badge>
              )}
              {dashboardState.showLockAction && (
                <Button
                  onClick={handleLockPlan}
                  variant="outline"
                  className="gap-2 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
                  disabled={lockLoading}
                >
                  <Lock className="w-4 h-4" />
                  {lockLoading ? "Locking..." : "Lock plan"}
                </Button>
              )}
              {dashboardState.showUnlockAction && (
                <Button
                  onClick={handleUnlockPlan}
                  variant="outline"
                  className="gap-2 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
                  disabled={lockLoading}
                >
                  <Unlock className="w-4 h-4" />
                  {lockLoading ? "Unlocking..." : "Unlock to edit"}
                </Button>
              )}
              <Button
                asChild
                className="gap-2 rounded-xl border-0 text-white font-semibold shadow-[0_4px_16px_rgba(232,93,60,0.35)] hover:shadow-[0_6px_20px_rgba(232,93,60,0.45)] transition-shadow"
                style={{
                  background:
                    "linear-gradient(180deg, #F26D4C 0%, #E85D3C 100%)",
                }}
              >
                <Link href="/onboarding">
                  <MessageSquare className="w-4 h-4" />
                  {dashboardState.chatActionLabel}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Switcher - shows plan name with rename option, dropdown for Pro */}
      <div className="mb-6">
        <PlanSwitcher 
          showRename 
          onPlanChange={() => {
            // Reload all dashboard data when plan changes
            window.location.reload()
          }}
        />
      </div>

      {/* Dashboard tab strip — splits the long scroll into focused panels */}
      <DashboardTabs active={activeTab} onChange={setActiveTab} />

      {/* Compliance Alerts (post-arrival) — always visible across tabs */}
      <ComplianceAlerts planStage={plan?.stage} className="gm-animate-in gm-delay-1" />

      {/* Plan Consistency Alerts */}
      {plan && hasDestination && (
        <TierGate tier={tier} feature="guides" onUpgrade={goToUpgrade}>
          <div className="mb-6 gm-animate-in gm-delay-1">
            <PlanConsistencyAlerts planId={plan.id} />
          </div>
        </TierGate>
      )}

      {/* Phase 5.4 — manual generation triggers (Spine steps 6 + 9). */}
      <ManualTriggerCard plan={plan} />

      {/* Research Status Banner */}
      {researchStatus === "in_progress" && (
        <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Researching your relocation requirements...</p>
            <p className="text-xs text-muted-foreground">We're gathering visa options and local requirements for {targetCountry}. This may take a minute.</p>
          </div>
        </div>
      )}
      
      {researchStatus === "completed" && plan?.research_completed_at && (() => {
        const daysSince = Math.floor((Date.now() - new Date(plan.research_completed_at).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince < 7) return null
        return (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-500/30 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/30">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Research may be outdated</p>
              <p className="text-xs text-muted-foreground">Last researched {daysSince} days ago. Consider re-running research for the latest information.</p>
            </div>
          </div>
        )
      })()}

      {researchStatus === "partial" && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-500/30 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/30">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Research completed with limited results</p>
            <p className="text-xs text-muted-foreground">Some research areas returned limited data. You can manually re-run research from the sections below for better results.</p>
          </div>
        </div>
      )}

      {researchStatus === "failed" && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10">
            <AlertCircle className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Research couldn't be completed</p>
            <p className="text-xs text-muted-foreground">You can manually trigger research from the visa and requirements sections below.</p>
          </div>
        </div>
      )}

      <DashboardPanel id="overview" active={activeTab}>
      {/* Countdown Timer - Prominent at top */}
      {hasDestination && (
        <div className="mb-8 gm-animate-in gm-delay-1">
          {hasCitizenship && (
            <div className="flex items-center gap-4 mb-4">
              <VisaStatusBadge 
                citizenship={citizenship} 
                destination={targetCountry} 
              />
            </div>
          )}
          <CountdownTimer targetDate={targetDate} targetCountry={targetCountry} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 gm-animate-in gm-delay-2">
        <StatCard
          title="Destination"
          variant="primary"
          value={
            hasDestination ? (
              <span className="flex items-center gap-2">
                <CountryFlag country={targetCountry} size="sm" />
                {targetCountry}
              </span>
            ) : "Not set"
          }
          subtitle={profile.current_location ? `From ${profile.current_location}` : "Set in chat"}
          icon={<MapPin className="w-5 h-5" />}
        />
        <StatCard
          title="Purpose"
          variant="blue"
          value={formatEnumLabel(profile.purpose)}
          subtitle={profile.visa_role ? `Visa role: ${formatEnumLabel(profile.visa_role)}` : "Set in chat"}
          icon={<Calendar className="w-5 h-5" />}
        />
        <StatCard
          title="Profile"
          variant="emerald"
          value={dashboardState.profileProgressLabel}
          subtitle={dashboardState.profileProgressSubtitle}
          trend={progressPercent > 50 ? "up" : undefined}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Timeline"
          variant="amber"
          value={profile.timeline || (hasTimeline ? formatTimeUntilMove(monthsUntilMove) : "Not set")}
          subtitle={hasTimeline && profile.timeline ? `≈ ${formatTimeUntilMove(monthsUntilMove)} from today` : "Set in chat"}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Suggested Guide — editorial magazine card, full width on overview */}
      {hasDestination && (
        <div className="mb-8 gm-animate-in gm-delay-3">
          <div className="gm-editorial-card overflow-hidden">
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #1B3A2D 0%, #2D6A4F 50%, #5EE89C 100%)" }} />
            <div className="p-6 md:p-7">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span className="gm-eyebrow">Suggested Guide</span>
                  <h3
                    className="mt-2 font-serif text-foreground"
                    style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.012em", lineHeight: 1.15 }}
                  >
                    Your {targetCountry} relocation guide
                  </h3>
                  <p className="mt-2 text-sm text-foreground/60 max-w-md">
                    Hand-curated reading for someone planning a {humaniseSnake(profile.purpose) || "relocation"} to {targetCountry}.
                  </p>
                </div>
                <a
                  href={`https://www.gomaterelocate.com/country-guides/${targetCountry.toLowerCase().replace(/\s+/g, "-")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative shrink-0"
                >
                  <div className="absolute inset-0 -m-2 rounded-2xl bg-gradient-to-br from-[#5EE89C]/0 to-[#5EE89C]/0 group-hover:from-[#5EE89C]/15 group-hover:to-[#234D3A]/10 transition-colors duration-300" />
                  <div className="relative transition-transform duration-300 group-hover:scale-[1.04]">
                    <CountryFlag country={targetCountry} size="lg" />
                  </div>
                </a>
              </div>
              <div className="mt-5 pt-5 border-t border-foreground/[0.08] flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] uppercase tracking-[0.08em]">
                    {humaniseSnake(profile.purpose) || "Relocation"}
                  </Badge>
                  {userGuide && (
                    <Badge className="text-[11px] uppercase tracking-[0.08em] bg-[#16A34A]/12 text-[#16A34A] border border-[#16A34A]/25">
                      Personal guide ready
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {isLocked && userGuide && (
                    <Button asChild size="sm" variant="ghost" className="gap-1.5">
                      <Link href={`/guides/${userGuide.id}`}>
                        Open your guide
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  )}
                  <a
                    href={`https://www.gomaterelocate.com/country-guides/${targetCountry.toLowerCase().replace(/\s+/g, "-")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B3A2D] hover:text-[#2D6A4F] transition-colors"
                  >
                    Read country guide
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Profile-aware Specialist Insights (kept in Overview)          */}
      {/* ============================================================ */}
      {specialistCards.length > 0 && (
        <div className="mb-8 gm-animate-in gm-delay-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Tailored to your move</h2>
            <Badge variant="outline" className="text-xs">
              {specialistCards.length} insight{specialistCards.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {specialistCards.map((card) => {
              const Component = PLACEHOLDER_CARD_REGISTRY[card.id]
              if (!Component) return null
              const specialistName = CARD_TO_SPECIALIST[card.id]
              const specialistOutput = specialistName ? plan?.research_meta?.specialists?.[specialistName] : undefined
              // Pass both `reason` (always) and `data`/`specialistOutput`
              // (when persisted). The two prop shapes coexist: domain
              // cards (DepartureTaxCard, IncomeComplianceCard, etc.)
              // expect `data`; placeholder wrappers (CulturalCard,
              // BankingWizardCard) expect `specialistOutput`. The
              // component receives both — TS isn't strict here because
              // PLACEHOLDER_CARD_REGISTRY's element-fn signature is
              // intentionally loose.
              const slim = specialistOutput
                ? {
                    paragraphs: specialistOutput.contentParagraphs ?? [],
                    sources: (specialistOutput.citations ?? []).map((c) => ({ url: c.url, label: c.label ?? c.url })),
                    quality: specialistOutput.quality ?? "fallback",
                  }
                : undefined
              const props = {
                reason: card.reason,
                data: specialistOutput,
                specialistOutput: slim,
                destination: targetCountry,
              } as Record<string, unknown>
              return <Component key={card.id} {...(props as { reason: string })} />
            })}
          </div>
        </div>
      )}
      </DashboardPanel>

      {/* ============================ PROFILE TAB ============================ */}
      <DashboardPanel id="profile" active={activeTab}>
        <div className="mb-8 gm-animate-in gm-delay-1">
          <ProfileDetailsCard
            profile={profile}
            onFieldClick={!isLocked ? (fieldKey, fieldLabel) => {
              router.push(`/chat?field=${encodeURIComponent(fieldKey)}&label=${encodeURIComponent(fieldLabel)}`)
            } : undefined}
          />
          <div className="mt-4">
            {isLocked ? (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-primary shrink-0" />
                  <span>Profile is locked. Unlock to make changes, or chat to ask questions.</span>
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0 gap-2 bg-transparent">
                  <Link href="/chat">
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </Link>
                </Button>
              </div>
            ) : (
              <Button variant="outline" asChild className="w-full gap-2 bg-transparent">
                <Link href="/chat">
                  <MessageSquare className="w-4 h-4" />
                  Update profile in chat
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </DashboardPanel>

      {/* ============================ VISA TAB ============================ */}
      <DashboardPanel id="visa" active={activeTab}>
      {hasDestination && hasCitizenship && (
        <TierGate tier={tier} feature="visa_recommendation" onUpgrade={goToUpgrade}>
          {(() => {
            const selectedName = plan?.visa_application?.selectedVisaType ?? null
            const appStatus = plan?.visa_application?.applicationStatus ?? null
            const visaExpiry = plan?.visa_application?.visaExpiryDate ?? null
            const options = visaResearch?.visaOptions ?? []
            const selected = selectedName
              ? options.find((v) => v.name === selectedName)
              : null
            const topOptions = [...options].sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2, unknown: 3 } as const
              return (order[a.eligibility] ?? 3) - (order[b.eligibility] ?? 3)
            }).slice(0, 3)

            const requiredDocs = Object.entries(documentStatuses ?? {})
              .map(([id, raw]) => ({ id, ...normalizeDocumentStatus(raw) }))
            const readyDocs = requiredDocs.filter((d) => d.status === "ready" || d.status === "submitted")
            const upcomingDocs = requiredDocs.filter((d) => d.status !== "ready" && d.status !== "submitted").slice(0, 5)

            const statusLabelMap: Record<string, string> = {
              not_started: "Not started",
              preparing: "Preparing application",
              submitted: "Submitted",
              decision_pending: "Awaiting decision",
              approved: "Approved",
              rejected: "Rejected",
            }

            const expiryDays = visaExpiry
              ? Math.ceil((new Date(visaExpiry).getTime() - Date.now()) / 86_400_000)
              : null

            return (
              <div className="space-y-6">
                {/* Editorial hero — matches the Settling-tab + Tailored
                    insights surface so all tabs feel like one product. */}
                <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card">
                  <div
                    className="h-[3px]"
                    style={{
                      background:
                        "linear-gradient(90deg, #1B3A2D 0%, #2D6A4F 60%, #5EE89C 100%)",
                    }}
                  />
                  <div className="p-6 md:p-7 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div className="min-w-0">
                      <span className="gm-eyebrow">Visa &amp; Legal</span>
                      <h2
                        className="mt-2 font-serif text-foreground"
                        style={{
                          fontSize: "26px",
                          fontWeight: 600,
                          letterSpacing: "-0.012em",
                          lineHeight: 1.15,
                        }}
                      >
                        {selected
                          ? <>Your pathway: <span className="text-foreground/90">{selected.name}</span></>
                          : <>Pick your pathway to {targetCountry}</>}
                      </h2>
                      <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
                        {selected
                          ? `Status: ${statusLabelMap[appStatus ?? "not_started"] ?? "Not started"} · ${selected.processingTime} processing · ${selected.cost}`
                          : options.length > 0
                            ? `${options.length} routes shortlisted by our specialists for your profile. Pick one to lock in deadlines, documents and progress tracking.`
                            : "Run research from the dashboard's main button to surface your visa options."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button asChild size="sm" className="gap-1.5 rounded-full">
                        <Link href="/visa">
                          {selected ? "Open workspace" : "Compare options"}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Selected pathway card — deeper card style with eligibility
                    badge, processing, cost, validity, expiry warning. */}
                {selected && (
                  <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10">
                    <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500" />
                    <div className="p-5 md:p-6 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-emerald-700 dark:text-emerald-400">
                              Selected pathway
                            </span>
                            {appStatus && (
                              <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                                {statusLabelMap[appStatus] ?? appStatus}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-serif text-lg md:text-xl mt-1 text-foreground">
                            {selected.name}
                          </h3>
                        </div>
                        {expiryDays !== null && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] py-0",
                              expiryDays < 0
                                ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
                                : expiryDays <= 90
                                  ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                                  : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                            )}
                          >
                            {expiryDays < 0
                              ? "Visa expired"
                              : expiryDays <= 90
                                ? `${expiryDays}d to expiry`
                                : `${expiryDays}d valid`}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-emerald-200 dark:border-emerald-900/40">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Processing</p>
                          <p className="text-sm font-medium text-foreground">{selected.processingTime}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cost</p>
                          <p className="text-sm font-medium text-foreground">{selected.cost}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Validity</p>
                          <p className="text-sm font-medium text-foreground">{selected.validity}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visa options grid — only when nothing selected yet. */}
                {!selected && topOptions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-600 dark:text-stone-400">
                        Top routes for you
                      </h3>
                      <Link
                        href="/visa"
                        className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        See all {options.length}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {topOptions.map((opt) => {
                        const stripeColor =
                          opt.eligibility === "high" ? "from-emerald-400 via-teal-400 to-emerald-500" :
                          opt.eligibility === "medium" ? "from-amber-400 via-orange-400 to-amber-500" :
                          opt.eligibility === "low" ? "from-rose-400 via-red-400 to-rose-500" :
                          "from-stone-300 via-stone-400 to-stone-300"
                        const eligLabel =
                          opt.eligibility === "high" ? "Likely eligible" :
                          opt.eligibility === "medium" ? "Possibly eligible" :
                          opt.eligibility === "low" ? "Unlikely" : "Unclear"
                        const eligTint =
                          opt.eligibility === "high" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                          opt.eligibility === "medium" ? "bg-amber-100 text-amber-800 border-amber-200" :
                          opt.eligibility === "low" ? "bg-rose-100 text-rose-800 border-rose-200" :
                          "bg-stone-100 text-stone-700 border-stone-200"
                        return (
                          <Link
                            key={opt.name}
                            href="/visa"
                            className="group relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card p-5 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md transition-all duration-300 flex flex-col gap-2.5"
                          >
                            <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${stripeColor}`} />
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-serif text-base leading-tight tracking-tight text-foreground">
                                {opt.name}
                              </h4>
                              <span className={`shrink-0 text-[10px] uppercase tracking-[0.12em] font-semibold border rounded-full px-2 py-0.5 ${eligTint}`}>
                                {eligLabel}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {opt.eligibilityReason}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-dashed border-stone-200 dark:border-stone-800">
                              <span><span className="font-semibold text-foreground">{opt.processingTime}</span></span>
                              <span>·</span>
                              <span>{opt.cost}</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Document preview + checklist progress in one row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Document preview */}
                  <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card">
                    <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
                    <div className="p-5 md:p-6 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="gm-eyebrow text-amber-700 dark:text-amber-400">Documents</p>
                          <h3 className="font-serif text-lg leading-tight tracking-tight text-foreground mt-1">
                            What you still need to gather
                          </h3>
                        </div>
                        <span className="text-2xl font-serif font-bold tabular-nums text-foreground leading-none">
                          {readyDocs.length}/{requiredDocs.length}
                        </span>
                      </div>

                      {upcomingDocs.length > 0 ? (
                        <ul className="space-y-1.5">
                          {upcomingDocs.map((d) => (
                            <li key={d.id} className="flex items-start gap-2 text-xs">
                              <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-stone-400" />
                              <span className="text-foreground capitalize">
                                {d.id.replace(/-/g, " ").replace(/_/g, " ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : requiredDocs.length > 0 ? (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> All documents ready.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Documents appear here once visa research is complete.
                        </p>
                      )}

                      <Link
                        href="/checklist?tab=documents"
                        className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline pt-1"
                      >
                        Open documents
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Pre-move + Documents + Settling progress (existing tile) */}
                  <ChecklistStatusTile
                    postArrivalCompleted={settlingSummary?.stats?.completed ?? progressData?.post_arrival_progress?.completed ?? 0}
                    postArrivalTotal={settlingSummary?.stats?.total ?? progressData?.post_arrival_progress?.total ?? 0}
                    postArrivalOverdue={settlingSummary?.stats?.overdue ?? 0}
                    documentsReady={readyDocs.length}
                    documentsTotal={requiredDocs.length}
                    preMoveCompleted={preMoveSummary.completed}
                    preMoveTotal={preMoveSummary.total}
                    preMoveCriticalRemaining={preMoveSummary.criticalRemaining}
                  />
                </div>
              </div>
            )
          })()}
        </TierGate>
      )}
      </DashboardPanel>

      {/* ============================ MONEY TAB ============================ */}
      <DashboardPanel id="money" active={activeTab}>
      {/* Budget & Cost of Living Section */}
      {hasDestination && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TierGate tier={tier} feature="budget_planner" onUpgrade={goToUpgrade}>
            <BudgetPlanCard
              budget={budgetData}
              targetCity={profile.target_city || profile.destination || "Berlin"}
              targetCountry={targetCountry}
              homeCurrency={resolveUserCurrency(profile)}
              currentSavings={parseFloat(profile.savings_available || "0") || 0}
              onUpdateSavings={async (amount) => {
                if (!plan) return
                const previousPlan = plan
                // Update local state
                const updatedProfile = { ...profile, savings_available: amount.toString() }
                setPlan({ ...plan, profile_data: updatedProfile })
                
                // Persist to backend
                try {
                  const response = await fetch("/api/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      profileData: { savings_available: amount.toString() },
                      expectedVersion: plan.plan_version,
                    }),
                  })

                  if (response.ok) {
                    const data = await response.json()
                    setPlan(data.plan)
                    if (data.changeSummary) {
                      setChangeSummary(data.changeSummary)
                      setChangeSummaryOpen(true)
                    }
                  } else {
                    setPlan(previousPlan)
                  }
                } catch (error) {
                  setPlan(previousPlan)
                  console.error("[GoMate] Error saving savings:", error)
                }
              }}
            />
          </TierGate>
          
          {/* Cost of Living from Numbeo */}
          <TierGate tier={tier} feature="cost_of_living" onUpgrade={goToUpgrade}>
            <CostOfLivingCard
              country={targetCountry || profile.destination || ""}
              city={profile.target_city || undefined}
              compareFromCity={profile.current_location || undefined}
              compareFromCountry={profile.citizenship || undefined}
              citizenship={profile.citizenship || undefined}
              // TODO[v2]: derive from profile when family/dependents flow exists
              householdSize="single"
            />
          </TierGate>
        </div>
      )}

      {/* Affordability & Tax Overview */}
      {hasDestination && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TierGate tier={tier} feature="budget_planner" onUpgrade={goToUpgrade}>
            <AffordabilityCard
              monthlyBudget={parseFloat(profile.monthly_budget || "") || null}
              monthlyIncome={parseFloat(profile.monthly_income || "") || null}
              savingsAvailable={parseFloat(profile.savings_available || "") || null}
              destination={profile.destination || ""}
              city={profile.target_city || undefined}
              // TODO[v2]: derive from profile when family/dependents flow exists
              householdSize="single"
              userCurrency={resolveUserCurrency(profile)}
            />
          </TierGate>
          <TierGate tier={tier} feature="budget_planner" onUpgrade={goToUpgrade}>
            <TaxOverviewCard
              destination={profile.destination || ""}
              annualIncome={
                (parseFloat(profile.monthly_income || "") || parseFloat(profile.monthly_budget || "") || 0) * 12 || null
              }
              planId={plan?.id}
            />
          </TierGate>
        </div>
      )}
      </DashboardPanel>

      {/* ============================ SETTLING TAB ============================ */}
      <DashboardPanel id="settling" active={activeTab}>
      {/* Local Requirements Section */}
      {hasDestination && (
        <TierGate tier={tier} feature="local_requirements" onUpgrade={goToUpgrade}>
          <div className="mb-8 gm-animate-in gm-delay-1">
            <LocalRequirementsCard
              planId={plan?.id}
              destination={targetCountry}
              city={profile.target_city || undefined}
              cachedResearch={localRequirements}
              researchStatus={researchStatus}
              onResearchComplete={(data) => {
                setLocalRequirements(data)
              }}
            />
          </div>
        </TierGate>
      )}

      {/* Commonly Forgotten Items */}
      {plan && hasDestination && (
        <div className="mb-6">
          <CommonlyForgottenSection
            planId={plan.id}
            destination={profile.destination || undefined}
            stage={plan.stage}
          />
        </div>
      )}

      {/* Post-Relocation: Arrival Transition or Settling-In link */}
      {plan && hasDestination && (
        <TierGate tier={tier} feature="post_relocation" onUpgrade={goToUpgrade}>
          {dashboardState.showArrivalBanner && (
            <ArrivalBanner
              stage={plan.stage}
              tier={tier}
              destination={profile.destination || "your destination"}
              onArrived={() => {
                // Refresh dashboard data
                window.location.reload()
              }}
            />
          )}
          {dashboardState.showArrivedSummary && (
            <ChecklistStatusTile
              postArrivalCompleted={settlingSummary?.stats?.completed ?? progressData?.post_arrival_progress?.completed ?? 0}
              postArrivalTotal={settlingSummary?.stats?.total ?? progressData?.post_arrival_progress?.total ?? 0}
              postArrivalOverdue={settlingSummary?.stats?.overdue ?? 0}
              documentsReady={Object.values(documentStatuses ?? {}).map(normalizeDocumentStatus).filter((s) => s.status === "ready" || s.status === "submitted").length}
              documentsTotal={Object.keys(documentStatuses ?? {}).length}
              preMoveCompleted={preMoveSummary.completed}
              preMoveTotal={preMoveSummary.total}
              preMoveCriticalRemaining={preMoveSummary.criticalRemaining}
            />
          )}
        </TierGate>
      )}
      </DashboardPanel>

      {/* Plan Change Summary Dialog */}
      <PlanChangeSummary
        summary={changeSummary}
        open={changeSummaryOpen}
        onClose={() => setChangeSummaryOpen(false)}
        onRegenerateGuide={() => {
          setChangeSummaryOpen(false)
          if (userGuide) {
            router.push(`/guides/${userGuide.id}`)
          }
        }}
      />
    </div>
    <ResearchProgressModal
      profileId={plan?.id ?? null}
      open={showResearchModal}
      dataReady={researchDataReady}
      onComplete={handleResearchModalComplete}
    />
    <DashboardGuidedTour
      open={showGuidedTour}
      onTabChange={setActiveTab}
      onClose={() => {
        setShowGuidedTour(false)
        if (typeof window !== "undefined") {
          window.localStorage.setItem("gomate.guidedTourCompleted.v1", "true")
        }
      }}
    />
    </DashboardAuditProvider>
  )
}

/**
 * Phase 5.4 — Manual generation trigger card.
 *
 * Surfaces three buttons in sequence as the user advances through the
 * lifecycle:
 *
 *   stage = "complete" + no research run yet
 *     → "Generate my plan" (POST /api/plans/trigger-research)
 *
 *   stage = "ready_for_pre_departure" + no pre-departure run yet
 *     → "Generate my pre-departure checklist" (POST /api/pre-departure/generate)
 *
 *   stage = "pre_departure" with a known move date
 *     → "I have arrived" (POST /api/settling-in/arrive)
 *
 * The card stays a no-op when none of the gates apply, so the rest of
 * the dashboard layout shifts cleanly. All three buttons live here so
 * the Spine has one canonical entry point.
 */
function ManualTriggerCard({ plan }: { plan: { id?: string; stage?: string; user_triggered_research_at?: string | null; user_triggered_pre_departure_at?: string | null } | null }) {
  const [, setLocation] = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!plan) return null
  const stage = plan.stage ?? ""

  const showGenerateResearch =
    stage === "complete" && !plan.user_triggered_research_at
  const showGeneratePreDeparture =
    stage === "ready_for_pre_departure" && !plan.user_triggered_pre_departure_at
  const showArrived = stage === "pre_departure"

  if (!showGenerateResearch && !showGeneratePreDeparture && !showArrived) return null

  async function fire(method: "research" | "preDeparture" | "arrived") {
    setBusy(true)
    setError(null)
    try {
      let url = ""
      let opts: RequestInit = { method: "POST" }
      if (method === "research") url = "/api/plans/trigger-research"
      else if (method === "preDeparture") url = "/api/pre-departure/generate"
      else {
        url = "/api/settling-in/arrive"
        opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ arrivalDate: new Date().toISOString().split("T")[0] }) }
      }
      const res = await fetch(url, opts)
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
        throw new Error(msg)
      }
      // research: stay on dashboard and let the ResearchProgressModal
      // pick up ?research=triggered + the new research_status=in_progress
      // (full reload because backend just flipped DB state and we want
      // the dashboard to re-fetch from a clean slate).
      if (method === "research") {
        window.location.href = "/dashboard?research=triggered"
      } else if (method === "preDeparture") {
        setLocation("/checklist?tab=pre-move")
      } else {
        window.location.reload()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  if (showGenerateResearch) {
    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border border-emerald-200/70 dark:border-emerald-900/40 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-700 dark:text-emerald-400">Step 1 of 3</p>
            <h2 className="text-lg sm:text-xl font-serif font-semibold mt-1">Generate my plan</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Spin up your specialist team — visa, tax, housing, banking, healthcare, culture, documents — and produce your full relocation guide. Takes about 90 seconds.
            </p>
            {error && <p className="text-sm text-rose-700 dark:text-rose-400 mt-2">⚠ {error}</p>}
          </div>
          <Button
            onClick={() => fire("research")}
            disabled={busy}
            data-testid="trigger-generate-research"
            className="gap-2 rounded-xl text-white font-semibold shadow-lg"
            style={{ background: "linear-gradient(180deg, #F26D4C 0%, #E85D3C 100%)" }}
            size="lg"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? "Starting…" : "Generate my plan"}
          </Button>
        </div>
      </div>
    )
  }

  if (showGeneratePreDeparture) {
    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border border-emerald-200/70 dark:border-emerald-900/40 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-700 dark:text-emerald-400">Step 2 of 3</p>
            <h2 className="text-lg sm:text-xl font-serif font-semibold mt-1">Generate my pre-departure checklist</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Sequence every pre-move action — apostilles, A1, banking bridge, pet vaccination, lease termination — into a week-by-week plan with critical path highlighted. ~30 seconds.
            </p>
            {error && <p className="text-sm text-rose-700 dark:text-rose-400 mt-2">⚠ {error}</p>}
          </div>
          <Button
            onClick={() => fire("preDeparture")}
            disabled={busy}
            data-testid="trigger-generate-predeparture"
            className="gap-2 rounded-xl text-white font-semibold shadow-lg"
            style={{ background: "linear-gradient(180deg, #F26D4C 0%, #E85D3C 100%)" }}
            size="lg"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? "Generating…" : "Generate my pre-departure checklist"}
          </Button>
        </div>
      </div>
    )
  }

  // showArrived
  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border border-emerald-200/70 dark:border-emerald-900/40 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-700 dark:text-emerald-400">Step 3 of 3</p>
          <h2 className="text-lg sm:text-xl font-serif font-semibold mt-1">I have arrived</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Confirm your arrival to switch GoMate into post-arrival mode and unlock your settling-in task graph (population registration, bank, healthcare, schools).
          </p>
          {error && <p className="text-sm text-rose-700 dark:text-rose-400 mt-2">⚠ {error}</p>}
        </div>
        <Button
          onClick={() => fire("arrived")}
          disabled={busy}
          data-testid="trigger-mark-arrived"
          className="gap-2 rounded-xl text-white font-semibold shadow-lg"
          style={{ background: "linear-gradient(180deg, #F26D4C 0%, #E85D3C 100%)" }}
          size="lg"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? "Confirming…" : "I have arrived"}
        </Button>
      </div>
    </div>
  )
}

function extractDomainHelper(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

function humaniseSnake(raw: string | null | undefined): string {
  if (!raw) return ""
  const lower = String(raw).toLowerCase().trim()
  if (!/^[a-z][a-z0-9_]*$/.test(lower)) return raw as string
  return lower.split("_").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// Map dashboard card IDs to the specialist that produces their content.
const CARD_TO_SPECIALIST: Record<string, string> = {
  "departure-tax-card": "departure_tax_specialist",
  "income-compliance-card": "digital_nomad_compliance",
  "chronic-health-card": "healthcare_navigator",
  "pet-relocation-card": "pet_specialist",
  "cultural-card": "cultural_adapter",
  "banking-wizard-card": "banking_helper",
  "posted-worker-card": "posted_worker_specialist",
  "schools-card": "schools_specialist",
  "family-reunion-card": "family_reunion_specialist",
  "vehicle-import-card": "vehicle_import_specialist",
  "property-purchase-card": "property_purchase_specialist",
  "trailing-spouse-card": "trailing_spouse_career_specialist",
}
