"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { CountryFlag } from "@/components/country-flag"
import { use } from "react" // Import the use hook
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

interface GuideSection {
  [key: string]: unknown
}

interface Guide {
  id: string
  title: string
  destination: string
  destination_city?: string
  purpose: string
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
  }
  budget_section: {
    monthlyBudget: { minimum: number; comfortable: number; breakdown: Record<string, number> }
    savingsTarget: { emergencyFund: number; movingCosts: number; initialSetup: number; visaFees: number; total: number; timeline: string }
    costComparison?: string
    tips: string[]
  }
  housing_section: {
    overview: string
    averageRent: { studio: string; oneBed: string; twoBed: string }
    rentalPlatforms: { name: string; url: string; description: string }[]
    depositInfo: string
    tips: string[]
    warnings: string[]
  }
  banking_section: {
    overview: string
    recommendedBanks: { name: string; type: string; features: string[] }[]
    requirements: string[]
    digitalBanks: { name: string; features: string[] }[]
    tips: string[]
  }
  healthcare_section: {
    overview: string
    systemType: string
    insuranceRequirements: string
    registrationSteps: string[]
    emergencyInfo: string
    tips: string[]
  }
  culture_section: {
    overview: string
    language: { official: string; englishLevel: string; learningTips: string[] }
    socialNorms: string[]
    workCulture: string[]
    doAndDonts: { dos: string[]; donts: string[] }
    localTips: string[]
  }
  jobs_section?: {
    overview: string
    jobMarket: string
    inDemandSkills: string[]
    jobPlatforms: { name: string; url: string; description: string }[]
    salaryExpectations: string
    workPermitInfo: string
    networkingTips: string[]
  }
  education_section?: {
    overview: string
    systemType: string
    applicationProcess: string[]
    tuitionInfo: string
    scholarships: string[]
    tips: string[]
  }
  timeline_section: {
    totalMonths: number
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
}

export default function GuideDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [guide, setGuide] = useState<Guide | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    async function fetchGuide() {
      try {
        const response = await fetch(`/api/guides/${params.id}`)
        if (response.ok) {
          const data = await response.json()
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
  }, [params.id, router])

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
      const response = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        const data = await response.json()
        setGuide(data.guide)
      }
    } catch (error) {
      console.error("Error regenerating guide:", error)
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
            <p className="text-muted-foreground mb-6">{guide.overview?.summary}</p>
            
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
                <h2 className="text-xl font-semibold">{guide.visa_section?.recommendedVisa}</h2>
                <p className="text-muted-foreground">{guide.visa_section?.visaType}</p>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {guide.visa_section?.estimatedCost}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Processing Time</p>
                <p className="font-semibold">{guide.visa_section?.processingTime}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Eligibility</p>
                <p className="font-semibold">{guide.visa_section?.eligibility}</p>
              </div>
            </div>

            <h3 className="font-semibold mb-3">Requirements</h3>
            <ul className="space-y-2 mb-6">
              {guide.visa_section?.requirements?.map((req, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>

            <h3 className="font-semibold mb-3">Application Steps</h3>
            <ol className="space-y-3 mb-6">
              {guide.visa_section?.applicationSteps?.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium shrink-0">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            {guide.visa_section?.warnings?.length > 0 && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Monthly Budget</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Minimum</span>
                  <span className="text-2xl font-bold">
                    {guide.budget_section?.monthlyBudget?.minimum?.toLocaleString() || "N/A"}/mo
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Comfortable</span>
                  <span className="text-2xl font-bold text-primary">
                    {guide.budget_section?.monthlyBudget?.comfortable?.toLocaleString() || "N/A"}/mo
                  </span>
                </div>
              </div>
              
              <h3 className="font-semibold mt-6 mb-3">Breakdown</h3>
              <div className="space-y-2">
                {guide.budget_section?.monthlyBudget?.breakdown && 
                  Object.entries(guide.budget_section.monthlyBudget.breakdown).map(([category, amount]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{category}</span>
                      <span>{(amount as number).toLocaleString()}</span>
                    </div>
                  ))
                }
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Savings Target</h2>
              <div className="text-3xl font-bold text-primary mb-2">
                {guide.budget_section?.savingsTarget?.total?.toLocaleString() || "N/A"}
              </div>
              <p className="text-muted-foreground mb-4">
                Save over {guide.budget_section?.savingsTarget?.timeline}
              </p>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Emergency Fund (3 months)</span>
                  <span>{guide.budget_section?.savingsTarget?.emergencyFund?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Moving Costs</span>
                  <span>{guide.budget_section?.savingsTarget?.movingCosts?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Initial Setup</span>
                  <span>{guide.budget_section?.savingsTarget?.initialSetup?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Visa & Fees</span>
                  <span>{guide.budget_section?.savingsTarget?.visaFees?.toLocaleString()}</span>
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
        </TabsContent>

        {/* Housing Tab */}
        <TabsContent value="housing" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Housing Overview</h2>
            <p className="text-muted-foreground mb-6">{guide.housing_section?.overview}</p>
            
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
            <p className="text-muted-foreground mb-6">{guide.banking_section?.overview}</p>
            
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
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Healthcare
            </h2>
            <p className="text-muted-foreground mb-4">{guide.healthcare_section?.overview}</p>
            
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
          </Card>
        </TabsContent>

        {/* Culture Tab */}
        <TabsContent value="culture" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Cultural Overview</h2>
            <p className="text-muted-foreground mb-6">{guide.culture_section?.overview}</p>
            
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
              <p className="text-muted-foreground mb-6">{guide.jobs_section?.overview}</p>
              
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
            </Card>
          </TabsContent>
        )}

        {/* Education Tab */}
        {guide.education_section && (
          <TabsContent value="education" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Education Overview</h2>
              <p className="text-muted-foreground mb-6">{guide.education_section?.overview}</p>
              
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
            </Card>
          </TabsContent>
        )}

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-2">Your Relocation Timeline</h2>
            <p className="text-muted-foreground mb-6">
              Estimated total: {guide.timeline_section?.totalMonths} months
            </p>
            
            <div className="space-y-6">
              {guide.timeline_section?.phases?.map((phase, i) => (
                <div key={i} className="relative pl-8 pb-6 border-l-2 border-primary/20 last:pb-0">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-primary" />
                  <div className="mb-2">
                    <h3 className="font-semibold">{phase.name}</h3>
                    <p className="text-sm text-muted-foreground">{phase.duration}</p>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {phase.tasks?.map((task, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <CheckSquare className="w-4 h-4 text-muted-foreground" />
                        {task}
                      </li>
                    ))}
                  </ul>
                  {phase.tips?.[0] && (
                    <p className="text-sm text-primary italic">{phase.tips[0]}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
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
