import { Link } from "wouter"
import { Shield, ListChecks, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface VisaStatusTileProps {
  selectedVisaType?: string | null
  applicationStatus?: string | null
  visaExpiryDate?: string | null
  hasResearch?: boolean
  destination?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  researching: "Researching options",
  preparing: "Preparing application",
  submitted: "Application submitted",
  decision_pending: "Awaiting decision",
  approved: "Approved",
  rejected: "Rejected",
}

export function VisaStatusTile({
  selectedVisaType,
  applicationStatus,
  visaExpiryDate,
  hasResearch,
  destination,
}: VisaStatusTileProps) {
  const statusLabel = applicationStatus
    ? STATUS_LABELS[applicationStatus] ?? applicationStatus
    : selectedVisaType
      ? "Pathway selected"
      : hasResearch
        ? "Pathway not yet selected"
        : "No research yet"

  let urgency: { label: string; tone: "ok" | "warn" | "danger" } | null = null
  if (visaExpiryDate) {
    const days = Math.ceil(
      (new Date(visaExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (days < 0) urgency = { label: "Visa expired", tone: "danger" }
    else if (days <= 90) urgency = { label: `${days} days to expiry`, tone: "warn" }
    else urgency = { label: `${days} days valid`, tone: "ok" }
  }

  return (
    <Link
      href="/visa"
      className="group block gm-card-static p-5 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Visa &amp; Legal</h3>
            <p className="text-xs text-muted-foreground">
              {destination ? `Pathway for ${destination}` : "Your visa workspace"}
            </p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-2" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <span className="font-medium text-foreground">{statusLabel}</span>
        </div>
        {selectedVisaType && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Selected:</span>
            <span className="font-medium text-foreground truncate">{selectedVisaType}</span>
          </div>
        )}
        {urgency && (
          <Badge
            variant="outline"
            className={cn(
              "gap-1",
              urgency.tone === "danger" && "border-red-500/40 text-red-700 dark:text-red-300",
              urgency.tone === "warn" && "border-amber-500/40 text-amber-700 dark:text-amber-300",
              urgency.tone === "ok" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
            )}
          >
            {urgency.tone === "danger" ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {urgency.label}
          </Badge>
        )}
      </div>
    </Link>
  )
}

interface ChecklistStatusTileProps {
  postArrivalCompleted?: number
  postArrivalTotal?: number
  postArrivalOverdue?: number
  documentsReady?: number
  documentsTotal?: number
}

export function ChecklistStatusTile({
  postArrivalCompleted = 0,
  postArrivalTotal = 0,
  postArrivalOverdue = 0,
  documentsReady = 0,
  documentsTotal = 0,
}: ChecklistStatusTileProps) {
  const postPct = postArrivalTotal > 0 ? Math.round((postArrivalCompleted / postArrivalTotal) * 100) : 0
  const docPct = documentsTotal > 0 ? Math.round((documentsReady / documentsTotal) * 100) : 0

  return (
    <Link
      href="/checklist"
      className="group block gm-card-static p-5 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <ListChecks className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Checklist</h3>
            <p className="text-xs text-muted-foreground">Before, during and after your move</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-2" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Documents</p>
          <p className="text-lg font-semibold font-mono text-foreground">{docPct}%</p>
          <p className="text-[10px] text-muted-foreground">{documentsReady}/{documentsTotal} ready</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Settling</p>
          <p className="text-lg font-semibold font-mono text-foreground">{postPct}%</p>
          <p className="text-[10px] text-muted-foreground">
            {postArrivalCompleted}/{postArrivalTotal} done
            {postArrivalOverdue > 0 && (
              <span className="text-red-600 dark:text-red-400"> · {postArrivalOverdue} late</span>
            )}
          </p>
        </div>
      </div>
    </Link>
  )
}
