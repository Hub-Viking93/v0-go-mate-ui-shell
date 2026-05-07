// =============================================================
// Pre-move — operational pre-departure workspace
// =============================================================
// Per sitemap.md: pre-departure checklist + deadlines + urgency +
// task detail view + action links + missing-docs summary.
//
// Renders PreDepartureTimeline directly inside the new PageShell —
// no legacy tab system, no Post-arrival/Documents tabs (those moved
// to /post-move and /documents respectively).
// =============================================================

import { PreDepartureTimeline } from "@/components/pre-departure-timeline";
import { PageShell } from "@/components/layout/page-shell";

export default function PreMovePage() {
  return (
    <PageShell
      title="Pre-move"
      description="Pre-departure checklist with deadlines, urgency, action links and missing-doc summary."
      tint="preMove"
      testId="pre-move-page"
    >
      <PreDepartureTimeline />
    </PageShell>
  );
}
