import { useEffect, useState } from "react"
import { useLocation, Link } from "wouter"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ListChecks, Plane, FileCheck, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import SettlingInPage from "@/pages/settling-in"
import { PreMoveTimeline } from "@/components/pre-move-timeline"
import { PageHero } from "@/components/page-hero"
import {
  DomainGroupedDocumentsChecklist,
  type DetailedDocument,
} from "@/components/domain-grouped-documents"

type ChecklistTab = "pre-move" | "post-move" | "documents"

interface ChecklistPlanInfo {
  planId: string | null
  targetDate: string | null
  guideId: string | null
  timelineSection: {
    totalMonths: number
    overview?: string
    phases: { name: string; duration: string; tasks: string[]; tips: string[] }[]
  } | null
}

function getTabFromQuery(search: string): ChecklistTab {
  const params = new URLSearchParams(search)
  const t = params.get("tab")
  if (t === "pre-move" || t === "post-move" || t === "documents") return t
  return "pre-move"
}

function PreMoveTab() {
  const [info, setInfo] = useState<ChecklistPlanInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [profileRes, guidesRes, preDepRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/guides"),
          fetch("/api/pre-departure"),
        ])
        if (!active) return
        let planId: string | null = null
        let targetDate: string | null = null
        if (profileRes.ok) {
          const data = await profileRes.json()
          planId = data.plan?.id ?? null
          targetDate = data.plan?.profile_data?.timeline ?? null
        }
        let guideId: string | null = null
        let timelineSection: ChecklistPlanInfo["timelineSection"] = null

        // 1. Try the guide's embedded timeline first.
        if (guidesRes.ok) {
          const data = await guidesRes.json()
          const guide = data.guides?.[0]
          if (guide) {
            guideId = guide.id
            const detail = await fetch(`/api/guides/${guide.id}`)
            if (detail.ok) {
              const g = await detail.json()
              const ts = g.guide?.timeline_section
              if (ts && Array.isArray(ts.phases) && ts.phases.length > 0) {
                timelineSection = ts
              }
            }
          }
        }

        // 2. Fall back to pre-departure actions directly if the guide
        // hasn't been (re)generated since pre-departure was created.
        // Same shape as guide.timeline_section.phases so PreMoveTimeline
        // can render either.
        if (!timelineSection && preDepRes.ok) {
          const pd = await preDepRes.json()
          const actions: Array<{ title?: string; weeksBeforeMoveStart?: number; legalConsequenceIfMissed?: string }> = pd.actions ?? []
          if (actions.length > 0) {
            const buckets: Record<string, { name: string; duration: string; tasks: string[]; tips: string[] }> = {
              "12+": { name: "12+ weeks before move", duration: "Lead time", tasks: [], tips: [] },
              "8":   { name: "8–12 weeks before move", duration: "Apostille window", tasks: [], tips: [] },
              "4":   { name: "4–8 weeks before move", duration: "Visa & banking", tasks: [], tips: [] },
              "1":   { name: "1–4 weeks before move", duration: "Final paperwork", tasks: [], tips: [] },
              "0":   { name: "Move week", duration: "Day-1 carry-on", tasks: [], tips: [] },
            }
            for (const a of actions) {
              const w = typeof a.weeksBeforeMoveStart === "number" ? a.weeksBeforeMoveStart : 0
              const k = w >= 12 ? "12+" : w >= 8 ? "8" : w >= 4 ? "4" : w >= 1 ? "1" : "0"
              if (a.title) buckets[k].tasks.push(a.title)
              if (a.legalConsequenceIfMissed) buckets[k].tips.push(`If missed: ${a.legalConsequenceIfMissed}`)
            }
            timelineSection = {
              totalMonths: 6,
              overview: `Embedded from your Pre-departure plan (${actions.length} actions).`,
              phases: Object.values(buckets).filter((b) => b.tasks.length > 0),
            }
          }
        }
        if (active) setInfo({ planId, targetDate, guideId, timelineSection })
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  if (loading) return <Skeleton className="h-64 rounded-2xl" />
  if (!info?.planId) {
    return (
      <div className="gm-card-static p-8 text-center space-y-3">
        <Plane className="w-10 h-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">No plan yet</h3>
        <p className="text-sm text-muted-foreground">Complete your profile to unlock the pre-move timeline.</p>
        <Button asChild><Link href="/onboarding">Start profile</Link></Button>
      </div>
    )
  }
  if (!info.timelineSection) {
    return (
      <div className="gm-card-static p-8 text-center space-y-3">
        <Plane className="w-10 h-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">No pre-move timeline yet</h3>
        <p className="text-sm text-muted-foreground">
          Generate your pre-departure plan or your relocation guide to populate this timeline with your specific actions.
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <Button asChild variant="outline"><Link href="/pre-departure">Open Pre-departure</Link></Button>
          <Button asChild><Link href="/guides">Open Guides</Link></Button>
        </div>
      </div>
    )
  }
  return (
    <PreMoveTimeline
      timelineSection={info.timelineSection}
      planId={info.planId}
      targetDate={info.targetDate}
    />
  )
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
            <PreMoveTab />
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
