import { useEffect, useState } from "react"
import { useLocation, Link } from "wouter"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ListChecks, Plane, FileCheck, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import SettlingInPage from "@/pages/settling-in"
import { PreDepartureTimeline } from "@/components/pre-departure-timeline"
import { PageHero } from "@/components/page-hero"
import {
  DomainGroupedDocumentsChecklist,
  type DetailedDocument,
} from "@/components/domain-grouped-documents"

type ChecklistTab = "pre-move" | "post-move" | "documents"

function getTabFromQuery(search: string): ChecklistTab {
  const params = new URLSearchParams(search)
  const t = params.get("tab")
  if (t === "pre-move" || t === "post-move" || t === "documents") return t
  return "pre-move"
}

function DocumentsTab() {
  const [loading, setLoading] = useState(true)
  const [planId, setPlanId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DetailedDocument[]>([])
  const [statuses, setStatuses] = useState<Record<string, unknown>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch("/api/documents")
        if (!active) return
        if (!res.ok) {
          setError("Could not load documents.")
          return
        }
        const data = await res.json()
        setPlanId(data.planId ?? null)
        setStatuses(data.statuses ?? {})
        setWarnings(Array.isArray(data.documentWarnings) ? data.documentWarnings : [])
        const detailed = Array.isArray(data.documentsDetailed) ? data.documentsDetailed : []
        setDocuments(detailed.map((d: Record<string, unknown>) => ({
          id: String(d.id ?? ""),
          name: String(d.name ?? ""),
          domain: (d.domain as DetailedDocument["domain"]) ?? "personal",
          phase: (d.phase as DetailedDocument["phase"]) ?? "before_move",
          whyNeeded: String(d.whyNeeded ?? ""),
          whereToObtain: String(d.whereToObtain ?? ""),
          needsApostille: d.needsApostille === true,
          needsTranslation: d.needsTranslation === true,
          submissionDestination: String(d.submissionDestination ?? ""),
          leadTimeDays: typeof d.leadTimeDays === "number" ? d.leadTimeDays : null,
          issuingAuthority: String(d.issuingAuthority ?? ""),
          appliesWhen: String(d.appliesWhen ?? ""),
        })).filter((d: DetailedDocument) => d.id && d.name))
      } catch {
        if (active) setError("Could not load documents.")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  if (loading) return <Skeleton className="h-64 rounded-2xl" />
  if (error) {
    return (
      <div className="gm-card-static p-8 text-center space-y-2">
        <FileCheck className="w-10 h-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">{error}</h3>
        <p className="text-sm text-muted-foreground">Try refreshing the page.</p>
      </div>
    )
  }

  return (
    <DomainGroupedDocumentsChecklist
      planId={planId}
      documents={documents}
      initialStatuses={statuses}
      warnings={warnings}
    />
  )
}

export default function ChecklistPage() {
  const [location, setLocation] = useLocation()
  const [tab, setTab] = useState<ChecklistTab>(() =>
    getTabFromQuery(typeof window !== "undefined" ? window.location.search : "")
  )

  useEffect(() => {
    setTab(getTabFromQuery(window.location.search))
  }, [location])

  const handleTabChange = (next: string) => {
    const t = next as ChecklistTab
    setTab(t)
    const params = new URLSearchParams(window.location.search)
    params.set("tab", t)
    setLocation(`/checklist?${params.toString()}`, { replace: true })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        <PageHero
          eyebrow="Relocation checklist"
          title="Everything you need to do — before, during and after your move"
          subtitle="Pre-move tasks, post-arrival registrations, and the document pipeline that links them together."
          actions={
            <Button variant="outline" size="sm" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
              <Link href="/dashboard"><ArrowLeft className="w-3.5 h-3.5 mr-1" />Dashboard</Link>
            </Button>
          }
        />

        <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-11 mb-4">
            <TabsTrigger value="pre-move" className="gap-2">
              <Plane className="w-4 h-4" /> Pre-move
            </TabsTrigger>
            <TabsTrigger value="post-move" className="gap-2">
              <ListChecks className="w-4 h-4" /> Post-arrival
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileCheck className="w-4 h-4" /> Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pre-move" className="mt-0">
            <PreDepartureTimeline />
          </TabsContent>
          <TabsContent value="post-move" className="mt-0">
            <SettlingInPage />
          </TabsContent>
          <TabsContent value="documents" className="mt-0">
            <DocumentsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
