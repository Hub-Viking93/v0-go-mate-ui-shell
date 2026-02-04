"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { CountryCard } from "@/components/country-card"
import { CountryCardSkeleton } from "@/components/skeletons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CountryFlag } from "@/components/country-flag"
import { 
  Search, 
  Filter, 
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
  { name: "Germany", slug: "germany", tags: ["Work", "Study", "Settle"], region: "Europe" },
  { name: "Japan", slug: "japan", tags: ["Study", "Work"], region: "Asia" },
  { name: "Portugal", slug: "portugal", tags: ["Settle", "Remote Work"], region: "Europe" },
  { name: "Canada", slug: "canada", tags: ["Work", "Study", "Settle"], region: "North America" },
  { name: "Australia", slug: "australia", tags: ["Work", "Study"], region: "Oceania" },
  { name: "Netherlands", slug: "netherlands", tags: ["Work", "Study"], region: "Europe" },
  { name: "Spain", slug: "spain", tags: ["Settle", "Remote Work"], region: "Europe" },
  { name: "Singapore", slug: "singapore", tags: ["Work"], region: "Asia" },
  { name: "New Zealand", slug: "new-zealand", tags: ["Work", "Settle"], region: "Oceania" },
  { name: "France", slug: "france", tags: ["Study", "Work"], region: "Europe" },
  { name: "United Kingdom", slug: "united-kingdom", tags: ["Work", "Study"], region: "Europe" },
  { name: "Sweden", slug: "sweden", tags: ["Work", "Study"], region: "Europe" },
]

const filters = ["All", "Work", "Study", "Settle", "Remote Work"]
const regions = ["All Regions", "Europe", "Asia", "North America", "Oceania"]

const guideTypeLabels: Record<string, string> = {
  main: "Main",
  additional: "Additional",
}

export default function GuidesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const [activeRegion, setActiveRegion] = useState("All Regions")
  const [activeTab, setActiveTab] = useState("my-guides")
  
  // User guides state
  const [userGuides, setUserGuides] = useState<UserGuide[]>([])
  const [loadingGuides, setLoadingGuides] = useState(true)
  const [generatingGuide, setGeneratingGuide] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [generateProgress, setGenerateProgress] = useState<{ current: number, total: number }>({ current: 0, total: 0 })

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

  const handleGenerateAllGuides = async () => {
    // Placeholder for handleGenerateAllGuides function
  }

  const filteredCountries = countries.filter((country) => {
    const matchesSearch = country.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "All" || country.tags.includes(activeFilter)
    const matchesRegion = activeRegion === "All Regions" || country.region === activeRegion
    return matchesSearch && matchesFilter && matchesRegion
  })

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

        {/* Country Guides Tab */}
        <TabsContent value="country-guides" className="space-y-6">
          {/* GoMate Website Banner */}
          <a
            href="https://www.gomaterelocate.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-2xl bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  View Full Country Guides on GoMate
                </p>
                <p className="text-sm text-muted-foreground">
                  In-depth visa pathways, cost of living, and relocation tips at gomaterelocate.com
                </p>
              </div>
              <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </a>

          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {filters.map((filter) => (
                <Button
                  key={filter}
                  variant={activeFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(filter)}
                  className="rounded-full"
                >
                  {filter}
                </Button>
              ))}
            </div>

            {/* Region Filter */}
            <div className="flex flex-wrap gap-2">
              {regions.map((region) => (
                <Badge
                  key={region}
                  variant={activeRegion === region ? "default" : "outline"}
                  className="cursor-pointer hover:bg-secondary"
                  onClick={() => setActiveRegion(region)}
                >
                  {region}
                </Badge>
              ))}
            </div>
          </div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            Showing {filteredCountries.length} of {countries.length} countries
          </p>

          {/* Country Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCountries.map((country) => (
              <CountryCard
                key={country.slug}
                name={country.name}
                slug={country.slug}
                tags={country.tags}
              />
            ))}
          </div>

          {/* Empty State */}
          {filteredCountries.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No countries match your search criteria.</p>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchQuery("")
                  setActiveFilter("All")
                  setActiveRegion("All Regions")
                }}
                className="mt-4"
              >
                Clear filters
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
