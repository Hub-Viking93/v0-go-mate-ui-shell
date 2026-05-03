// =============================================================
// Wave 6 — server-side guide composition pipeline
// =============================================================
// Runs after the research orchestrator finalizes. Maps in-memory
// specialist outputs into the `SpecialistInputs` shape the agents
// composer expects, calls `composeGuide`, then persists:
//   - one row to `public.guides` (with all *_section columns)
//   - one row per citation to `public.guide_section_citations`
//   - hero image (Unsplash) on the guide
//
// We do not delete the legacy v1 `enrichGuide` path — it lives in
// the migrated /lib/gomate/guide-generator.ts (frontend-only types).
// This pipeline is the v2 replacement and is the only writer of new
// guides.
// =============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  composeGuide,
  type ComposedGuide,
  type GuideSectionKey,
  type SpecialistInputs,
  type SpecialistInputForWriter,
  type LogWriter,
} from "@workspace/agents";
import { logger } from "../logger";
import { resolveHeroImage } from "./unsplash";

// Specialist name → guide section key.
const SPECIALIST_TO_SECTION: Record<string, GuideSectionKey> = {
  visa_specialist: "visa",
  cost_specialist: "budget",
  housing_specialist: "housing",
  banking_helper: "banking",
  healthcare_navigator: "healthcare",
  cultural_adapter: "culture",
  documents_specialist: "documents",
  posted_worker_specialist: "posted_worker",
  job_compliance_specialist: "jobs",
  schools_specialist: "education",
};

interface SpecialistOutputBody {
  specialist?: string;
  contentParagraphs?: string[];
  citations?: Array<{ url: string; label?: string; scraped?: boolean; note?: string }>;
  domainSpecificData?: Record<string, unknown>;
  sourceUrlsUsed?: string[];
  retrievedAt?: string;
}

/**
 * Wire shape: research-orchestrator emits `SynthesizerInput[]` which is
 * `{ name: string; output: SpecialistOutput }`. We support that AND the
 * legacy "flat" shape (where `specialist` is on the root) so older code
 * paths still work.
 */
interface SpecialistOutputLike extends SpecialistOutputBody {
  name?: string;
  output?: SpecialistOutputBody;
}

/** Map an in-memory SpecialistOutput[] → SpecialistInputs by section key. */
export function mapSpecialistOutputsToInputs(
  outputs: SpecialistOutputLike[],
): SpecialistInputs {
  const inputs: SpecialistInputs = {};
  for (const out of outputs) {
    // Prefer the SynthesizerInput shape (`{name, output}`); fall back to flat.
    const name = out.name ?? out.specialist ?? out.output?.specialist;
    if (!name) continue;
    const key = SPECIALIST_TO_SECTION[name];
    if (!key) continue;
    const body: SpecialistOutputBody = out.output ?? out;
    const sources = (body.citations ?? []).map((c) => ({
      url: c.url,
      name: c.label ?? c.url,
      retrievedAt: body.retrievedAt ?? new Date().toISOString().split("T")[0],
    }));
    const slim: SpecialistInputForWriter = {
      paragraphs: body.contentParagraphs ?? [],
      key_facts: body.domainSpecificData ?? {},
      sources,
    };
    inputs[key] = slim;
  }
  return inputs;
}

interface PersistArgs {
  supabase: SupabaseClient;
  userId: string;
  planId: string;
  profile: Record<string, unknown>;
  composed: ComposedGuide;
  destination: string;
  destinationCity: string | null;
  purpose: string;
}

/** Map specialist key — what we wrote to research_meta.specialists */
type SpecData = Record<string, { domainSpecificData?: Record<string, unknown> }>;

function getSpec(specs: SpecData, name: string): Record<string, unknown> {
  return (specs?.[name]?.domainSpecificData ?? {}) as Record<string, unknown>;
}

function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function strField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Build the legacy `<area>_section` JSON shape the existing detail page reads. */
function buildLegacySectionShapes(
  composed: ComposedGuide,
  profile: Record<string, unknown>,
  specialistsData: SpecData = {},
): {
  visa_section: Record<string, unknown>;
  budget_section: Record<string, unknown>;
  housing_section: Record<string, unknown>;
  banking_section: Record<string, unknown>;
  healthcare_section: Record<string, unknown>;
  culture_section: Record<string, unknown>;
  jobs_section: Record<string, unknown> | null;
  education_section: Record<string, unknown> | null;
} {
  const byKey = new Map<GuideSectionKey, { paragraphs: string[]; citations: typeof composed.sections[number]["citations"] }>();
  for (const s of composed.sections) byKey.set(s.key, { paragraphs: s.paragraphs, citations: s.citations });
  const prose = (key: GuideSectionKey): string => (byKey.get(key)?.paragraphs ?? []).join("\n\n");

  const visa = byKey.get("visa");
  const budget = byKey.get("budget");
  const housing = byKey.get("housing");
  const banking = byKey.get("banking");
  const healthcare = byKey.get("healthcare");
  const culture = byKey.get("culture");
  const jobs = byKey.get("jobs");
  const education = byKey.get("education");

  // Pull structured data from each specialist.
  const visaSpec = getSpec(specialistsData, "visa_specialist");
  const dnSpec = getSpec(specialistsData, "digital_nomad_compliance");
  const costSpec = getSpec(specialistsData, "cost_specialist");
  const housingSpec = getSpec(specialistsData, "housing_specialist");
  const bankingSpec = getSpec(specialistsData, "banking_helper");
  const healthSpec = getSpec(specialistsData, "healthcare_navigator");
  const cultureSpec = getSpec(specialistsData, "cultural_adapter");
  const jobsSpec = getSpec(specialistsData, "job_compliance_specialist");
  const docsSpec = getSpec(specialistsData, "documents_specialist");

  return {
    visa_section: (() => {
      const procWeeks = visaSpec.estimated_processing_weeks;
      const procStr = typeof procWeeks === "number" ? `~${procWeeks} weeks` : "";
      const checks = arr<string>(visaSpec.key_eligibility_checks);
      const visaWarnings = arr<string>(visaSpec.warnings);
      const docs = arr<Record<string, unknown>>(docsSpec.documents);
      const visaDocReqs = docs
        .filter((d) => /visa|residence|permit/i.test(strField(d.purpose) + " " + strField(d.name)))
        .map((d) => strField(d.name))
        .filter(Boolean);
      return {
        recommendedVisa: strField(visaSpec.recommended_visa) || strField(dnSpec.visa_name) || (visa ? deriveTitleFromParagraphs(visa.paragraphs) : ""),
        visaType: strField(visaSpec.visa_category) || (typeof profile.purpose === "string" ? profile.purpose : ""),
        eligibility: checks.length > 0 ? checks.slice(0, 3).join(" · ") : "",
        processingTime: procStr,
        estimatedCost: "",
        requirements: visaDocReqs.slice(0, 8),
        applicationSteps: [],
        tips: visaWarnings.slice(0, 5),
        warnings: visaWarnings.slice(5, 10),
        officialLink: strField(visaSpec.primary_authority),
        detailedProcess: prose("visa"),
      };
    })(),
    budget_section: (() => {
      const monthlyBudget = parseAmount(profile.monthly_budget) ?? 0;
      const savings = parseAmount(profile.savings_available) ?? 0;
      // Prefer cost_specialist's empirical numbers when present.
      const costMin = typeof costSpec.monthly_minimum === "number" ? (costSpec.monthly_minimum as number) : null;
      const costComf = typeof costSpec.monthly_comfortable === "number" ? (costSpec.monthly_comfortable as number) : null;
      const minimum = costMin ?? Math.max(monthlyBudget, 1500);
      const comfortable = costComf ?? Math.round(minimum * 1.6);
      const breakdown = (costSpec.key_breakdown && typeof costSpec.key_breakdown === "object")
        ? (costSpec.key_breakdown as Record<string, number>)
        : {
            housing: Math.round(minimum * 0.4),
            food: Math.round(minimum * 0.2),
            transport: Math.round(minimum * 0.1),
            utilities: Math.round(minimum * 0.1),
            healthcare: Math.round(minimum * 0.1),
            other: Math.round(minimum * 0.1),
          };
      const savingsTotal = typeof costSpec.savings_target_total === "number"
        ? (costSpec.savings_target_total as number)
        : Math.round(minimum * 6);
      const tips = arr<string>(costSpec.warnings);
      return {
        monthlyBudget: { minimum, comfortable, breakdown },
        savingsTarget: {
          emergencyFund: Math.round(minimum * 3),
          movingCosts: Math.round(minimum * 0.8),
          initialSetup: Math.round(minimum * 1.2),
          visaFees: 200,
          total: savingsTotal,
          timeline: typeof profile.timeline === "string" ? profile.timeline : "before move date",
          currentSavings: savings,
        },
        tips: tips.slice(0, 6),
        costComparison: prose("budget"),
      };
    })(),
    housing_section: (() => {
      const rentRange = costSpec.rent_estimate_range as { min?: number; max?: number; mid?: number } | undefined;
      const platforms = arr<Record<string, unknown>>(housingSpec.rental_platforms).map((p) => ({
        name: strField(p.name),
        url: strField(p.url),
        description: strField(p.description),
      })).filter((p) => p.name);
      const neighborhoods = arr<Record<string, unknown>>(housingSpec.recommended_neighbourhoods);
      const deposit = housingSpec.typical_deposit_months;
      const housingWarnings = arr<string>(housingSpec.warnings);
      const rentMid = rentRange?.mid ?? 0;
      const cur = strField(costSpec.currency) || "USD";
      return {
        overview: prose("housing"),
        averageRent: rentMid > 0
          ? {
              studio: `${cur} ${Math.round(rentMid * 0.7).toLocaleString()}/mo`,
              oneBed: `${cur} ${rentMid.toLocaleString()}/mo`,
              twoBed: `${cur} ${Math.round(rentMid * 1.5).toLocaleString()}/mo`,
            }
          : { studio: "See housing platforms", oneBed: "See housing platforms", twoBed: "See housing platforms" },
        rentalPlatforms: platforms.slice(0, 6),
        depositInfo: typeof deposit === "number" ? `${deposit} month${deposit === 1 ? "" : "s"} typical security deposit` : "",
        tips: housingWarnings.slice(0, 5),
        warnings: housingWarnings.slice(5, 10),
        neighborhoodGuide: neighborhoods.length > 0
          ? neighborhoods.map((n) => `${strField(n.name)} — ${strField(n.vibe) || strField(n.note) || ""}`).filter((s) => s.trim().length > 0).join("\n\n")
          : prose("housing"),
        rentalProcess: prose("housing"),
      };
    })(),
    banking_section: (() => {
      const banks = arr<Record<string, unknown>>(bankingSpec.recommended_banks).map((b) => ({
        name: strField(b.name) || strField(b.bank),
        type: strField(b.type) || "Traditional",
        features: arr<string>(b.features ?? b.notes ?? []),
      })).filter((b) => b.name);
      const digital = arr<Record<string, unknown>>(bankingSpec.digital_bridges).map((d) => ({
        name: strField(d.name),
        features: arr<string>(d.features ?? d.notes ?? []),
      })).filter((d) => d.name);
      const reqs = arr<string>(bankingSpec.required_docs_summary);
      const bankingWarnings = arr<string>(bankingSpec.warnings);
      return {
        overview: prose("banking"),
        recommendedBanks: banks,
        requirements: reqs,
        digitalBanks: digital,
        tips: bankingWarnings.slice(0, 5),
        accountOpeningGuide: prose("banking"),
      };
    })(),
    healthcare_section: (() => {
      const ins = arr<Record<string, unknown>>(healthSpec.insurance_options);
      const insurer = ins[0];
      const steps = arr<string>(healthSpec.registration_steps);
      const providers = arr<Record<string, unknown>>(healthSpec.recommended_providers).map((p) => strField(p.name) + (p.location ? ` (${strField(p.location)})` : ""));
      const healthWarnings = arr<string>(healthSpec.warnings);
      return {
        overview: prose("healthcare"),
        systemType: insurer ? `${strField(insurer.name)} (${strField(insurer.type) || "public"})` : "",
        insuranceRequirements: ins.length > 0
          ? ins.map((i) => `${strField(i.name)}${i.cost_eur_monthly ? ` — ~€${i.cost_eur_monthly}/mo` : ""}`).join(", ")
          : "",
        registrationSteps: steps,
        emergencyInfo: providers.slice(0, 3).join(", "),
        tips: healthWarnings.slice(0, 5),
        registrationGuide: prose("healthcare"),
        insuranceAdvice: prose("healthcare"),
      };
    })(),
    culture_section: (() => {
      const tips = arr<string>(cultureSpec.top_etiquette_tips);
      const channels = arr<string>(cultureSpec.integration_channels);
      const enWork = cultureSpec.english_workable === true;
      const lang = strField(cultureSpec.language_difficulty);
      const cultureWarnings = arr<string>(cultureSpec.warnings);
      return {
        overview: prose("culture"),
        language: {
          official: typeof profile.destination === "string" && /philippines/i.test(profile.destination)
            ? "Filipino (Tagalog) and English"
            : "See country profile",
          englishLevel: enWork ? "Widely spoken (workable)" : (lang || "Variable"),
          learningTips: lang ? [`Difficulty: ${lang}`, ...tips.slice(0, 3)] : tips.slice(0, 4),
        },
        socialNorms: tips.slice(0, 6),
        workCulture: channels.slice(0, 4),
        doAndDonts: {
          dos: tips.filter((t) => /^(do |bring|use|learn|always|expect)/i.test(t)).slice(0, 5),
          donts: cultureWarnings.slice(0, 5),
        },
        localTips: channels,
        deepDive: prose("culture"),
        workplaceCulture: prose("culture"),
        socialIntegration: prose("culture"),
      };
    })(),
    jobs_section: jobs
      ? (() => {
          const jobMarket = strField(jobsSpec.market_summary) || strField(dnSpec.tax_residency_implications) || "";
          const skills = arr<string>(jobsSpec.in_demand_skills);
          const platforms = arr<Record<string, unknown>>(jobsSpec.platforms ?? []);
          return {
            overview: prose("jobs"),
            jobMarket,
            inDemandSkills: skills,
            jobPlatforms: platforms.map((p) => ({ name: strField(p.name), url: strField(p.url), description: strField(p.description) })).filter((p) => p.name),
            salaryExpectations: strField(jobsSpec.salary_band ?? ""),
            workPermitInfo: strField(jobsSpec.work_permit_required ?? ""),
            networkingTips: arr<string>(jobsSpec.networking_tips),
            marketOverview: prose("jobs"),
            searchStrategy: prose("jobs"),
          };
        })()
      : null,
    education_section: education
      ? {
          overview: prose("education"),
          systemType: "",
          applicationProcess: [],
          tuitionInfo: "",
          scholarships: [],
          tips: [],
          systemOverview: prose("education"),
        }
      : null,
  };
}

/** Take the first sentence of the first paragraph as a quick title. */
function deriveTitleFromParagraphs(paragraphs: string[]): string {
  const first = paragraphs[0] ?? "";
  const firstSentence = first.split(/(?<=[.!?])\s+/)[0] ?? first;
  return firstSentence.length > 120 ? firstSentence.slice(0, 117) + "…" : firstSentence;
}

/** One-line subtitle (used in compact cover area). */
function buildGuideSubtitle(
  profile: Record<string, unknown>,
  destination: string,
  destinationCity: string | null,
  purpose: string,
): string {
  const name = typeof profile.name === "string" && profile.name.trim().length > 0
    ? profile.name.split(/\s+/)[0]
    : "you";
  const purposeLabel = purpose === "digital_nomad" ? "digital-nomad move"
    : purpose === "work" ? "work relocation"
    : purpose === "study" ? "studies"
    : purpose === "settle" ? "permanent settlement"
    : "relocation";
  const place = destinationCity || destination;
  const origin = typeof profile.current_location === "string" ? profile.current_location : null;
  const fromBit = origin ? ` from ${origin}` : "";
  return `Personal ${purposeLabel} guide for ${name}${fromBit} to ${place}. Every section grounded in official sources.`;
}

/** Multi-paragraph "About this guide" body shown on the Overview tab. */
function buildGuideSummary(
  profile: Record<string, unknown>,
  destination: string,
  destinationCity: string | null,
  purpose: string,
  specs: SpecData,
): string {
  const name = typeof profile.name === "string" && profile.name.trim().length > 0
    ? profile.name.split(/\s+/)[0]
    : "you";
  const place = destinationCity || destination;
  const origin = typeof profile.current_location === "string" ? profile.current_location : "your origin country";
  const purposeNoun = purpose === "digital_nomad" ? "digital-nomad relocation"
    : purpose === "work" ? "work move"
    : purpose === "study" ? "studies abroad"
    : purpose === "settle" ? "permanent settlement"
    : "relocation";
  const visaSpec = getSpec(specs, "visa_specialist");
  const visaName = strField(visaSpec.recommended_visa) || strField(getSpec(specs, "digital_nomad_compliance").visa_name);
  const sourceCount = Object.keys(specs).reduce((acc, k) => {
    const c = (specs[k] as { citations?: unknown[] }).citations;
    return acc + (Array.isArray(c) ? c.length : 0);
  }, 0);

  const p1 = `This guide is built for ${name}'s ${purposeNoun} from ${origin} to ${place}. Every section was researched against official immigration, tax, banking, housing, and healthcare authorities specific to your corridor — no generic advice, no copy-paste country pages.`;
  const p2 = visaName
    ? `Your recommended visa pathway is ${visaName}. The Visa tab walks you through the full application sequence, the documents you'll gather, the deadlines you can't miss, and the official forms you'll submit. The Budget tab sizes your monthly cost-of-living and the savings target you should be building before departure.`
    : `The Visa tab walks you through the residence-permit pathway that fits your situation, with deadlines and official forms. The Budget tab sizes your monthly cost-of-living and the savings target you should hit before departure.`;
  const p3 = `Housing, Banking, Healthcare, Culture, and Practical tabs each give you the local-specific names, portals, and step-by-step process for the actions you'll take in your first 30 days on the ground. The Timeline tab shows your week-by-week pre-departure plan with hard legal deadlines highlighted.`;
  const p4 = sourceCount > 0
    ? `${sourceCount} official sources were consulted during research and are linked inline next to every claim. When something changes between now and your move date, click "Regenerate" — the same agent team re-runs against the latest sources.`
    : `Click "Regenerate" any time you want a fresh research pass against the latest official sources.`;
  return [p1, p2, p3, p4].join("\n\n");
}

/** "Key Facts" pills on the Overview tab. */
function buildKeyFacts(
  profile: Record<string, unknown>,
  destination: string,
  destinationCity: string | null,
  specs: SpecData,
): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  facts.push({ label: "Destination", value: destinationCity || destination });
  if (profile.citizenship) facts.push({ label: "Citizenship", value: String(profile.citizenship) });
  if (profile.purpose) facts.push({ label: "Purpose", value: humanise(String(profile.purpose)) });
  if (profile.duration) facts.push({ label: "Duration", value: String(profile.duration) });
  if (profile.timeline) facts.push({ label: "Move target", value: String(profile.timeline) });
  if (profile.monthly_budget) facts.push({ label: "Monthly budget", value: String(profile.monthly_budget) });
  const visa = getSpec(specs, "visa_specialist");
  if (visa.recommended_visa) facts.push({ label: "Recommended visa", value: String(visa.recommended_visa) });
  if (visa.estimated_processing_weeks) facts.push({ label: "Processing", value: `~${visa.estimated_processing_weeks} weeks` });
  const dn = getSpec(specs, "digital_nomad_compliance");
  if (dn.tax_residency_implications) facts.push({ label: "Tax residency trigger", value: "183 days/year" });
  return facts.slice(0, 8);
}

/** Aggregate the most important warnings/tips across all specialists. */
function buildUsefulTips(specs: SpecData): string[] {
  const tips: string[] = [];
  const seen = new Set<string>();
  for (const name of Object.keys(specs)) {
    const dsd = getSpec(specs, name);
    for (const w of arr<string>(dsd.warnings).slice(0, 2)) {
      const key = w.slice(0, 60).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tips.push(w);
    }
    if (tips.length >= 12) break;
  }
  return tips;
}

/** Pre-departure timeline → guide.timeline_section (embedded, not just a link). */
function buildTimelineSection(
  preDep: { actions?: Array<Record<string, unknown>>; moveDateIso?: string } | null,
): { totalMonths: number; overview?: string; phases: Array<{ name: string; duration: string; tasks: string[]; tips: string[] }> } {
  if (!preDep?.actions || preDep.actions.length === 0) {
    return { totalMonths: 6, phases: [] };
  }
  // Bucket actions by week-band: 12+, 8-12, 4-8, 1-4, 0-1.
  const buckets: Record<string, { name: string; duration: string; tasks: string[]; tips: string[] }> = {
    "12+": { name: "12+ weeks before move", duration: "Lead time", tasks: [], tips: [] },
    "8": { name: "8–12 weeks before move", duration: "Apostille window", tasks: [], tips: [] },
    "4": { name: "4–8 weeks before move", duration: "Visa & banking", tasks: [], tips: [] },
    "1": { name: "1–4 weeks before move", duration: "Final paperwork", tasks: [], tips: [] },
    "0": { name: "Move week", duration: "Day-1 carry-on", tasks: [], tips: [] },
  };
  for (const a of preDep.actions) {
    const weeks = typeof a.weeksBeforeMoveStart === "number" ? a.weeksBeforeMoveStart : 0;
    const title = strField(a.title);
    if (!title) continue;
    const bucketKey = weeks >= 12 ? "12+" : weeks >= 8 ? "8" : weeks >= 4 ? "4" : weeks >= 1 ? "1" : "0";
    buckets[bucketKey].tasks.push(title);
    if (a.legalConsequenceIfMissed) {
      const c = strField(a.legalConsequenceIfMissed);
      if (c) buckets[bucketKey].tips.push(`If missed: ${c}`);
    }
  }
  const phases = Object.values(buckets).filter((b) => b.tasks.length > 0);
  return {
    totalMonths: 6,
    overview: `Embedded from your Pre-departure plan (${preDep.actions.length} actions across ${phases.length} phases).`,
    phases,
  };
}

/** Settling-in / documents → guide.checklist_section (categories with items). */
function buildChecklistSection(
  preDep: { actions?: Array<Record<string, unknown>> } | null,
  specs: SpecData,
): { categories: Array<{ name: string; items: Array<{ task: string; priority: "high" | "medium" | "low"; timeframe: string }> }> } {
  const categories = new Map<string, Array<{ task: string; priority: "high" | "medium" | "low"; timeframe: string }>>();
  for (const a of preDep?.actions ?? []) {
    const title = strField(a.title);
    if (!title) continue;
    const cat = strField(a.category) || "Pre-departure";
    const arr = categories.get(cat) ?? [];
    const isLegal = a.isLegalRequirement === true;
    const weeks = typeof a.weeksBeforeMoveDeadline === "number" ? a.weeksBeforeMoveDeadline : null;
    arr.push({
      task: title,
      priority: isLegal ? "high" : weeks !== null && weeks <= 4 ? "medium" : "low",
      timeframe: weeks !== null ? `${weeks}w before move` : "before move",
    });
    categories.set(cat, arr);
  }
  // Documents from documents_specialist
  const docs = arr<Record<string, unknown>>(getSpec(specs, "documents_specialist").documents);
  if (docs.length > 0) {
    categories.set("Documents", docs.slice(0, 12).map((d) => ({
      task: strField(d.name),
      priority: d.required === true ? "high" as const : "medium" as const,
      timeframe: strField(d.lead_time) || "before submission",
    })).filter((d) => d.task));
  }
  return {
    categories: Array.from(categories.entries()).map(([name, items]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
      items,
    })),
  };
}

function humanise(raw: string): string {
  if (!raw) return "";
  return raw.toLowerCase().split("_").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Parse a "1500 EUR" / "₱15000" style amount string into a number, or null. */
function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const m = raw.replace(/[, ]/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Persist the composed guide to public.guides + public.guide_section_citations.
 * Returns the new guide row id.
 */
export async function persistComposedGuide(args: PersistArgs): Promise<string | null> {
  // Read specialists data (key facts) + pre-departure timeline straight from
  // research_meta so the guide bakes in everything we already know.
  const { data: planRow } = await args.supabase
    .from("relocation_plans")
    .select("research_meta")
    .eq("id", args.planId)
    .maybeSingle<{ research_meta: { specialists?: Record<string, unknown>; preDeparture?: { actions?: Array<Record<string, unknown>>; moveDateIso?: string } } | null }>();
  const specialistsData = (planRow?.research_meta?.specialists ?? {}) as SpecData;
  const preDeparture = planRow?.research_meta?.preDeparture ?? null;
  const legacyShapes = buildLegacySectionShapes(args.composed, args.profile, specialistsData);
  const sectionsJsonb = args.composed.sections.map((s) => ({
    key: s.key,
    title: s.title,
    paragraphs: s.paragraphs,
    citations: s.citations,
  }));

  // Hero image — best effort. Failure is non-fatal; UI gracefully degrades.
  const hero = await resolveHeroImage(args.destinationCity || args.destination).catch(() => null);

  // De-archive: mark previous current guide on the same plan as not-current
  // so /guides shows the new one as the active card.
  await args.supabase
    .from("guides")
    .update({ is_current: false })
    .eq("user_id", args.userId)
    .eq("plan_id", args.planId)
    .eq("is_current", true);

  const insertPayload: Record<string, unknown> = {
    user_id: args.userId,
    plan_id: args.planId,
    title: `${args.destinationCity || args.destination} relocation guide`,
    destination: args.destination,
    destination_city: args.destinationCity,
    purpose: args.purpose,
    overview: {
      title: `${args.destinationCity || args.destination} relocation guide`,
      subtitle: buildGuideSubtitle(args.profile, args.destination, args.destinationCity, args.purpose),
      summary: buildGuideSummary(args.profile, args.destination, args.destinationCity, args.purpose, specialistsData),
      keyFacts: buildKeyFacts(args.profile, args.destination, args.destinationCity, specialistsData),
      lastUpdated: new Date().toISOString(),
    },
    ...legacyShapes,
    timeline_section: buildTimelineSection(preDeparture),
    checklist_section: buildChecklistSection(preDeparture, specialistsData),
    sections: sectionsJsonb,
    official_links: args.composed.globalCitations.map((c) => ({
      name: c.sourceName,
      url: c.sourceUrl,
      category: "official",
    })),
    useful_tips: buildUsefulTips(specialistsData),
    status: "complete",
    guide_type: "ai-generated",
    is_current: true,
    profile_snapshot: args.profile,
    ...(hero
      ? {
          // hero_image_id column is a UUID — Unsplash photo IDs are not UUIDs,
          // so we only persist the URL + attribution.
          hero_image_url: hero.url,
          hero_image_attribution: { photographerName: hero.photographerName, photographerUrl: hero.photographerUrl },
        }
      : {}),
  };

  const { data: inserted, error: insErr } = await args.supabase
    .from("guides")
    .insert(insertPayload)
    .select("id")
    .single();
  if (insErr || !inserted) {
    logger.error({ err: insErr, planId: args.planId }, "[guide-pipeline] guide insert failed");
    return null;
  }

  const guideId = inserted.id as string;

  // Persist citations
  if (args.composed.globalCitations.length > 0) {
    // The Wave 2 v2_agent_tables migration adds a `plan_id` column to this
    // table, but the migration is run manually in the Supabase SQL editor
    // and may not be applied yet. We rely on `guide_id` (FK to guides) for
    // joining — guides already carries plan_id. Skipping plan_id here keeps
    // the insert working before/after migration.
    // Stick to the v1 columns (the v2 migration adding plan_id +
    // source_authority hasn't been applied in production Supabase yet).
    const citationRows = args.composed.sections.flatMap((section) =>
      section.citations.map((c) => ({
        user_id: args.userId,
        guide_id: guideId,
        section_key: section.key,
        source_url: c.sourceUrl,
        source_title: c.sourceName,
        source_publisher: extractDomain(c.sourceUrl),
        source_excerpt: null,
      })),
    );
    if (citationRows.length > 0) {
      const { error: citeErr } = await args.supabase
        .from("guide_section_citations")
        .insert(citationRows);
      if (citeErr) {
        logger.warn({ err: citeErr, guideId }, "[guide-pipeline] citations insert failed (non-fatal)");
      }
    }
  }

  return guideId;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

interface ComposeAndPersistArgs {
  supabase: SupabaseClient;
  userId: string;
  planId: string;
  profile: Record<string, unknown>;
  destination: string;
  destinationCity: string | null;
  purpose: string;
  specialistOutputs: SpecialistOutputLike[];
  logWriter?: LogWriter;
}

/**
 * The single entry point. Called from research-orchestrator.finalize after a
 * successful research run, OR from POST /api/guides as a manual trigger.
 */
export async function composeAndPersistGuide(
  args: ComposeAndPersistArgs,
): Promise<string | null> {
  try {
    const inputs = mapSpecialistOutputsToInputs(args.specialistOutputs);
    const composed = await composeGuide(args.profile, inputs, {
      writer: args.logWriter,
      profileId: args.planId,
    });
    return await persistComposedGuide({
      supabase: args.supabase,
      userId: args.userId,
      planId: args.planId,
      profile: args.profile,
      composed,
      destination: args.destination,
      destinationCity: args.destinationCity,
      purpose: args.purpose,
    });
  } catch (err) {
    logger.error({ err, planId: args.planId }, "[guide-pipeline] composeAndPersistGuide threw");
    return null;
  }
}
