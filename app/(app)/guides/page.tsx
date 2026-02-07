"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CountryFlag } from "@/components/country-flag"
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
}

const countries = [
  { name: "USA", tags: ["study", "work"], region: "North America" },
  { name: "Canada", tags: ["study", "work"], region: "North America" },
  // Add more countries here
]

export default function GuidesPage() {
  const router = useRouter()
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
    <div className="p-6 md:p-8 lg:p-10">
      <PageHeader
        title="Guides"
        description="Your personalized relocation guides and country information."
        action={
          <Button 
            onClick={handleGenerateGuide} 
            disabled={generatingGuide}
            className="gap-2"
          >
            {generatingGuide ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {generatingGuide ? "Generating..." : "Generate Guide"}
          </Button>
        }
      />

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
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No guides yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Complete your profile in the chat to generate a personalized relocation guide 
                  with visa recommendations, budget planning, housing tips, and more.
                </p>
                <Button onClick={() => router.push("/chat")} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Start Planning
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userGuides.map((guide) => (
                <Card 
                  key={guide.id} 
                  className="p-6 hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => router.push(`/guides/${guide.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <CountryFlag country={guide.destination} size="md" />
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {guide.destination}
                        </h3>
                        {guide.destination_city && (
                          <p className="text-sm text-muted-foreground">{guide.destination_city}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {purposeLabels[guide.purpose] || guide.purpose}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {guide.title}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(guide.updated_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      View guide
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Card>
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
  )
}
