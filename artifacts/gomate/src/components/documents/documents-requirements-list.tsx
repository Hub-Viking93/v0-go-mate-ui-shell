// =============================================================
// DocumentsRequirementsList — schema-driven "what you need"
// =============================================================
// Lifted from the retired Checklist → Documents tab. Pulls the
// detailed documents requirements from /api/documents (separate from
// the vault file storage) and renders them grouped by domain.
//
// Lives on /documents alongside the vault: vault = files you have,
// requirements = what you still need to gather.
// =============================================================

import { useEffect, useState } from "react";
import { FileCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DomainGroupedDocumentsChecklist,
  type DetailedDocument,
} from "@/components/domain-grouped-documents";

export function DocumentsRequirementsList() {
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DetailedDocument[]>([]);
  const [statuses, setStatuses] = useState<Record<string, unknown>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/documents");
        if (!active) return;
        if (!res.ok) {
          setError("Could not load documents.");
          return;
        }
        const data = await res.json();
        setPlanId(data.planId ?? null);
        setStatuses(data.statuses ?? {});
        setWarnings(Array.isArray(data.documentWarnings) ? data.documentWarnings : []);
        const detailed = Array.isArray(data.documentsDetailed) ? data.documentsDetailed : [];
        setDocuments(
          detailed
            .map((d: Record<string, unknown>) => ({
              id: String(d.id ?? ""),
              name: String(d.name ?? ""),
              domain: (d.domain as DetailedDocument["domain"]) ?? "personal",
              phase: (d.phase as DetailedDocument["phase"]) ?? "before_move",
              whyNeeded: String(d.whyNeeded ?? ""),
              whereToObtain: String(d.whereToObtain ?? ""),
              needsApostille: d.needsApostille === true,
              needsTranslation: d.needsTranslation === true,
              submissionDestination: String(d.submissionDestination ?? ""),
              leadTimeDays: typeof d.leadTimeDays === "number" ? d.leadTimeDays : null,
              issuingAuthority: String(d.issuingAuthority ?? ""),
              appliesWhen: String(d.appliesWhen ?? ""),
            }))
            .filter((d: DetailedDocument) => d.id && d.name),
        );
      } catch {
        if (active) setError("Could not load documents.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Skeleton className="h-64 rounded-md" />;
  if (error) {
    return (
      <div
        className="bg-card px-4 py-6 text-center space-y-2"
        style={{ border: "1px solid #DCE7DF", borderRadius: "6px" }}
      >
        <FileCheck className="w-8 h-8 text-[#7E9088] mx-auto" />
        <h3 className="text-sm font-semibold text-[#1F2A24]">{error}</h3>
        <p className="text-xs text-[#7E9088]">Try refreshing the page.</p>
      </div>
    );
  }

  return (
    <DomainGroupedDocumentsChecklist
      planId={planId}
      documents={documents}
      initialStatuses={statuses}
      warnings={warnings}
    />
  );
}
