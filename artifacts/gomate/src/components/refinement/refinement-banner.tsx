// =============================================================
// RefinementBanner — compact prompt for post-research profile
// completion. Pairs with RefinementSheet for the actual form.
// =============================================================
//
// Renders nothing when no refinements apply. When at least one
// applies, renders a small gm-surface banner with eyebrow + title +
// count + CTA. Click → opens the sheet.

import { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApplicableRefinements, type RefinementArea } from "@/lib/gomate/refinements";
import type { Profile } from "@/lib/gomate/profile-schema";
import { RefinementSheet } from "./refinement-sheet";

interface Props {
  profile: Profile;
  planId: string | null;
  planVersion: number | null;
  /** Restrict to one area (e.g. "dashboard"). Omit to show every applicable. */
  area?: RefinementArea;
  /** Called after a successful profile patch so the parent re-fetches. */
  onCompleted?: () => void;
}

export function RefinementBanner({ profile, planId, planVersion, area, onCompleted }: Props) {
  const [open, setOpen] = useState(false);
  const applicable = useMemo(
    () => getApplicableRefinements(profile, area),
    [profile, area],
  );

  if (applicable.length === 0) return null;

  const count = applicable.length;
  const label =
    count === 1 ? "1 follow-up question" : `${count} follow-up questions`;

  return (
    <>
      <div
        className="gm-surface px-4 py-3 mb-5 flex items-center gap-3"
        style={{ borderLeft: "3px solid #1B7A40" }}
        data-testid="refinement-banner"
      >
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0"
          style={{ background: "#E0F0E5", color: "#15663A" }}
        >
          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#7E9088]">
            Follow-up
          </div>
          <div className="text-[13.5px] font-semibold text-[#1F2A24] leading-snug">
            Sharpen your plan
          </div>
          <div className="text-[11.5px] text-[#7E9088] leading-relaxed">
            {label} · improve document, immigration and budget guidance.
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5 rounded-md h-8 px-3 bg-[#1B7A40] text-white hover:bg-[#15663A] shadow-sm"
          data-testid="refinement-banner-open"
        >
          Add details
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      <RefinementSheet
        open={open}
        onOpenChange={setOpen}
        prompts={applicable}
        planId={planId}
        planVersion={planVersion}
        onCompleted={onCompleted}
      />
    </>
  );
}
