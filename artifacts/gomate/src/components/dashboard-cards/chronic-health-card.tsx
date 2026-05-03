import { Stethoscope, ExternalLink } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { HealthcareOutput } from "@/lib/gomate/specialist-types"

/**
 * Renders the chronic-condition slice of the healthcare specialist's output.
 * The plain healthcare card (always-run) shows registration steps + insurance;
 * this card prioritises prescription continuity, specialist availability,
 * and English-speaking provider recommendations.
 */
export function ChronicHealthCard({
  data,
  reason,
}: {
  data?: HealthcareOutput
  reason?: string
}) {
  const k = data?.domainSpecificData
  const englishProviders =
    k?.recommended_providers?.filter((p) => p.english_speaking) ?? []

  return (
    <SpecialistCardShell
      title="Chronic Health Continuity"
      Icon={Stethoscope}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      {k?.prescription_continuity && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <strong>Prescription continuity</strong>
            <StatusPill
              ok={k.prescription_continuity.applicable}
              okLabel="Available"
              badLabel="Restricted / unavailable"
            />
          </div>
          <p className="text-xs text-amber-900">{k.prescription_continuity.notes}</p>
        </div>
      )}

      {k?.insurance_options && k.insurance_options.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1.5">Insurance coverage options</h4>
          <ul className="space-y-1">
            {k.insurance_options.map((o, i) => (
              <li
                key={i}
                className="text-sm flex items-baseline justify-between gap-3 border-b border-border/40 last:border-b-0 pb-1.5 last:pb-0"
              >
                <div>
                  <span className="font-medium">{o.name}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">({o.type})</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {o.approx_monthly_eur != null
                    ? `~€${o.approx_monthly_eur.toLocaleString()} / mo`
                    : "Cost varies"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {englishProviders.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1.5">English-speaking providers</h4>
          <ul className="space-y-1.5">
            {englishProviders.map((p, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.city}
                  {p.url && (
                    <>
                      {" · "}
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        site <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {k?.registration_steps && k.registration_steps.length > 0 && (
        <FactRow
          label="Registration steps"
          value={`${k.registration_steps.length} steps`}
          hint="full list under View source"
        />
      )}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
