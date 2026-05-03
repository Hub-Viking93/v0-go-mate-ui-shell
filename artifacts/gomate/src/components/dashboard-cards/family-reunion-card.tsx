import { Users } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { FamilyReunionOutput } from "@/lib/gomate/specialist-types"

export function FamilyReunionCard({
  data,
  reason,
}: {
  data?: FamilyReunionOutput
  reason?: string
}) {
  const k = data?.domainSpecificData

  return (
    <SpecialistCardShell
      title="Family Reunion"
      Icon={Users}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      {k?.route_name && <FactRow label="Route" value={k.route_name} />}

      {k?.sponsor_income_threshold_eur_month != null && (
        <FactRow
          label="Sponsor income required"
          value={`€${k.sponsor_income_threshold_eur_month.toLocaleString()} / mo`}
        />
      )}

      {k?.processing_weeks != null && (
        <FactRow label="Processing time" value={`~${k.processing_weeks} weeks`} />
      )}

      {k?.independence_after_years != null && (
        <FactRow
          label="Independent residency after"
          value={`${k.independence_after_years} years`}
          hint="dependent rights derive from sponsor until then"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {k?.accommodation_required != null && (
          <StatusPill
            ok={!k.accommodation_required}
            okLabel="No accommodation proof"
            badLabel="Accommodation proof required"
          />
        )}
        {k?.marriage_certificate_required != null && (
          <StatusPill
            ok={!k.marriage_certificate_required}
            okLabel="No marriage cert"
            badLabel="Marriage certificate required"
          />
        )}
        {k?.fiance_route_available != null && (
          <StatusPill
            ok={k.fiance_route_available}
            okLabel="Fiancé route available"
            badLabel="No fiancé route"
          />
        )}
        {k?.integration_test_required != null && (
          <StatusPill
            ok={!k.integration_test_required}
            okLabel="No integration test"
            badLabel="Integration test required"
          />
        )}
        {k?.dependent_can_work != null && (
          <StatusPill
            ok={k.dependent_can_work}
            okLabel="Dependent can work"
            badLabel="Dependent cannot work"
          />
        )}
      </div>

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
