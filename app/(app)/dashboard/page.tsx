"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { InfoCard } from "@/components/info-card"
import { CountdownTimer } from "@/components/countdown-timer"
import { BudgetPlanCard, type BudgetPlanData } from "@/components/budget-plan-card"
import { VisaRoutesCard, type VisaData } from "@/components/visa-routes-card"
import { VisaResearchCard, type VisaResearchData } from "@/components/visa-research-card"
import { LocalRequirementsCard, type LocalRequirementsData } from "@/components/local-requirements-card"
import { DocumentProgressCard, type DocumentItem, type DocumentStatus } from "@/components/document-progress-card"
import { CountryFlag } from "@/components/country-flag"
import { VisaStatusBadge } from "@/components/visa-status-badge"
import { ProfileDetailsCard } from "@/components/profile-details-card"
import { CostOfLivingCard } from "@/components/cost-of-living-card"
import { PlanSwitcher } from "@/components/plan-switcher"
import { TierGate } from "@/components/tier-gate"
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
  AlertCircle
} from "lucide-react"
import { type Profile, getRequiredFields } from "@/lib/gomate/profile-schema"
import { getCompletionPercentage, getFilledFields } from "@/lib/gomate/state-machine"

interface RelocationPlan {
  id: string
  user_id: string
  profile_data: Profile
  stage: string
  title: string | null
  status: string
  is_current: boolean
  locked: boolean
  locked_at: string | null
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
  
  return {
    currency: destination.toLowerCase().includes("japan") ? "JPY" : 
              destination.toLowerCase().includes("uk") ? "GBP" : 
              destination.toLowerCase().includes("uae") || destination.toLowerCase().includes("dubai") ? "AED" : "EUR",
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
  const { tier, can } = useTier()
  const goToUpgrade = () => router.push("/pricing")
  const [plan, setPlan] = useState<RelocationPlan | null>(null)
  const [userGuide, setUserGuide] = useState<UserGuide | null>(null)
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, DocumentStatus>>({})
  const [loading, setLoading] = useState(true)
  const [lockLoading, setLockLoading] = useState(false)
  const [selectedVisaRoute, setSelectedVisaRoute] = useState<number | undefined>(0)
  const [visaResearch, setVisaResearch] = useState<VisaResearchData | null>(null)
  const [localRequirements, setLocalRequirements] = useState<LocalRequirementsData | null>(null)
  const [researchStatus, setResearchStatus] = useState<string | null>(null)

  // Fetch the user's plan, guide, and document statuses on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [planRes, guidesRes, docsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/guides"),
          fetch("/api/documents"),
        ])
        
        if (planRes.ok) {
          const data = await planRes.json()
          setPlan(data.plan)
          // Check for cached research data
          if (data.plan?.visa_research) {
            setVisaResearch(data.plan.visa_research)
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
      } catch (error) {
        console.error("[GoMate] Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Lock/unlock handlers
  const handleLockPlan = async () => {
    if (!plan) return
    setLockLoading(true)
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock", planId: plan.id }),
      })
      if (response.ok) {
        const data = await response.json()
        setPlan(data.plan)
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
        body: JSON.stringify({ action: "unlock", planId: plan.id }),
      })
      if (response.ok) {
        const data = await response.json()
        setPlan(data.plan)
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
  
  // Calculate profile completeness using actual required fields from schema
  const requiredFields = getRequiredFields(profile)
  const filledFieldsList = getFilledFields(profile)
  const filledCount = filledFieldsList.length
  const progressPercent = getCompletionPercentage(profile)

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
  if (filledCount < 3) {
    return (
      <div className="p-6 md:p-8 lg:p-10">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Welcome to GoMate
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Let's start planning your relocation. Chat with me to tell me about your move, 
            and I'll create a personalized dashboard with visa recommendations, budget plans, 
            and a document checklist.
          </p>
          <Button asChild size="lg" className="rounded-xl gap-2">
            <Link href="/chat">
              <MessageSquare className="w-5 h-5" />
              Start planning
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <PageHeader 
        title={profile.name ? `${profile.name}'s move at a glance` : "Your move at a glance"}
        description={hasDestination 
          ? `Track your relocation to ${targetCountry} and stay on top of important tasks.`
          : "Track your relocation progress and stay on top of important tasks."
        }
        action={
          <div className="flex items-center gap-3">
            {isLocked && (
              <Badge variant="secondary" className="gap-1.5 bg-primary/10 text-primary border-primary/20">
                <Shield className="w-3.5 h-3.5" />
                Plan locked
              </Badge>
            )}
            {progressPercent === 100 && !isLocked && (
              <Button 
                onClick={handleLockPlan} 
                variant="outline" 
                className="gap-2 rounded-xl bg-transparent"
                disabled={lockLoading}
              >
                <Lock className="w-4 h-4" />
                {lockLoading ? "Locking..." : "Lock plan"}
              </Button>
            )}
            {isLocked && (
              <Button 
                onClick={handleUnlockPlan} 
                variant="outline" 
                className="gap-2 rounded-xl bg-transparent"
                disabled={lockLoading}
              >
                <Unlock className="w-4 h-4" />
                {lockLoading ? "Unlocking..." : "Unlock to edit"}
              </Button>
            )}
            <Button asChild className="gap-2 rounded-xl">
              <Link href="/chat">
                <MessageSquare className="w-4 h-4" />
                {isLocked ? "Ask questions" : "Continue planning"}
              </Link>
            </Button>
          </div>
        }
      />

      {/* Plan Switcher - shows plan name with rename option, dropdown for Pro+ */}
      <div className="mb-6">
        <PlanSwitcher 
          showRename 
          onPlanChange={() => {
            // Reload all dashboard data when plan changes
            window.location.reload()
          }}
        />
      </div>

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

      {/* Countdown Timer - Prominent at top */}
      {hasDestination && (
        <div className="mb-8">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Destination"
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
          value={profile.purpose ? profile.purpose.charAt(0).toUpperCase() + profile.purpose.slice(1) : "Not set"}
          subtitle={profile.sub_purpose || "Set in chat"}
          icon={<Calendar className="w-5 h-5" />}
        />
        <StatCard
          title="Profile"
          value={`${progressPercent}%`}
          subtitle={`${filledCount} of ${requiredFields.length} fields`}
          trend={progressPercent > 50 ? "up" : undefined}
          icon={<TrendingUp className="w-5 h-5" />}
        />
<StatCard
                title="Timeline"
                value={hasTimeline ? formatTimeUntilMove(monthsUntilMove) : "Not set"}
                subtitle={hasTimeline ? profile.timeline : "Set in chat"}
                icon={<Clock className="w-5 h-5" />}
              />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Profile Summary */}
        <div className="lg:col-span-2">
          <ProfileDetailsCard 
            profile={profile} 
            onFieldClick={!isLocked ? (fieldKey, fieldLabel) => {
              router.push(`/chat?field=${encodeURIComponent(fieldKey)}&label=${encodeURIComponent(fieldLabel)}`)
            } : undefined}
          />
          
          {/* Actions below profile */}
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

        {/* Right Column */}
        <div className="space-y-6">
{/* Document Progress Card */}
<TierGate tier={tier} feature="documents" onUpgrade={goToUpgrade}>
  <DocumentProgressCard
    items={documentItems}
    statuses={documentStatuses}
    planId={plan?.id}
  />
</TierGate>

          {/* Your Personal Guide - Show if locked and guide exists */}
          {isLocked && userGuide && (
            <TierGate tier={tier} feature="guides" onUpgrade={goToUpgrade}>
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Your Personal Guide</h2>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-0">Generated</Badge>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <CountryFlag country={userGuide.destination} size="md" />
                  <div>
                    <h3 className="font-medium text-foreground">{userGuide.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Complete guide for your {userGuide.purpose} journey
                    </p>
                  </div>
                </div>
                <Button asChild className="w-full gap-2">
                  <Link href={`/guides/${userGuide.id}`}>
                    View Your Guide
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </TierGate>
          )}

          {/* Suggested Guide - Only show destination country */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Suggested Guide</h2>
            </div>
            <a
              href={`https://www.gomaterelocate.com/country-guides/${targetCountry.toLowerCase().replace(/\s+/g, "-")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <CountryFlag country={targetCountry} size="lg" />
                <div>
                  <h3 className="font-semibold text-foreground">{targetCountry} Guide</h3>
                  <p className="text-sm text-muted-foreground">Complete relocation guide</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs capitalize">{profile.purpose || "Relocation"}</Badge>
                <span className="flex items-center gap-1 text-sm text-primary font-medium">
                  Read guide
                  <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </div>
            </a>
            <Button variant="ghost" asChild className="w-full mt-4 gap-2">
              <a href="https://www.gomaterelocate.com/country-guides" target="_blank" rel="noopener noreferrer">
                Browse all country guides
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* AI Visa Research Section */}
      {hasDestination && hasCitizenship && (
        <TierGate tier={tier} feature="visa_recommendation" onUpgrade={goToUpgrade}>
          <div className="mb-8">
            <VisaResearchCard
              planId={plan?.id}
              destination={targetCountry}
              citizenship={citizenship}
              purpose={profile.purpose}
              cachedResearch={visaResearch}
              researchStatus={researchStatus}
              onResearchComplete={(data) => {
                setVisaResearch(data)
                setResearchStatus("completed")
              }}
            />
          </div>
        </TierGate>
      )}

      {/* Static Visa Routes Section (fallback when no AI research) */}
      {hasDestination && hasCitizenship && !visaResearch && (
        <TierGate tier={tier} feature="visa_recommendation" onUpgrade={goToUpgrade}>
          <div className="mb-8">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Common Visa Options</h2>
                <Badge variant="outline" className="text-xs">Static data</Badge>
              </div>
              <VisaRoutesCard 
                visaData={visaData}
                selectedRouteIndex={selectedVisaRoute}
                onSelectRoute={setSelectedVisaRoute}
              />
            </div>
          </div>
        </TierGate>
      )}

      {/* Local Requirements Section */}
      {hasDestination && (
        <TierGate tier={tier} feature="local_requirements" onUpgrade={goToUpgrade}>
          <div className="mb-8">
            <LocalRequirementsCard
              planId={plan?.id}
              destination={targetCountry}
              city={profile.target_city}
              cachedResearch={localRequirements}
              researchStatus={researchStatus}
              onResearchComplete={(data) => {
                setLocalRequirements(data)
              }}
            />
          </div>
        </TierGate>
      )}

      {/* Budget & Cost of Living Section */}
      {hasDestination && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TierGate tier={tier} feature="budget_planner" onUpgrade={goToUpgrade}>
            <BudgetPlanCard
              budget={budgetData}
              targetCity={profile.target_city || profile.destination || "Berlin"}
              targetCountry={targetCountry}
              currentSavings={parseFloat(profile.savings_available || "0") || 0}
              onUpdateSavings={async (amount) => {
                // Update local state
                if (plan) {
                  const updatedProfile = { ...profile, savings_available: amount.toString() }
                  setPlan({ ...plan, profile_data: updatedProfile })
                }
                
                // Persist to backend
                try {
                  await fetch("/api/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ profileData: { savings_available: amount.toString() } }),
                  })
                } catch (error) {
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
              householdSize={
                profile.moving_alone === "yes" ? "single" :
                profile.partner_coming === "yes" && !profile.children_count ? "couple" :
                profile.children_count ? "family4" : "single"
              }
            />
          </TierGate>
        </div>
      )}

      {/* CTA Card */}
      <InfoCard
        title={progressPercent < 100 ? "Continue building your profile" : "Ready to continue planning?"}
        description={progressPercent < 100 
          ? `Your profile is ${progressPercent}% complete. Chat with GoMate to fill in the remaining details.`
          : "Chat with GoMate to get personalized guidance for your next steps."
        }
        variant="highlight"
        icon={<MessageSquare className="w-5 h-5" />}
        action={
          <Button asChild className="rounded-xl">
            <Link href="/chat">Open chat</Link>
          </Button>
        }
      />
    </div>
  )
}
