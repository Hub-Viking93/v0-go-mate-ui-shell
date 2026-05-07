

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
// DashboardTabs/DashboardPanel retired during the IA refresh —
// dashboard is now overview-only. Profile/Visa/Money/Settling tab data
// lives at /settings, /immigration and /post-move respectively.
import { computeInterviewProgress } from "@/lib/gomate/progress"
import { DashboardAuditProvider } from "@/lib/audit-context"
import { CostOfLivingCard } from "@/components/cost-of-living-card"
import type { NumbeoData } from "@/lib/gomate/numbeo-scraper"
import { AffordabilityCard } from "@/components/affordability-card"
import { TaxOverviewCard } from "@/components/tax-overview-card"
import { getCurrencyFromCountry, resolveUserCurrency } from "@/lib/gomate/currency"
import { PlanConsistencyAlerts } from "@/components/plan-consistency-alerts"
import { CommonlyForgottenSection } from "@/components/commonly-forgotten-section"
import { PlanChangeSummary, type PlanChangeSummaryData } from "@/components/plan-change-summary"
import { PlanSwitcher } from "@/components/plan-switcher"
import { TierGate } from "@/components/tier-gate"
import { ArrivalBanner } from "@/components/arrival-banner"
import { VisaStatusTile, ChecklistStatusTile, VaultStatusTile } from "@/components/dashboard-status-tiles"
// Phase IA — section components are no longer rendered on the
// dashboard. They've been moved to their dedicated workspaces:
//   • Readiness / Risks / Pathways → /immigration
//   • Playbook / Setup / Licence / Orientation → /post-move
//   • Housing / Departure / Pets / Tax / Rule changes → /guidance
// Imports kept commented for traceability so a refactor of the
// Phase 3-6 components can find their original homes.
import { NotificationBell } from "@/components/notification-bell"
import { WorkspaceTiles } from "@/components/dashboard/workspace-tiles"
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

/**
 * Map the bucketed `profile.duration` value to an average stay in months.
 * Used to size the savings runway when no per-day stay length is known.
 */
function mapDurationToMonths(duration: string | null | undefined): number {
  switch (duration) {
    case "3-6_months": return 4.5
    case "6-12_months": return 9
    case "1-2_years": return 18
    case "permanent": return 36
    case "not_sure": return 12
    default: return 12
  }
}

/**
 * Generate budget plan from profile + (optional) cost-of-living data.
 *
 * When `cost` is passed: totalSavingsTarget = monthlyMinimum × stayMonths
 * + one-time move costs, all denominated in the cost data's currency
 * (which the /api/cost-of-living endpoint already converted to the
 * user's preferred_currency). When cost is missing (research not run
 * yet, or fetch failed) we fall back to the destination-multiplier
 * heuristic in USD — the same v0 placeholder we had before.
 *
 * monthlySavingsTarget = (totalTarget − currentSavings) / monthsUntilMove,
 * floored at 0 so it never goes negative when the user is already
 * over-saved.
 */
function generateBudgetFromProfile(
  profile: Profile,
  monthsUntilMove: number = 6,
  cost?: NumbeoData | null,
  currentSavings: number = 0,
): BudgetPlanData {
  const destination = profile.destination || "Germany"
  const purpose = profile.purpose || "work"
  const stayMonths = mapDurationToMonths(profile.duration)

  // Real path: cost specialist data available (already FX-converted).
  if (cost?.estimatedMonthlyBudget?.single?.minimum) {
    const monthlyMin = cost.estimatedMonthlyBudget.single.minimum
    const livingCosts = Math.round(monthlyMin * stayMonths)
    const visaFee = purpose === "work" ? 250 : purpose === "study" ? 200 : 350
    const flightCost = 800
    const securityDeposit = monthlyMin * 2
    const firstMonthRent = monthlyMin
    const emergencyBuffer = monthlyMin * 3
    const oneTimeCosts =
      visaFee + flightCost + securityDeposit + firstMonthRent + emergencyBuffer
    const totalTarget = Math.round(livingCosts + oneTimeCosts)
    const remainingNeeded = Math.max(0, totalTarget - currentSavings)
    const monthlyTarget =
      monthsUntilMove > 0
        ? Math.round(remainingNeeded / monthsUntilMove)
        : remainingNeeded

    return {
      currency: cost.currency || "USD",
      totalSavingsTarget: totalTarget,
      monthlySavingsTarget: monthlyTarget,
      monthsUntilMove,
      breakdown: [
        { category: "Living Expenses", oneTime: livingCosts, notes: `${stayMonths.toFixed(1)} months at ${cost.city || destination} cost-of-living minimum` },
        { category: "Visa & Immigration Fees", oneTime: visaFee, notes: `${purpose === "work" ? "Work permit" : purpose === "study" ? "Student visa" : "Residence permit"} application` },
        { category: "Flight & Initial Travel", oneTime: flightCost, notes: "One-way + luggage" },
        { category: "Security Deposit", oneTime: Math.round(securityDeposit), notes: "~2 months rent upfront" },
        { category: "First Month Rent", oneTime: Math.round(firstMonthRent), notes: `${destination} average` },
        { category: "Emergency Fund", oneTime: Math.round(emergencyBuffer), notes: "3 months buffer" },
      ],
      recommendations: [
        `Start learning the local language — even basic level helps with daily life`,
        "Open an international bank account before arrival for easier banking",
        "Register at local authorities within first 2 weeks of arrival",
      ],
    }
  }

  // Fallback path: USD baseline + destination cost multiplier. Used when
  // cost data hasn't loaded yet (research not run, or API failure).
  const costMultiplier = destination.toLowerCase().includes("switzerland") ? 1.5
    : destination.toLowerCase().includes("portugal") ? 0.7
    : destination.toLowerCase().includes("japan") ? 1.2
    : destination.toLowerCase().includes("singapore") ? 1.4
    : destination.toLowerCase().includes("london") || destination.toLowerCase().includes("uk") ? 1.3
    : destination.toLowerCase().includes("dubai") || destination.toLowerCase().includes("uae") ? 1.1
    : 1

  const baseSavings = 15000 * costMultiplier
  const totalTarget = Math.round(baseSavings)
  const remainingNeeded = Math.max(0, totalTarget - currentSavings)
  const monthlyTarget =
    monthsUntilMove > 0
      ? Math.round(remainingNeeded / monthsUntilMove)
      : remainingNeeded

  return {
    currency: "USD",
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
  // userGuide retired — guides feature removed in IA refresh.
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, DocumentStatus>>({})
  const [loading, setLoading] = useState(true)
  const [lockLoading, setLockLoading] = useState(false)
  const [selectedVisaRoute, setSelectedVisaRoute] = useState<number | undefined>(0)
  const [visaResearch, setVisaResearch] = useState<VisaResearchData | null>(null)
  const [localRequirements, setLocalRequirements] = useState<LocalRequirementsData | null>(null)
  const [researchStatus, setResearchStatus] = useState<string | null>(null)
  const [showResearchModal, setShowResearchModal] = useState(false)
  const [showGuidedTour, setShowGuidedTour] = useState(false)
  // Cost-of-living data — drives Budget Plan card's runway calculation.
  // Fetched once when destination is known; the API converts amounts into
  // the user's preferred currency before responding.
  const [costData, setCostData] = useState<NumbeoData | null>(null)
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
  const [vaultCount, setVaultCount] = useState<number>(0)
  // Tabs retired in IA refresh; the guided tour still calls onTabChange
  // for backward compat — we feed it a no-op so it doesn't break.

  // Migrate legacy `?tab=...` deep links to the new IA pages.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (!tab) return;
    const map: Record<string, string> = {
      profile: "/settings",
      visa: "/immigration",
      "visa-legal": "/immigration",
      money: "/settings",
      settling: "/post-move",
    };
    const target = map[tab];
    if (target) {
      window.history.replaceState(null, "", target);
      window.location.replace(target);
    }
  }, []);

  const [changeSummaryOpen, setChangeSummaryOpen] = useState(false)

  // Fetch the user's plan, guide, and document statuses on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [planRes, docsRes, progressRes, vaultRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/documents"),
          fetch("/api/progress"),
          fetch("/api/vault"),
        ])

        if (vaultRes.ok) {
          const data = await vaultRes.json()
          setVaultCount(Array.isArray(data.documents) ? data.documents.length : 0)
        }
        
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
        
        // /api/guides retired — see IA refresh notes.


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

  // Fetch cost-of-living once we know destination + user's currency.
  // Drives the Budget Plan card's runway calculation. The API converts
  // amounts to user's preferred currency before responding.
  useEffect(() => {
    const destination = plan?.profile_data?.destination
    const userCurrency = plan?.profile_data
      ? resolveUserCurrency(plan.profile_data as Profile)
      : null
    if (!destination) return

    let active = true
    const params = new URLSearchParams({ country: destination })
    if (plan?.profile_data?.target_city) {
      params.set("city", String(plan.profile_data.target_city))
    }
    if (userCurrency) params.set("to", userCurrency)

    fetch(`/api/cost-of-living?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return
        // The endpoint returns either a flat NumbeoData or a comparison
        // wrapper { from, to, comparison }. Normalise to NumbeoData.
        const normalised = data?.to ?? data
        if (normalised?.estimatedMonthlyBudget) {
          setCostData(normalised as NumbeoData)
        }
      })
      .catch(() => null)
    return () => {
      active = false
    }
  }, [plan?.profile_data])

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
  
  // Calculate months until move from timeline. Handles three formats:
  //   1. ISO date "2026-09-01" (wizard's primary output)
  //   2. The literal "flexible" sentinel (wizard's "I'm flexible" toggle)
  //   3. Free-form text from the legacy chat flow ("September 2026", "6 months", etc.)
  const calculateMonthsUntilMove = (timeline: string | null): number => {
    if (!timeline) return 6
    if (timeline === "flexible") return 12 // assume ~1 yr for flexible plans

    // Try ISO date first (wizard format).
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(timeline)
    if (iso) {
      const target = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
      const now = new Date()
      const monthsDiff =
        (target.getFullYear() - now.getFullYear()) * 12 +
        (target.getMonth() - now.getMonth())
      return Math.max(1, monthsDiff)
    }

    // Legacy chat-flow free-form parsing.
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const timelineLower = timeline.toLowerCase()
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
    const monthMatch = monthNames.findIndex((m) => timelineLower.includes(m))
    const yearMatch = timeline.match(/20\d{2}/)
    const targetYear = yearMatch ? parseInt(yearMatch[0]) : currentYear

    if (monthMatch >= 0) {
      const targetDate = new Date(targetYear, monthMatch, 1)
      const monthsDiff =
        (targetDate.getFullYear() - currentYear) * 12 +
        (targetDate.getMonth() - currentMonth)
      return Math.max(1, monthsDiff)
    }
    if (timelineLower.includes("asap") || timelineLower.includes("soon")) return 2
    if (timelineLower.includes("1 month") || timelineLower.includes("next month")) return 1
    if (timelineLower.includes("3 month")) return 3
    if (timelineLower.includes("6 month")) return 6
    if (timelineLower.includes("1 year") || timelineLower.includes("next year")) return 12
    if (timelineLower.includes("2 year")) return 24
    if (targetYear > currentYear) return (targetYear - currentYear) * 12
    return 6
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
  
  const currentSavings = parseFloat(profile.savings_available || "0") || 0
  const budgetData = generateBudgetFromProfile(
    profile,
    monthsUntilMove,
    costData,
    currentSavings,
  )
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
      <div className="p-4 md:p-5 lg:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  // Show onboarding prompt if profile is mostly empty.
  // Empty state — compact admin-style welcome. No big illustration,
  // no chat-driven onboarding nudge (the wizard at /onboarding is the
  // only intake path now). Just a one-line invitation + tiles.
  if (dashboardState.showWelcome) {
    return (
      <div className="p-4 md:p-5 lg:p-6 space-y-6 max-w-6xl">
        <div className="gm-surface p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <span className="gm-eyebrow mb-2">Welcome</span>
              <h1 className="text-xl font-semibold tracking-tight text-foreground mt-2">
                Let's set up your move
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
                Five quick steps and we'll have your visa pathway, budget, document checklist and
                timeline ready. Save and resume anytime.
              </p>
            </div>
            <Button
              asChild
              size="sm"
              className="gap-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white h-8 px-3 text-xs"
            >
              <Link href="/onboarding">
                Set up profile
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <span className="gm-eyebrow">Workspaces</span>
          <WorkspaceTiles />
        </div>

        {/* What you get — fills empty space with value props */}
        <div className="gm-surface-sub p-4">
          <p className="text-xs font-medium text-foreground mb-3">What you'll get</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 w-6 h-6 rounded-md bg-[#E4F2EA] flex items-center justify-center mt-0.5">
                <Shield className="w-3 h-3 text-[#2C6440]" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Visa pathway</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Personalised visa options based on your citizenship and destination.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 w-6 h-6 rounded-md bg-[#F6ECD7] flex items-center justify-center mt-0.5">
                <TrendingUp className="w-3 h-3 text-[#8C6B2F]" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Budget plan</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Cost of living breakdown and savings target for your move.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 w-6 h-6 rounded-md bg-[#E1EEF1] flex items-center justify-center mt-0.5">
                <Calendar className="w-3 h-3 text-[#3F6B6F]" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Timeline</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Step-by-step checklist with deadlines tailored to your move date.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DashboardAuditProvider profileId={plan?.id ?? null}>
    <div className="p-5 md:p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 gm-animate-in gm-delay-1 pb-5 border-b border-[#DCE7DF]">
        <div className="min-w-0">
          <span className="gm-eyebrow mb-2">Dashboard</span>
          <h1 className="text-[22px] font-semibold text-[#1F2A24] tracking-tight mt-2">
            {profile.name ? `${profile.name}'s move` : "Your move"}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-[12px] text-[#7E9088]">
            <span>{dashboardState.profileProgressLabel} confirmed</span>
            {targetCountry && (
              <>
                <span>·</span>
                <span>{targetCountry}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          <Button
            onClick={() => setShowGuidedTour(true)}
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 px-2.5 text-xs rounded-md text-[#4E5F57] hover:bg-[#ECF1EC] hover:text-[#1F2A24]"
            data-testid="restart-tour-button"
          >
            <Compass className="w-3.5 h-3.5" />
            Tour
          </Button>
          {isLocked && (
            <Badge variant="secondary" className="gap-1 h-6 text-[11px] bg-[#ECF1EC] text-[#4E5F57]">
              <Shield className="w-3 h-3" />
              Locked
            </Badge>
          )}
          {dashboardState.showLockAction && (
            <Button
              onClick={handleLockPlan}
              variant="outline"
              className="gap-1.5 h-8 px-2.5 text-xs rounded-md border-[#DCE7DF] hover:border-[#B5D2BC] hover:bg-[#F7FAF7]"
              disabled={lockLoading}
            >
              <Lock className="w-3.5 h-3.5" />
              {lockLoading ? "…" : "Lock"}
            </Button>
          )}
          {dashboardState.showUnlockAction && (
            <Button
              onClick={handleUnlockPlan}
              variant="outline"
              className="gap-1.5 h-8 px-2.5 text-xs rounded-md border-[#DCE7DF] hover:border-[#B5D2BC] hover:bg-[#F7FAF7]"
              disabled={lockLoading}
            >
              <Unlock className="w-3.5 h-3.5" />
              {lockLoading ? "…" : "Unlock"}
            </Button>
          )}
          <Button
            asChild
            size="sm"
            className="gap-1.5 h-8 px-3 text-xs rounded-md bg-[#1B7A40] text-white hover:bg-[#15663A] shadow-sm"
          >
            <Link href="/onboarding">
              <MessageSquare className="w-3.5 h-3.5" />
              {dashboardState.chatActionLabel}
            </Link>
          </Button>
        </div>
      </div>

      {/* Compact countdown */}
      {hasDestination && targetDate && (
        <div className="mb-5 flex items-center gap-2 text-xs">
          {(() => {
            const target = new Date(targetDate)
            const daysUntil = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            const urgent = daysUntil <= 30 && daysUntil >= 0
            const past = daysUntil < 0
            return (
              <>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium tabular-nums ${past ? 'bg-[#ECF1EC] text-[#4E5F57] border border-[#DCE7DF]' : urgent ? 'bg-[#F5DDDF] text-[#8B2F38] border border-[#E8B8BD]' : 'bg-[#E4F2EA] text-[#2C6440] border border-[#C2DECC]'}`}>
                  <Clock className="w-3 h-3" />
                  {past ? `${Math.abs(daysUntil)}d ago` : `${daysUntil}d to move`}
                </span>
                <span className="text-[#7E9088]">
                  {target.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {targetCountry && <span className="text-[#7E9088]">· {targetCountry}</span>}
              </>
            )
          })()}
        </div>
      )}

      {/* Plan Switcher - shows plan name with rename option, dropdown for Pro */}
      <div className="mb-4">
        <PlanSwitcher 
          showRename 
          onPlanChange={() => {
            // Reload all dashboard data when plan changes
            window.location.reload()
          }}
        />
      </div>

      {/* Phase IA — the Overview/Profile/Visa & Legal/Money/Settling tab
          system has been retired. Profile + Money moved to Settings;
          Visa & Legal merged into the Immigration workspace; Settling
          merged into Post-move. Dashboard is now overview-only. */}

      {/* Compliance Alerts (post-arrival) */}
      <ComplianceAlerts planStage={plan?.stage} className="gm-animate-in gm-delay-1" />

      {/* Plan Consistency Alerts */}
      {plan && hasDestination && (
        <TierGate tier={tier} feature="guides" onUpgrade={goToUpgrade}>
          <div className="mb-4 gm-animate-in gm-delay-1">
            <PlanConsistencyAlerts planId={plan.id} />
          </div>
        </TierGate>
      )}

      {/* Phase 5.4 — manual generation triggers (Spine steps 6 + 9). */}
      <ManualTriggerCard plan={plan} />

      {/* Research Status Banner */}
      {researchStatus === "in_progress" && (
        <div className="mb-4 p-3.5 rounded-md bg-[#F7FAF7] border border-[#DCE7DF] flex items-center gap-3 gm-surface" style={{ background: "#F7FAF7" }}>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E4F2EA]">
            <Loader2 className="w-4 h-4 text-[#3F8E5A] animate-spin" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#1F2A24]">Researching your relocation requirements…</p>
            <p className="text-[11.5px] text-[#7E9088] mt-0.5">We're gathering visa options and local requirements for {targetCountry}. This may take a minute.</p>
          </div>
        </div>
      )}
      
      {researchStatus === "completed" && plan?.research_completed_at && (() => {
        const daysSince = Math.floor((Date.now() - new Date(plan.research_completed_at).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince < 7) return null
        return (
          <div className="mb-4 p-3.5 rounded-md bg-[#F6ECD7]/40 border border-[#E8C77B] flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#F6ECD7]">
              <AlertCircle className="w-3.5 h-3.5 text-[#8C6B2F]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[#1F2A24]">Research may be outdated</p>
              <p className="text-[11.5px] text-[#7E9088] mt-0.5">Last researched {daysSince} days ago.</p>
            </div>
          </div>
        )
      })()}

      {researchStatus === "partial" && (
        <div className="mb-4 p-3.5 rounded-md bg-[#F6ECD7]/40 border border-[#E8C77B] flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#F6ECD7]">
            <AlertCircle className="w-3.5 h-3.5 text-[#8C6B2F]" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#1F2A24]">Research completed with limited results</p>
            <p className="text-[11.5px] text-[#7E9088] mt-0.5">Some research areas returned limited data.</p>
          </div>
        </div>
      )}

      {researchStatus === "failed" && (
        <div className="mb-4 p-3.5 rounded-md bg-[#F5DDDF]/40 border border-[#E8B8BD] flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#F5DDDF]">
            <AlertCircle className="w-3.5 h-3.5 text-[#8B2F38]" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#1F2A24]">Research couldn't be completed</p>
            <p className="text-[11.5px] text-[#7E9088] mt-0.5">You can manually trigger research from the sections below.</p>
          </div>
        </div>
      )}

      {/* Dashboard overview — compact tile row + status snapshot only.
          The previous twelve Phase-3-through-6 sections are homed in
          their workspaces (/immigration /pre-move /post-move /documents
          /guidance). */}
      <div className="mb-7 space-y-3">
        <span className="gm-eyebrow">Workspaces</span>
        <WorkspaceTiles />
      </div>
      {/* Profile stats — real grid card with vertical dividers */}
      {hasDestination && (
        <div className="mb-6 gm-animate-in gm-delay-1">
          {hasCitizenship && (
            <div className="mb-3">
              <VisaStatusBadge citizenship={citizenship} destination={targetCountry} />
            </div>
          )}
          <div className="gm-surface grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#E2E8E1]">
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-[#7E9088]">
                <MapPin className="w-3 h-3" strokeWidth={1.7} />
                Destination
              </div>
              <div className="mt-1.5 text-[14px] font-semibold text-[#1F2A24] flex items-center gap-1.5">
                <CountryFlag country={targetCountry} size="sm" />
                {targetCountry}
              </div>
              {profile.current_location && (
                <div className="text-[11px] text-[#7E9088] mt-0.5">from {profile.current_location}</div>
              )}
            </div>
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-[#7E9088]">
                <Calendar className="w-3 h-3" strokeWidth={1.7} />
                Purpose
              </div>
              <div className="mt-1.5 text-[14px] font-semibold text-[#1F2A24]">
                {formatEnumLabel(profile.purpose)}
              </div>
              {profile.visa_role && (
                <div className="text-[11px] text-[#7E9088] mt-0.5">{formatEnumLabel(profile.visa_role)}</div>
              )}
            </div>
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-[#7E9088]">
                <TrendingUp className="w-3 h-3" strokeWidth={1.7} />
                Profile
              </div>
              <div className="mt-1.5 text-[14px] font-semibold text-[#1F2A24]">
                {dashboardState.profileProgressLabel}
              </div>
              <div className="text-[11px] text-[#7E9088] mt-0.5">complete</div>
            </div>
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-[#7E9088]">
                <Clock className="w-3 h-3" strokeWidth={1.7} />
                Timeline
              </div>
              <div className="mt-1.5 text-[14px] font-semibold text-[#1F2A24]">
                {profile.timeline || (hasTimeline ? formatTimeUntilMove(monthsUntilMove) : "Not set")}
              </div>
              {hasTimeline && profile.timeline && (
                <div className="text-[11px] text-[#7E9088] mt-0.5">≈ {formatTimeUntilMove(monthsUntilMove)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suggested Guide — compact row */}
      {hasDestination && (
        <div className="mb-6 gm-animate-in gm-delay-3 gm-surface flex items-center justify-between gap-3 px-3.5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <CountryFlag country={targetCountry} size="sm" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#1F2A24] truncate">
                {targetCountry} relocation guide
              </p>
              <p className="text-[11.5px] text-[#7E9088]">
                {humaniseSnake(profile.purpose) || "Relocation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`https://www.gomaterelocate.com/country-guides/${targetCountry.toLowerCase().replace(/\s+/g, "-")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#3F6B53] hover:text-[#2D3E36] transition-colors"
            >
              Read
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* "Tailored to your move" specialist insight cards (Cultural
          Brief, Departure / Exit Tax, etc.) lived here pre-IA refresh.
          Per sitemap.md the dashboard is overview-only — these advisory
          cards are now reachable via Plan & Guidance / Post-move
          orientation. We keep the data flow + registry (specialistCards
          / CARD_TO_SPECIALIST) wired in case we later want a tight
          one-line "next insight"-strip on the dashboard, but the
          full-card render is gone. */}


      {/* Plan Change Summary Dialog */}
      <PlanChangeSummary
        summary={changeSummary}
        open={changeSummaryOpen}
        onClose={() => setChangeSummaryOpen(false)}
        onRegenerateGuide={() => {
          // Guides retired — closing the dialog is enough now.
          setChangeSummaryOpen(false)
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
      onTabChange={() => { /* tabs retired — see IA refresh notes */ }}
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
      <div className="mb-5 gm-surface p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <span className="gm-eyebrow">Step 1 of 3</span>
            <h2 className="text-[16px] sm:text-[17px] font-sans font-semibold text-[#1F2A24] mt-2">Generate my plan</h2>
            <p className="text-[12px] text-[#4E5F57] mt-1 max-w-xl leading-relaxed">
              Spin up your specialist team — visa, tax, housing, banking, healthcare, culture, documents — and produce your full relocation guide. Takes about 90 seconds.
            </p>
            {error && <p className="text-[12px] text-[#8B2F38] mt-2">⚠ {error}</p>}
          </div>
          <Button
            onClick={() => fire("research")}
            disabled={busy}
            data-testid="trigger-generate-research"
            className="gap-2 rounded-md text-white font-semibold shadow-sm bg-[#1B7A40] hover:bg-[#15663A]"
            size="sm"
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
      <div className="mb-5 gm-surface p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <span className="gm-eyebrow">Step 2 of 3</span>
            <h2 className="text-[16px] sm:text-[17px] font-sans font-semibold text-[#1F2A24] mt-2">Generate my pre-departure checklist</h2>
            <p className="text-[12px] text-[#4E5F57] mt-1 max-w-xl leading-relaxed">
              Sequence every pre-move action — apostilles, A1, banking bridge, pet vaccination, lease termination — into a week-by-week plan with critical path highlighted. ~30 seconds.
            </p>
            {error && <p className="text-[12px] text-[#8B2F38] mt-2">⚠ {error}</p>}
          </div>
          <Button
            onClick={() => fire("preDeparture")}
            disabled={busy}
            data-testid="trigger-generate-predeparture"
            className="gap-2 rounded-md text-white font-semibold shadow-sm bg-[#1B7A40] hover:bg-[#15663A]"
            size="sm"
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
    <div className="mb-4 rounded-xl bg-white dark:bg-card border border-[rgba(15,23,42,0.08)] dark:border-[rgba(255,255,255,0.06)] p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <span className="gm-eyebrow">Step 3 of 3</span>
          <h2 className="text-[16px] sm:text-[17px] font-sans font-semibold text-[#1F2A24] mt-2">I have arrived</h2>
          <p className="text-[12px] text-[#4E5F57] mt-1 max-w-xl leading-relaxed">
            Confirm your arrival to switch GoMate into post-arrival mode and unlock your settling-in task graph (population registration, bank, healthcare, schools).
          </p>
          {error && <p className="text-[12px] text-[#8B2F38] mt-2">⚠ {error}</p>}
        </div>
        <Button
          onClick={() => fire("arrived")}
          disabled={busy}
          data-testid="trigger-mark-arrived"
          className="gap-2 rounded-md text-white font-semibold shadow-sm bg-[#1B7A40] hover:bg-[#15663A]"
          size="sm"
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
