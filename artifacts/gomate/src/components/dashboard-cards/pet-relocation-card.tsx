import { PawPrint } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { PetOutput } from "@/lib/gomate/specialist-types"

function totalLeadDays(timeline?: PetOutput["domainSpecificData"]["vaccination_timeline"]) {
  if (!timeline || timeline.length === 0) return null
  return timeline.reduce((max, step) => Math.max(max, step.lead_days), 0)
}

export function PetRelocationCard({
  data,
  reason,
}: {
  data?: PetOutput
  reason?: string
}) {
  const k = data?.domainSpecificData
  const lead = totalLeadDays(k?.vaccination_timeline)

  return (
    <SpecialistCardShell
      title="Pet Relocation"
      Icon={PawPrint}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      {lead != null && (
        <FactRow
          label="Earliest travel readiness"
          value={`${lead} days from today`}
          hint="based on vaccination timeline"
        />
      )}

      {k?.breed_restrictions && (
        <div className="text-sm">
          <StatusPill
            ok={!k.breed_restrictions.applies_to_user_pet}
            okLabel="No breed restriction for this pet"
            badLabel="This breed is restricted"
          />
          {k.breed_restrictions.restricted_breeds.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Restricted: {k.breed_restrictions.restricted_breeds.join(", ")}
            </p>
          )}
        </div>
      )}

      {k?.import_requirements && k.import_requirements.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1.5">Import requirements</h4>
          <ul className="text-sm text-foreground/90 space-y-1">
            {k.import_requirements.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      {k?.vaccination_timeline && k.vaccination_timeline.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1.5">Vaccination timeline</h4>
          <ul className="space-y-1.5">
            {k.vaccination_timeline.map((step, i) => (
              <li
                key={i}
                className="text-sm flex items-baseline justify-between gap-3 border-b border-border/40 last:border-b-0 pb-1.5 last:pb-0"
              >
                <div>
                  <p className="font-medium">{step.step}</p>
                  <p className="text-xs text-muted-foreground">{step.notes}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  ≥ {step.lead_days} days lead
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {k?.import_permit && (
        <div className="rounded-lg border border-border/60 p-3 text-sm">
          <h4 className="font-semibold mb-1">Import permit</h4>
          <p>
            {k.import_permit.required ? "Required" : "Not required"} ·{" "}
            {k.import_permit.authority || "Authority TBD"}
            {k.import_permit.lead_days != null && ` · ${k.import_permit.lead_days}d lead`}
          </p>
          {k.import_permit.url && (
            <a
              href={k.import_permit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-xs"
            >
              Apply on official portal →
            </a>
          )}
        </div>
      )}

      {k?.quarantine_rules && (
        <FactRow
          label="Quarantine"
          value={
            k.quarantine_rules.required
              ? `${k.quarantine_rules.duration_days ?? "?"} days`
              : "Not required"
          }
          hint={k.quarantine_rules.notes}
        />
      )}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
