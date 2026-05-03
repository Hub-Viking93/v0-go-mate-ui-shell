import { useEffect, useState } from "react"
import VisaTrackerPage from "@/pages/visa-tracker"
import { History } from "lucide-react"

interface ApplicationHistoryEntry {
  at: string
  field: string
  from: string | null
  to: string | null
}

function ApplicationHistory() {
  const [entries, setEntries] = useState<ApplicationHistoryEntry[] | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/visa-tracker")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.visaApplication) return
        const app = data.visaApplication as Record<string, string | null>
        const log: ApplicationHistoryEntry[] = []
        if (app.submittedAt) log.push({ at: app.submittedAt, field: "Application submitted", from: null, to: app.applicationStatus ?? "submitted" })
        if (app.approvedAt) log.push({ at: app.approvedAt, field: "Application approved", from: "submitted", to: "approved" })
        if (app.visaStartDate) log.push({ at: app.visaStartDate, field: "Visa valid from", from: null, to: app.visaStartDate })
        if (app.visaExpiryDate) log.push({ at: app.visaExpiryDate, field: "Visa expires", from: null, to: app.visaExpiryDate })
        log.sort((a, b) => a.at.localeCompare(b.at))
        setEntries(log)
      })
      .catch(() => setEntries([]))
    return () => { active = false }
  }, [])

  if (!entries || entries.length === 0) return null
  return (
    <section className="max-w-3xl mx-auto px-6 pb-12">
      <div className="gm-card-static p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Application history</h3>
        </div>
        <ol className="relative border-l border-border ml-2 space-y-3">
          {entries.map((e, i) => (
            <li key={i} className="ml-4">
              <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary" />
              <p className="text-xs font-mono text-muted-foreground">{e.at.slice(0, 10)}</p>
              <p className="text-sm text-foreground">{e.field}{e.to ? ` — ${e.to}` : ""}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default function VisaWorkspacePage() {
  return (
    <>
      <VisaTrackerPage />
      <ApplicationHistory />
    </>
  )
}
