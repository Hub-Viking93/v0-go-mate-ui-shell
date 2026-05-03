import { Briefcase, ExternalLink } from "lucide-react"
import { SpecialistCardShell, FactRow, StatusPill, WarningsList } from "./specialist-card-shell"
import type { PostedWorkerOutput } from "@/lib/gomate/specialist-types"

const FRAMEWORK_LABEL: Record<string, string> = {
  EU_A1: "EU A1 framework",
  bilateral_CoC: "Bilateral CoC",
  unclear: "Framework unclear",
}

/**
 * Posted-worker compliance is the most legally critical card — surfaced with
 * prominent step-by-step status indicators per the spec.
 */
export function PostedWorkerCard({
  data,
  reason,
}: {
  data?: PostedWorkerOutput
  reason?: string
}) {
  const k = data?.domainSpecificData

  return (
    <SpecialistCardShell
      title="Posted-Worker Compliance"
      Icon={Briefcase}
      reason={reason}
      quality={data?.quality}
      retrievedAt={data?.retrievedAt}
      contentParagraphs={data?.contentParagraphs}
      citations={data?.citations}
      fallbackReason={data?.fallbackReason}
    >
      {k?.framework && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <strong>{FRAMEWORK_LABEL[k.framework] ?? k.framework}</strong>
        </div>
      )}

      {k?.a1_or_coc_path && (
        <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1.5">
          <h4 className="font-semibold">
            {k.framework === "bilateral_CoC" ? "Certificate of Coverage (CoC)" : "A1 certificate"}
          </h4>
          <p>
            <strong>Issued by: </strong>
            {k.a1_or_coc_path.issued_by}
          </p>
          <p>
            <strong>Applied by: </strong>
            {k.a1_or_coc_path.applied_by}
          </p>
          {k.a1_or_coc_path.lead_weeks != null && (
            <p>
              <strong>Lead time: </strong>~{k.a1_or_coc_path.lead_weeks} weeks
            </p>
          )}
          {k.a1_or_coc_path.max_validity_months != null && (
            <p>
              <strong>Max validity: </strong>
              {k.a1_or_coc_path.max_validity_months} months
            </p>
          )}
          {k.a1_or_coc_path.url && (
            <a
              href={k.a1_or_coc_path.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
            >
              Apply on origin SS portal <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {k?.pwd_filing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-1.5">
          <h4 className="font-semibold">Posted Worker Declaration (PWD)</h4>
          <p>
            <strong>Authority: </strong>
            {k.pwd_filing.destination_authority}
          </p>
          <p>
            <strong>Deadline: </strong>
            {k.pwd_filing.deadline_relative_to_start}
          </p>
          {k.pwd_filing.url && (
            <a
              href={k.pwd_filing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
            >
              File on destination portal <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {k?.employer_registration_required != null && (
          <StatusPill
            ok={!k.employer_registration_required}
            okLabel="No employer registration"
            badLabel="Employer must register"
          />
        )}
        {k?.contact_person_requirement?.required != null && (
          <StatusPill
            ok={!k.contact_person_requirement.required}
            okLabel="No contact person"
            badLabel={
              k.contact_person_requirement.must_be_resident
                ? "Resident contact person required"
                : "Contact person required"
            }
          />
        )}
      </div>

      {k?.social_security_rules && (
        <FactRow
          label="Social-security continuity"
          value={
            k.social_security_rules.duration_cap_months != null
              ? `${k.social_security_rules.duration_cap_months} months${
                  k.social_security_rules.extension_possible ? " · extendable" : ""
                }`
              : "—"
          }
        />
      )}

      <WarningsList warnings={k?.warnings} />
    </SpecialistCardShell>
  )
}
