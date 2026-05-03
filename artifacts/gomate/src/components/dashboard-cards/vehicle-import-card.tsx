import { Car } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { VehicleImportOutput } from "@/lib/gomate/specialist-types"

export function VehicleImportCard({
  data,
  reason,
}: {
  data?: VehicleImportOutput
  reason?: string
}) {
  const k = data?.domainSpecificData

  return (
    <SpecialistCardShell
      title="Vehicle Import"
      Icon={Car}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      <div className="flex flex-wrap gap-2">
        {k?.emissions_compliant != null && (
          <StatusPill
            ok={k.emissions_compliant}
            okLabel="Emissions compliant"
            badLabel="Emissions issue"
          />
        )}
        {k?.technical_inspection_required != null && (
          <StatusPill
            ok={!k.technical_inspection_required}
            okLabel="No technical inspection"
            badLabel="Technical inspection required"
          />
        )}
        {k?.conformity_certificate_required != null && (
          <StatusPill
            ok={!k.conformity_certificate_required}
            okLabel="No CoC needed"
            badLabel="CoC required"
          />
        )}
      </div>

      {k?.import_duty_estimate_pct != null && (
        <FactRow label="Import duty (est.)" value={`${k.import_duty_estimate_pct}%`} />
      )}

      {k?.vat_applies != null && (
        <FactRow
          label="VAT"
          value={
            k.vat_applies
              ? k.vat_rate_pct != null
                ? `${k.vat_rate_pct}%`
                : "Applies"
              : "Not applicable"
          }
        />
      )}

      {k?.deadline_after_arrival_days != null && (
        <FactRow
          label="Registration deadline"
          value={`${k.deadline_after_arrival_days} days after arrival`}
        />
      )}

      {(k?.customs_form || k?.registration_authority) && (
        <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1">
          {k?.customs_form && (
            <p>
              <strong>Customs form: </strong>
              {k.customs_form}
            </p>
          )}
          {k?.registration_authority && (
            <p>
              <strong>Registration authority: </strong>
              {k.registration_authority}
            </p>
          )}
        </div>
      )}

      {k?.emissions_notes && (
        <p className="text-xs text-muted-foreground">{k.emissions_notes}</p>
      )}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
