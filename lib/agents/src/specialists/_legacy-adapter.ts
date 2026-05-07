// =============================================================
// @workspace/agents — legacy → researched adapter
// =============================================================
// Phase A1 boundary: legacy specialists (visa / documents /
// housing / banking + others on the old SpecialistOutput contract)
// are NOT being migrated. Instead this module reads the persisted
// shapes those specialists already write to relocation_plans and
// normalises them into the new ResearchedSteps contract so the
// pre-departure composer can consume a single uniform input shape.
//
// What's adapted today:
//   - plan.visa_research (PersistedVisaResearch) → ResearchedSteps {domain: "visa"}
//   - plan.local_requirements_research (PersistedRequirementCategory[])
//     → one ResearchedSteps per relevant category (Documents,
//       Housing, Banking, Healthcare).
//
// What is NOT adapted (and shouldn't be):
//   - Steps belonging to phases other than `before_move` /
//     `move_day` — these are post-arrival concerns; the new
//     post-arrival specialists (Phase B) cover them.
//   - Domain-specific facts that don't map cleanly to a step
//     (rental price bands, FX rates, etc.). Those stay in their
//     legacy persistence and the composer ignores them.
//
// Adapter is best-effort. Quality is "full" when the persisted
// data was actually produced by a successful specialist run;
// "fallback" when the input is empty or undefined; never throws.
// =============================================================

import type {
  ResearchedSource,
  ResearchedStep,
  ResearchedSteps,
  SpecialistDomain,
} from "./_contracts.js";

// ---- Persisted shapes (read-only mirrors of the columns) --------------
//
// We re-declare the parts we need rather than import from
// research-persistence (which lives in the api-server workspace) —
// this module sits in @workspace/agents and shouldn't reach across
// the workspace boundary.

interface PersistedVisaOption {
  name?: string | null;
  type?: string | null;
  officialLink?: string | null;
  sourceUrls?: string[] | null;
  applicationSteps?: string[] | null;
  requirements?: string[] | null;
  recommended?: boolean | null;
  processingTime?: string | null;
}

interface PersistedVisaResearch {
  destination?: string | null;
  citizenship?: string | null;
  purpose?: string | null;
  researchedAt?: string | null;
  visaOptions?: PersistedVisaOption[] | null;
  summary?: string | null;
}

interface PersistedRequirementItem {
  title?: string | null;
  description?: string | null;
  steps?: string[] | null;
  documents?: string[] | null;
  estimatedTime?: string | null;
  cost?: string | null;
  officialLink?: string | null;
  tips?: string[] | null;
}

interface PersistedRequirementCategory {
  category?: string | null;
  icon?: string | null;
  items?: PersistedRequirementItem[] | null;
}

interface PersistedLocalRequirements {
  destination?: string | null;
  researchedAt?: string | null;
  categories?: PersistedRequirementCategory[] | null;
  summary?: string | null;
}

// ---- Helpers ---------------------------------------------------------

function safeArray<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
}

function inferHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function urlsToSources(urls: string[]): ResearchedSource[] {
  const seen = new Set<string>();
  const out: ResearchedSource[] = [];
  for (const url of urls) {
    if (!url || typeof url !== "string") continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      domain: inferHost(url),
      retrievedAt: new Date().toISOString(),
      // Best-effort: legacy persisted URLs carry no kind. Default
      // to "authority" since the underlying specialists are
      // configured to scrape official sources.
      kind: "authority",
    });
  }
  return out;
}

// ---- Visa adapter ----------------------------------------------------

/**
 * Adapt the persisted visa_research column into a ResearchedSteps
 * payload. Picks the recommended visa option (or the first one)
 * and turns its applicationSteps[] into individual ResearchedSteps
 * tagged with phase="before_move".
 *
 * Returns a fallback-quality output when visa_research is empty or
 * has no usable visa option.
 */
export function adaptVisaResearchToSteps(
  visaResearch: PersistedVisaResearch | null | undefined,
): ResearchedSteps {
  const retrievedAt =
    typeof visaResearch?.researchedAt === "string" ? visaResearch.researchedAt : new Date().toISOString();
  const options = safeArray(visaResearch?.visaOptions);
  const chosen =
    options.find((o) => o?.recommended === true) ?? options[0] ?? null;

  if (!chosen) {
    return {
      kind: "steps",
      domain: "visa" as SpecialistDomain,
      retrievedAt,
      quality: "fallback",
      fallbackReason: "no_sources_found",
      sources: [],
      summary:
        typeof visaResearch?.summary === "string" && visaResearch.summary.trim().length > 0
          ? visaResearch.summary.trim()
          : "Visa research not available — pre-departure timeline falls back to generic visa actions.",
      steps: [],
      documents: [],
    };
  }

  const sourceUrls = [
    ...safeArray(chosen.sourceUrls),
    ...(chosen.officialLink ? [chosen.officialLink] : []),
  ];
  const sources = urlsToSources(sourceUrls);
  const allowedUrls = new Set(sources.map((s) => s.url));

  const steps: ResearchedStep[] = safeArray(chosen.applicationSteps)
    .map((line, idx): ResearchedStep | null => {
      if (typeof line !== "string" || line.trim().length === 0) return null;
      // Some specialists pack a label + paragraph into one entry
      // ("**Timeline and process**: Axel should apply…"). Strip
      // markdown emphasis + trim. Keep the full sentence as the
      // step title — the composer crops as needed.
      const cleaned = line.replace(/^\*+|\*+$/g, "").trim();
      const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
      const title =
        firstSentence.length > 90 ? `${firstSentence.slice(0, 87)}…` : firstSentence;
      return {
        id: `visa:step-${idx + 1}-${slugify(title)}`,
        title,
        description: cleaned,
        deadlineWindow: { phase: "before_move" },
        appliesWhen: { always: true },
        prerequisites: [],
        documentIds: [],
        sources: allowedUrls.size > 0 ? [Array.from(allowedUrls)[0]!] : [],
      };
    })
    .filter((x): x is ResearchedStep => x !== null);

  const summary =
    typeof visaResearch?.summary === "string" && visaResearch.summary.trim().length > 0
      ? visaResearch.summary.trim()
      : `${chosen.name ?? "Visa"} pathway: ${steps.length} application step${steps.length === 1 ? "" : "s"}.`;

  return {
    kind: "steps",
    domain: "visa",
    retrievedAt,
    quality: steps.length > 0 ? "full" : "partial",
    sources,
    summary,
    steps,
    documents: [],
  };
}

// ---- Local-requirements adapter --------------------------------------
//
// local_requirements_research.categories[] aggregates the documents /
// housing / banking / healthcare specialists into one column. We pull
// each category out and emit it as its own ResearchedSteps payload,
// keyed by the corresponding SpecialistDomain.

const CATEGORY_TO_DOMAIN: Record<string, SpecialistDomain> = {
  Documents: "documents",
  Housing: "housing",
  Banking: "banking",
  Healthcare: "healthcare",
};

/**
 * Returns a per-domain map of ResearchedSteps adapted from
 * local_requirements_research. Domains absent from the registry
 * map are simply not in the result. Cultural / other domains are
 * skipped (they don't fit pre-departure action shape).
 */
export function adaptLocalRequirementsToSteps(
  localReq: PersistedLocalRequirements | null | undefined,
): Partial<Record<SpecialistDomain, ResearchedSteps>> {
  const out: Partial<Record<SpecialistDomain, ResearchedSteps>> = {};
  if (!localReq) return out;
  const retrievedAt =
    typeof localReq.researchedAt === "string" ? localReq.researchedAt : new Date().toISOString();
  for (const cat of safeArray(localReq.categories)) {
    const catName = typeof cat?.category === "string" ? cat.category : null;
    if (!catName) continue;
    const domain = CATEGORY_TO_DOMAIN[catName];
    if (!domain) continue;
    out[domain] = adaptCategoryToSteps(cat, domain, retrievedAt);
  }
  return out;
}

function adaptCategoryToSteps(
  cat: PersistedRequirementCategory,
  domain: SpecialistDomain,
  retrievedAt: string,
): ResearchedSteps {
  const items = safeArray(cat.items);
  const allUrls: string[] = [];
  for (const item of items) {
    if (typeof item?.officialLink === "string" && item.officialLink.length > 0) {
      allUrls.push(item.officialLink);
    }
  }
  const sources = urlsToSources(allUrls);
  const allowedUrls = new Set(sources.map((s) => s.url));

  const steps: ResearchedStep[] = items
    .map((item, idx): ResearchedStep | null => {
      const title =
        typeof item?.title === "string" && item.title.trim().length > 0 ? item.title.trim() : null;
      if (!title) return null;
      const description =
        typeof item?.description === "string" ? item.description.trim() : "";
      const walkthrough = safeArray(item?.steps)
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 5);
      const sourcesForStep =
        typeof item?.officialLink === "string" && allowedUrls.has(item.officialLink)
          ? [item.officialLink]
          : [];
      return {
        id: `${domain}:item-${idx + 1}-${slugify(title)}`,
        title,
        description,
        deadlineWindow: { phase: "before_move" },
        appliesWhen: { always: true },
        prerequisites: [],
        documentIds: safeArray(item?.documents).filter(
          (d): d is string => typeof d === "string",
        ),
        ...(walkthrough.length > 0 ? { walkthrough } : {}),
        sources: sourcesForStep,
      };
    })
    .filter((x): x is ResearchedStep => x !== null);

  return {
    kind: "steps",
    domain,
    retrievedAt,
    quality: steps.length > 0 ? "full" : "fallback",
    ...(steps.length === 0 ? { fallbackReason: "no_sources_found" as const } : {}),
    sources,
    summary: `${cat.category ?? domain}: ${steps.length} requirement${steps.length === 1 ? "" : "s"} from research.`,
    steps,
    documents: [],
  };
}
