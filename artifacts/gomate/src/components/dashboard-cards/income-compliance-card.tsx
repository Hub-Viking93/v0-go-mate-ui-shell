import { Wallet } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { IncomeComplianceOutput } from "@/lib/gomate/specialist-types"

export function IncomeComplianceCard({
  data,
  reason,
}: {
  data?: IncomeComplianceOutput
  reason?: string
}) {
  const k = data?.domainSpecificData

  return (
    <SpecialistCardShell
      title="Income & Compliance"
      Icon={Wallet}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      {k?.income_qualifies != null && (
        <StatusPill
          ok={k.income_qualifies}
          okLabel="Your income qualifies"
          badLabel="Income below threshold"
        />
      )}

      {(k?.visa_name || k?.issuing_authority) && (
        <FactRow
          label="Visa"
          value={`${k?.visa_name ?? "—"}${k?.issuing_authority ? ` · ${k.issuing_authority}` : ""}`}
        />
      )}

      {k?.income_threshold_eur_month != null && (
        <FactRow
          label="Required monthly income"
          value={`€${k.income_threshold_eur_month.toLocaleString()} / mo`}
        />
      )}

      {k?.user_income_eur_month != null && (
        <FactRow
          label="Your monthly income"
          value={`€${k.user_income_eur_month.toLocaleString()} / mo`}
        />
      )}

      {k?.visa_validity_months != null && (
        <FactRow
          label="Validity"
          value={`${k.visa_validity_months} months${k.renewal_possible ? " · renewable" : ""}`}
        />
      )}

      {k?.tax_residency_implications && (
        <div className="text-sm rounded-lg bg-muted/40 p-3">
          <strong>Tax residency: </strong>
          {k.tax_residency_implications}
        </div>
      )}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
