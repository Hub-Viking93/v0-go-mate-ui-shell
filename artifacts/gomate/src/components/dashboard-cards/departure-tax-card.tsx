import { ReceiptText } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { DepartureTaxOutput } from "@/lib/gomate/specialist-types"

const CAPITAL_GAINS_LABEL: Record<string, string> = {
  deemed_disposal: "Deemed disposal — taxed on departure",
  defer_until_realised: "Deferred until realised",
  none: "No capital gains trigger",
}

export function DepartureTaxCard({
  data,
  reason,
}: {
  data?: DepartureTaxOutput
  reason?: string
}) {
  const k = data?.domainSpecificData

  return (
    <SpecialistCardShell
      title="Departure / Exit Tax"
      Icon={ReceiptText}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      <div className="flex flex-wrap gap-2">
        {k?.exit_tax_applies != null && (
          <StatusPill
            ok={!k.exit_tax_applies}
            okLabel="Exit tax doesn’t apply"
            badLabel="Exit tax applies"
          />
        )}
        {k?.treaty_with_destination_exists != null && (
          <StatusPill
            ok={k.treaty_with_destination_exists}
            okLabel="Tax treaty in place"
            badLabel="No tax treaty"
          />
        )}
      </div>

      {k?.origin && <FactRow label="Origin tax authority" value={k.origin} />}

      {k?.asset_threshold_eur != null && (
        <FactRow
          label="Asset threshold"
          value={`€${k.asset_threshold_eur.toLocaleString()}`}
        />
      )}

      {k?.residency_years_threshold != null && (
        <FactRow
          label="Residency-years threshold"
          value={`${k.residency_years_threshold} years`}
        />
      )}

      {k?.capital_gains_trigger && (
        <FactRow
          label="Capital gains"
          value={CAPITAL_GAINS_LABEL[k.capital_gains_trigger] ?? k.capital_gains_trigger}
        />
      )}

      {k?.pension_treatment && (
        <div className="text-sm rounded-lg bg-muted/40 p-3">
          <strong>Pension treatment: </strong>
          {k.pension_treatment}
        </div>
      )}

      {(k?.filing_form || k?.filing_deadline_relative_to_departure) && (
        <FactRow
          label={k.filing_form || "Departure filing"}
          value={k.filing_deadline_relative_to_departure || "—"}
        />
      )}

      {k?.professional_advice_recommended && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          ⚠ Professional cross-border tax advice strongly recommended for this corridor.
        </p>
      )}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
