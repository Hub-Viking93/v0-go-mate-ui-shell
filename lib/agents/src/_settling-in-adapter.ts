// =============================================================
// @workspace/agents — researched → settling-in adapter (Phase C1a)
// =============================================================
// Maps a ResearchedSteps payload (output of registrationSpecialist or
// bankingSpecialistV2 — both follow ./specialists/_contracts.ts) into
// the legacy SettlingTask[] shape consumed by /post-move's checklist
// tab.
//
// Why an adapter, not a rewrite:
//   - The settling-in UI (artifacts/gomate/src/pages/settling-in/index.tsx)
//     is built around SettlingTask. Reshaping that surface is out of
//     scope for C1.
//   - The deterministic DAG keeps owning housing / healthcare /
//     employment / transport / family / tax for now. Those tasks must
//     coexist with researched ones in a single sorted list.
//   - The adapter is the boundary: any future researched specialist
//     for those other domains plugs in by routing through this same
//     mapping function — no UI change required.
//
// What's NOT preserved across the migration
// -----------------------------------------
// taskKey identity DOES NOT carry over for migrated domains. The
// legacy DAG used short keys like "reg-population" and "bank-open-account";
// the researched output uses domain-prefixed step ids
// ("registration:population-register", "banking:open-local-account").
// Historic completions on legacy keys for those two domains will not
// auto-link to the new researched-derived tasks. The trade-off is
// deliberate — a fuzzy id-bridge would force us to maintain a hand-
// authored alias table forever, and the alternative (re-using legacy
// keys verbatim) would lose the namespace + cross-specialist dedup
// guarantees the contract was specifically locked to provide.
//
// Cross-domain dependencies pointing at legacy registration ids (e.g.
// bankingTasks's "dependsOn: ['reg-population']") become dangling
// after researched registration replaces those tasks. topoSortWithCriticalPath
// already drops dangling deps, so the only behavioural change is that
// such gates relax — the dependent task may surface as "available"
// earlier than it would have. C1c can rewire deterministically when
// we add a one-time legacy-id alias map; for C1a this is documented +
// accepted.
// =============================================================

import type {
  ResearchedSource,
  ResearchedStep,
  ResearchedSteps,
} from "./specialists/_contracts.js";
import type { TaskWalkthrough, WalkthroughStep } from "./walkthrough.js";
import type { SettlingDomain, SettlingTask } from "./settling-in.js";

// ---- Domain whitelisting ---------------------------------------------
//
// Only domains that map cleanly to a SettlingDomain are accepted. The
// caller filters its researchedByDomain map before passing it in; this
// is a runtime safety net.

const RESEARCHED_DOMAIN_TO_SETTLING: Partial<
  Record<string, SettlingDomain>
> = {
  registration: "registration",
  banking: "banking",
  // Future: housing, healthcare. Not enabled here in C1.
};

// ---- Phase filter ----------------------------------------------------
//
// Pre-departure consumes phase ∈ {before_move, move_day}. Settling-in
// consumes everything that's post-arrival. Steps with mismatched phase
// are dropped silently — they belong to the other surface.

const POST_ARRIVAL_PHASES: ReadonlySet<string> = new Set([
  "first_72h",
  "first_30d",
  "first_90d",
  "first_year_end",
  "ongoing",
]);

// ---- Phase → default deadlineDays ------------------------------------
//
// When the LLM didn't emit a concrete daysAfterArrival, fall back on a
// phase-anchored default. legalDeadlineDays takes precedence per the
// contract (see _contracts.ts:DeadlineWindow precedence note).

function defaultDeadlineDays(phase: string): number {
  switch (phase) {
    case "first_72h":
      return 3;
    case "first_30d":
      return 30;
    case "first_90d":
      return 90;
    case "first_year_end":
      return 365;
    case "ongoing":
      return 365;
    default:
      return 30;
  }
}

// ---- Source resolution -----------------------------------------------

function resolveOfficialLink(
  step: ResearchedStep,
  bundleSources: ResearchedSource[],
): string | null {
  if (step.sources.length > 0) return step.sources[0];
  if (bundleSources.length > 0) return bundleSources[0].url;
  return null;
}

// ---- Walkthrough projection ------------------------------------------
//
// ResearchedStep emits a flat string[] walkthrough. SettlingTask wants
// the richer TaskWalkthrough shape. We project conservatively: bullets
// turn into WalkthroughStep[]; bottleneck (when present) becomes the
// only commonMistakes entry; the canonical step description doubles as
// whatThisIs so the detail sheet is non-empty.

function projectWalkthrough(
  step: ResearchedStep,
  officialLink: string | null,
): TaskWalkthrough | undefined {
  const steps: WalkthroughStep[] = Array.isArray(step.walkthrough)
    ? step.walkthrough.slice(0, 8).map((line): WalkthroughStep => ({ text: line }))
    : [];
  const hasAnyContent = steps.length > 0 || !!step.bottleneck;
  if (!hasAnyContent) return undefined;
  const w: TaskWalkthrough = {
    whatThisIs: step.description,
    ...(steps.length > 0 ? { steps } : {}),
    ...(step.bottleneck ? { commonMistakes: [step.bottleneck] } : {}),
  };
  if (officialLink) {
    w.links = [
      {
        url: officialLink,
        label: "Official source",
        linkType: "official_info",
        primary: true,
      },
    ];
  }
  return w;
}

// ---- Document-id → human label resolver ------------------------------
//
// Steps reference documents by id (e.g. "registration:proof-of-address").
// The bundle's documents[] gives the human label. We resolve via
// exact-id match; missing ids fall back to the raw id (the UI has a
// "missing-doc" surface that already handles unknown ids).

function resolveDocumentLabels(
  documentIds: string[],
  bundle: ResearchedSteps,
): string[] {
  const byId = new Map<string, string>();
  for (const d of bundle.documents) byId.set(d.id, d.label);
  return documentIds.map((id) => byId.get(id) ?? id);
}

// ---- Agent-name labelling --------------------------------------------
//
// The legacy DAG used "settling_in_registration", "settling_in_banking"
// for the agentWhoAddedIt field. With researched output the producer
// is the actual specialist; surface that so the UI can later badge
// "researched" vs "deterministic" if it wants.

function agentNameForResearchedDomain(domain: SettlingDomain): string {
  switch (domain) {
    case "registration":
      return "registration_specialist";
    case "banking":
      return "banking_helper";
    default:
      return `settling_in_${domain}`;
  }
}

// ---- Main mapping fn -------------------------------------------------

/**
 * Convert one specialist's ResearchedSteps payload into SettlingTask[].
 * Returns an empty array when the bundle's domain isn't registration
 * or banking, or when no post-arrival steps survived the phase filter.
 *
 * Caller responsibilities:
 *   - Provide a fully-validated ResearchedSteps payload (the
 *     specialist already runs through the contract validator). The
 *     adapter trusts shapes; it does no second validation pass.
 *   - Decide whether to use this output at all based on bundle.quality
 *     (for fallback-only payloads, the composer drops back to the
 *     deterministic DAG — see composeSettlingInTimeline).
 */
export function mapResearchedToSettlingTasks(
  bundle: ResearchedSteps,
): SettlingTask[] {
  const settlingDomain = RESEARCHED_DOMAIN_TO_SETTLING[bundle.domain];
  if (!settlingDomain) return [];

  const out: SettlingTask[] = [];
  const agentName = agentNameForResearchedDomain(settlingDomain);

  for (const step of bundle.steps) {
    if (!POST_ARRIVAL_PHASES.has(step.deadlineWindow.phase)) continue;
    const officialLink = resolveOfficialLink(step, bundle.sources);
    const explicitDays =
      step.deadlineWindow.legalDeadlineDays ?? step.deadlineWindow.daysAfterArrival;
    const deadlineDays =
      typeof explicitDays === "number"
        ? Math.max(0, explicitDays)
        : defaultDeadlineDays(step.deadlineWindow.phase);
    const walkthrough = projectWalkthrough(step, officialLink);
    out.push({
      // Step ids are already domain-prefixed and unique; reuse them
      // directly so cross-specialist prerequisites resolve naturally
      // through topoSortWithCriticalPath.
      taskKey: step.id,
      title: step.title,
      description: step.description,
      category: settlingDomain,
      dependsOn: Array.isArray(step.prerequisites) ? [...step.prerequisites] : [],
      deadlineDays,
      isLegalRequirement: typeof step.deadlineWindow.legalDeadlineDays === "number",
      steps: Array.isArray(step.walkthrough) ? step.walkthrough.slice(0, 8) : [],
      documentsNeeded: resolveDocumentLabels(step.documentIds ?? [], bundle),
      officialLink,
      estimatedTime: "Varies — see walkthrough",
      cost: "Varies",
      agentWhoAddedIt: agentName,
      status: "available",
      sortOrder: 0,
      ...(walkthrough ? { walkthrough } : {}),
    });
  }

  return out;
}
