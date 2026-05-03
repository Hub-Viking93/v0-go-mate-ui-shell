

import { useState, useEffect } from "react"
import { useRouter } from "@/lib/router-compat"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CountryFlag } from "@/components/country-flag"
import { FullPageGate } from "@/components/tier-gate"
import { useTier } from "@/hooks/use-tier"
import { 
  ExternalLink, 
  Globe, 
  BookOpen, 
  Plus, 
  FileText,
  Calendar,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react"

interface UserGuide {
  id: string
  title: string
  destination: string
  destination_city?: string
  purpose: string
  status: string
  created_at: string
  updated_at: string
  guide_type?: string
  hero_image_url?: string
  hero_image_attribution?: { photographerName: string; photographerUrl: string }
}

const countries = [
  { name: "USA", tags: ["study", "work"], region: "North America" },
  { name: "Canada", tags: ["study", "work"], region: "North America" },
  // Add more countries here
]

export default function GuidesPage() {
  const router = useRouter()
  const { tier } = useTier()
  const [activeTab, setActiveTab] = useState("my-guides")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const [activeRegion, setActiveRegion] = useState("All Regions")
  
  // User guides state
  const [userGuides, setUserGuides] = useState<UserGuide[]>([])
  const [loadingGuides, setLoadingGuides] = useState(true)
  const [generatingGuide, setGeneratingGuide] = useState(false)

  // Fetch user's guides
  useEffect(() => {
    async function fetchGuides() {
      try {
        const response = await fetch("/api/guides")
        if (response.ok) {
          const data = await response.json()
          setUserGuides(data.guides || [])
        }
      } catch (error) {
        console.error("Error fetching guides:", error)
      } finally {
        setLoadingGuides(false)
      }
    }
    fetchGuides()
  }, [])

  // Generate a new guide
  const handleGenerateGuide = async () => {
    setGeneratingGuide(true)
    try {
      const response = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.guide) {
          setUserGuides(prev => [data.guide, ...prev.filter(g => g.id !== data.guide.id)])
          router.push(`/guides/${data.guide.id}`)
        }
      } else {
        const error = await response.json()
        alert(error.error || "Failed to generate guide")
      }
    } catch (error) {
      console.error("Error generating guide:", error)
      alert("Failed to generate guide")
    } finally {
      setGeneratingGuide(false)
    }
  }

  const purposeLabels: Record<string, string> = {
    study: "Study",
    work: "Work",
    settle: "Settle",
    digital_nomad: "Digital Nomad",
    other: "Other",
  }

  return (
    <FullPageGate tier={tier} feature="guides" onUpgrade={() => router.push("/settings")}>
    <div className="p-6 md:p-8 lg:p-10">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B3A2D] via-[#234D3A] to-[#2D6A4F] p-6 md:p-8 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.15),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-[#5EE89C]" />
              Guides
            </h1>
            <p className="text-white/60 mt-1.5 text-sm md:text-base">
              Your personalized relocation guides and country information.
            </p>
          </div>
          <Button
            onClick={handleGenerateGuide}
            disabled={generatingGuide}
            className="gap-2 rounded-xl bg-white text-[#1B3A2D] hover:bg-white/90 shrink-0"
          >
            {generatingGuide ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {generatingGuide ? "Generating..." : "Generate Guide"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="my-guides" className="gap-2">
            <BookOpen className="w-4 h-4" />
            My Guides
            {userGuides.length > 0 && (
              <Badge variant="secondary" className="ml-1">{userGuides.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="country-guides" className="gap-2">
            <Globe className="w-4 h-4" />
            Country Guides
          </TabsTrigger>
        </TabsList>

        {/* My Guides Tab */}
        <TabsContent value="my-guides" className="space-y-6">
          {loadingGuides ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </Card>
              ))}
            </div>
          ) : userGuides.length === 0 ? (
            <div className="gm-card-static overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-[#1B3A2D] via-[#234D3A] to-[#2D6A4F] relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.2),transparent_60%)]" />
              </div>
              <div className="p-12 text-center -mt-8">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-card shadow-lg flex items-center justify-center mx-auto mb-6 border border-border">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No guides yet
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Complete your profile in the chat to generate a personalized relocation guide
                  with visa recommendations, budget planning, housing tips, and more.
                </p>
                <Button onClick={() => router.push("/chat")} className="gap-2 rounded-xl shadow-lg shadow-primary/20">
                  <Sparkles className="w-4 h-4" />
                  Start Planning
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userGuides.map((guide) => (
                <div
                  key={guide.id}
                  className="gm-card overflow-hidden cursor-pointer group"
                  onClick={() => router.push(`/guides/${guide.id}`)}
                >
                  {/* Hero — Unsplash photo when available, fallback to brand gradient */}
                  <div className="h-40 relative overflow-hidden">
                    {guide.hero_image_url ? (
                      <>
                        <img
                          src={guide.hero_image_url}
                          alt={guide.destination_city || guide.destination}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#1B3A2D] via-[#234D3A] to-[#2D6A4F]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.2),transparent_60%)]" />
                      </div>
                    )}
                    <div className="absolute bottom-3 left-4 z-10">
                      <CountryFlag country={guide.destination} size="md" />
                    </div>
                    <div className="absolute top-3 right-3 z-10">
                      <Badge className="bg-white/15 text-white border-white/20 backdrop-blur-sm text-xs">
                        {purposeLabels[guide.purpose] || guide.purpose}
                      </Badge>
                    </div>
                    {guide.hero_image_url && guide.destination_city && (
                      <div className="absolute bottom-3 right-4 z-10 text-right">
                        <p className="text-white text-sm font-semibold drop-shadow-md">
                          {guide.destination_city.split(",")[0]}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-lg">
                      {guide.destination}
                    </h3>
                    {guide.destination_city && (
                      <p className="text-sm text-muted-foreground">{guide.destination_city}</p>
                    )}

                    <p className="text-sm text-muted-foreground mt-3 mb-4 line-clamp-2">
                      {guide.title}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(guide.updated_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        View guide
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Country Guides Tab - Redirect to GoMate Website */}
        <TabsContent value="country-guides" className="space-y-6">
          <Card className="p-8 text-center">
            <div className="max-w-lg mx-auto space-y-6">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
                <Globe className="w-12 h-12 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  Explore Our Country Guides
                </h2>
                <p className="text-muted-foreground">
                  Visit our website for comprehensive country guides with detailed visa pathways, 
                  cost of living breakdowns, expat communities, and relocation tips for 50+ destinations.
                </p>
              </div>

              <Button asChild size="lg" className="gap-2">
                <a 
                  href="https://gomaterelocate.com/country-guides" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Globe className="w-5 h-5" />
                  Browse Country Guides
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>

              <p className="text-xs text-muted-foreground">
                Opens gomaterelocate.com in a new tab
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </FullPageGate>
  )
}
