import { HeartHandshake, ExternalLink } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { TrailingSpouseOutput } from "@/lib/gomate/specialist-types"

const DEMAND_LABEL: Record<string, { label: string; ok: boolean }> = {
  high: { label: "High demand for this field", ok: true },
  moderate: { label: "Moderate demand", ok: true },
  low: { label: "Low demand — niche field", ok: false },
}

export function TrailingSpouseCard({
  data,
  reason,
}: {
  data?: TrailingSpouseOutput
  reason?: string
}) {
  const k = data?.domainSpecificData

  return (
    <SpecialistCardShell
      title="Trailing-Spouse Career"
      Icon={HeartHandshake}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      <div className="flex flex-wrap gap-2">
        {k?.field_demand_assessment && DEMAND_LABEL[k.field_demand_assessment] && (
          <StatusPill
            ok={DEMAND_LABEL[k.field_demand_assessment].ok}
            okLabel={DEMAND_LABEL[k.field_demand_assessment].label}
            badLabel={DEMAND_LABEL[k.field_demand_assessment].label}
          />
        )}
        {k?.dependent_can_work != null && (
          <StatusPill
            ok={k.dependent_can_work}
            okLabel="Dependent can work"
            badLabel="Dependent cannot work yet"
          />
        )}
        {k?.separate_work_permit_required != null && (
          <StatusPill
            ok={!k.separate_work_permit_required}
            okLabel="No separate work permit"
            badLabel="Separate work permit required"
          />
        )}
      </div>

      {k?.language_requirement_for_field && (
        <FactRow
          label="Language requirement"
          value={k.language_requirement_for_field}
        />
      )}

      {k?.credential_recognition_needed != null && (
        <FactRow
          label="Credential recognition"
          value={
            k.credential_recognition_needed
              ? `Required${k.credential_recognition_authority ? ` · ${k.credential_recognition_authority}` : ""}`
              : "Not required"
          }
        />
      )}

      {k?.top_job_platforms && k.top_job_platforms.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1.5">Top job platforms</h4>
          <ul className="space-y-1">
            {k.top_job_platforms.map((p, i) => (
              <li key={i} className="text-sm">
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {p.name} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  p.name
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {k?.professional_associations && k.professional_associations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1.5">Professional associations</h4>
          <ul className="space-y-1">
            {k.professional_associations.map((a, i) => (
              <li key={i} className="text-sm">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {a.name} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  a.name
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
