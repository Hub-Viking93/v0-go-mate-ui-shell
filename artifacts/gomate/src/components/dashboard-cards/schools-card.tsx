import { GraduationCap } from "lucide-react"
import { SpecialistCardShell, FactRow, WarningsList } from "./specialist-card-shell"
import type { SchoolsOutput } from "@/lib/gomate/specialist-types"

export function SchoolsCard({
  data,
  reason,
}: {
  data?: SchoolsOutput
  reason?: string
}) {
  const k = data?.domainSpecificData
  return (
    <SpecialistCardShell
      title="Schools & Childcare"
      Icon={GraduationCap}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      {k?.system_overview && (
        <p className="text-sm rounded-lg bg-muted/40 p-3">
          <strong>System: </strong>
          {k.system_overview}
        </p>
      )}

      {k?.average_intl_school_fee_range_eur && (
        <FactRow
          label="Average international school fee"
          value={`€${k.average_intl_school_fee_range_eur.low.toLocaleString()} – €${k.average_intl_school_fee_range_eur.high.toLocaleString()} / yr`}
        />
      )}

      {k?.children_recommendations?.map((child, ci) => (
        <div key={ci} className="rounded-lg border border-border/60 p-3">
          <h4 className="text-sm font-semibold mb-2">{child.child_label}</h4>
          <ul className="space-y-2">
            {child.schools.map((s, si) => (
              <li
                key={si}
                className="text-sm flex items-start justify-between gap-3 border-b border-border/40 last:border-b-0 pb-2 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.type} · {s.language}
                    {s.application_lead_months != null &&
                      ` · apply ${s.application_lead_months}mo ahead`}
                    {s.waitlist_likely && " · waitlist likely"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  {s.approx_fee_eur_year != null
                    ? `€${s.approx_fee_eur_year.toLocaleString()}/yr`
                    : "Fee n/a"}
                  {s.url && (
                    <div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        site
                      </a>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
