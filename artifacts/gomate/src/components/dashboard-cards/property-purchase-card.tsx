import { Home } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { PropertyPurchaseOutput } from "@/lib/gomate/specialist-types"

const RULES_LABEL: Record<string, string> = {
  free: "Foreigners can buy freely",
  restricted: "Restricted for foreigners",
  permit_required: "Permit required",
}

export function PropertyPurchaseCard({
  data,
  reason,
}: {
  data?: PropertyPurchaseOutput
  reason?: string
}) {
  const k = data?.domainSpecificData

  return (
    <SpecialistCardShell
      title="Property Purchase"
      Icon={Home}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      <div className="flex flex-wrap gap-2">
        {k?.foreigner_purchase_rules && (
          <StatusPill
            ok={k.foreigner_purchase_rules === "free"}
            okLabel={RULES_LABEL.free}
            badLabel={RULES_LABEL[k.foreigner_purchase_rules] ?? "Restricted"}
          />
        )}
        {k?.mortgage_available_to_non_residents != null && (
          <StatusPill
            ok={k.mortgage_available_to_non_residents}
            okLabel="Non-resident mortgages available"
            badLabel="No non-resident mortgage"
          />
        )}
      </div>

      {k?.permit_authority && (
        <FactRow label="Permit authority" value={k.permit_authority} />
      )}

      {k?.max_ltv_pct_non_resident != null && (
        <FactRow
          label="Max LTV (non-resident)"
          value={`${k.max_ltv_pct_non_resident}%`}
        />
      )}

      {k?.transaction_tax_pct_total != null && (
        <FactRow
          label="Transaction taxes (total)"
          value={`${k.transaction_tax_pct_total}%`}
        />
      )}

      {k?.stamp_duty_pct != null && (
        <FactRow label="Stamp duty" value={`${k.stamp_duty_pct}%`} />
      )}

      {k?.transfer_tax_pct != null && (
        <FactRow label="Transfer tax" value={`${k.transfer_tax_pct}%`} />
      )}

      {k?.typical_process_weeks != null && (
        <FactRow
          label="Typical process"
          value={`${k.typical_process_weeks} weeks`}
        />
      )}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
