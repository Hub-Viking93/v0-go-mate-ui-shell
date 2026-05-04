/**
 * research-persistence — pure transforms from SpecialistOutput[] →
 * the legacy `visa_research` and `local_requirements_research` JSON
 * column shapes that the dashboard cards (`VisaResearchCard`,
 * `LocalRequirementsCard`) consume.
 *
 * Why this exists: the orchestrator runs all specialists in-memory and
 * persists only `research_status` / `research_completed_at`. The
 * dashboard cards however read `plan.visa_research` and
 * `plan.local_requirements_research` (cached JSON). Without a bridge
 * those columns stay NULL forever and the cards never render results.
 *
 * One-way mapping. Pure functions. No I/O.
 */

import type { SynthesizerInput } from "@workspace/agents";
import type { Profile } from "../gomate/profile-schema-snapshot";

// ---------------------------------------------------------------------------
// Output shapes — kept structurally identical to the frontend card props
// (artifacts/gomate/src/components/visa-research-card.tsx and
//  artifacts/gomate/src/components/local-requirements-card.tsx).
// ---------------------------------------------------------------------------

export interface PersistedVisaOption {
  name: string;
  type: string;
  eligibility: "high" | "medium" | "low" | "unknown";
  eligibilityReason: string;
  requirements: string[];
  processingTime: string;
  cost: string;
  validity: string;
  benefits: string[];
  limitations: string[];
  officialLink?: string;
  /** Every URL the visa specialist scraped — surfaced in the visa
   *  workspace as a TrustBadge dropdown so users can verify against
   *  multiple authorities, not just the single officialLink. */
  sourceUrls?: string[];
  applicationSteps?: string[];
  recommended?: boolean;
}

export interface PersistedVisaResearch {
  destination: string;
  citizenship: string;
  purpose: string;
  researchedAt: string;
  visaOptions: PersistedVisaOption[];
  summary: string;
  disclaimer: string;
}

export interface PersistedRequirementItem {
  title: string;
  description: string;
  steps: string[];
  documents: string[];
  estimatedTime: string;
  cost?: string;
  officialLink?: string;
  tips?: string[];
}

export interface PersistedRequirementCategory {
  category: string;
  icon: string;
  items: PersistedRequirementItem[];
}

/**
 * Full domain-grouped document schema (9.5 expansion). Stored alongside
 * the legacy `categories` shape so existing UI keeps working while the
 * new domain-grouped checklist reads from `documentsDetailed`.
 */
export type DocumentDomain =
  | "personal"
  | "family"
  | "school"
  | "work"
  | "posted_worker"
  | "pet"
  | "vehicle"
  | "departure_side";

export interface PersistedDocumentItem {
  id: string;
  name: string;
  domain: DocumentDomain;
  phase: "before_move" | "visa_appointment" | "first_weeks" | "first_months";
  whyNeeded: string;
  whereToObtain: string;
  needsApostille: boolean;
  needsTranslation: boolean;
  submissionDestination: string;
  leadTimeDays: number | null;
  issuingAuthority: string;
  appliesWhen: string;
}

export interface PersistedLocalRequirements {
  destination: string;
  city?: string;
  researchedAt: string;
  categories: PersistedRequirementCategory[];
  documentsDetailed?: PersistedDocumentItem[];
  documentWarnings?: string[];
  summary: string;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DISCLAIMER =
  "AI-generated research synthesised from official sources. Verify critical details with the cited authorities before acting on this information.";

function findOutput(
  outputs: SynthesizerInput[],
  name: string,
): SynthesizerInput | undefined {
  return outputs.find((o) => o.name === name);
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function asObjectArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is Record<string, unknown> =>
      x !== null && typeof x === "object" && !Array.isArray(x),
  );
}

function profileString(profile: Profile, key: string): string {
  const v = (profile as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

// ---------------------------------------------------------------------------
// visa_research builder
// ---------------------------------------------------------------------------

function deriveEligibility(
  quality: string | undefined,
  warnings: string[],
): PersistedVisaOption["eligibility"] {
  if (quality === "fallback") return "unknown";
  // Heuristic: red-flag warnings → medium; explicit "ineligible" → low.
  const flat = warnings.join(" ").toLowerCase();
  if (/ineligib|not eligib|cannot apply|denied/.test(flat)) return "low";
  if (warnings.length >= 2) return "medium";
  return "high";
}

export function buildVisaResearchPayload(
  outputs: SynthesizerInput[],
  profile: Profile,
): PersistedVisaResearch | null {
  const visa = findOutput(outputs, "visa_specialist");
  if (!visa) return null;
  const o = visa.output;
  const kf = (o.domainSpecificData ?? {}) as Record<string, unknown>;

  const recommendedVisa = asString(kf["recommended_visa"]) ?? "Recommended pathway";
  const visaCategory = asString(kf["visa_category"]) ?? "other";
  const processingWeeks = asNumber(kf["estimated_processing_weeks"]);
  const eligibilityChecks = asStringArray(kf["key_eligibility_checks"]);
  const warnings = asStringArray(kf["warnings"]);
  const costSummary = asString(kf["estimated_cost_summary"]);
  const validitySummary = asString(kf["validity_summary"]);
  const primaryAuthorityUrl = asString(kf["primary_authority_url"]);

  // Resolve official source URL with a 3-tier fallback so the user
  // ALWAYS gets somewhere to read about their visa:
  //   1. The LLM-picked primary_authority_url (from SOURCES).
  //   2. The first scraped citation URL.
  //   3. null (UI hides the link when this is the case).
  const officialLink = primaryAuthorityUrl ?? o.citations[0]?.url ?? null;
  // All sourced URLs the user can browse — used by the visa workspace
  // to render a TrustBadge dropdown of every authority we read.
  const sourceUrls = (o.citations ?? [])
    .map((c) => c.url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
  const paragraphs = o.contentParagraphs ?? [];

  const option: PersistedVisaOption = {
    name: recommendedVisa,
    type: visaCategory,
    eligibility: deriveEligibility(o.quality, warnings),
    eligibilityReason: paragraphs[1] ?? paragraphs[0] ?? "See full analysis below.",
    requirements: eligibilityChecks,
    processingTime:
      processingWeeks != null
        ? `Approx. ${processingWeeks} week${processingWeeks === 1 ? "" : "s"}`
        : "",
    // Cost and validity are now LLM-summarised from sources. Empty
    // string when null so the frontend's existing placeholder
    // detection ("—") kicks in and the user is pointed at the
    // officialLink instead of reading a useless "See official source".
    cost: costSummary ?? "",
    validity: validitySummary ?? "",
    benefits: [],
    limitations: warnings,
    officialLink: officialLink ?? undefined,
    sourceUrls,
    applicationSteps: paragraphs[2] ? [paragraphs[2]] : undefined,
    recommended: true,
  };

  return {
    destination: profileString(profile, "destination"),
    citizenship: profileString(profile, "citizenship"),
    purpose: profileString(profile, "purpose"),
    researchedAt: o.retrievedAt ?? new Date().toISOString(),
    visaOptions: [option],
    summary: paragraphs[0] ?? `Recommended pathway: ${recommendedVisa}.`,
    disclaimer: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// local_requirements_research builder
// ---------------------------------------------------------------------------

const VALID_DOMAINS: ReadonlySet<DocumentDomain> = new Set([
  "personal", "family", "school", "work", "posted_worker", "pet", "vehicle", "departure_side",
]);

function slugifyId(name: string, domain: string, idx: number): string {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${domain}-${slug || `doc-${idx}`}`;
}

export function buildDocumentsDetailed(
  outputs: SynthesizerInput[],
): { items: PersistedDocumentItem[]; warnings: string[] } {
  const docs = findOutput(outputs, "documents_specialist");
  if (!docs) return { items: [], warnings: [] };
  const kf = (docs.output.domainSpecificData ?? {}) as Record<string, unknown>;
  const documents = asObjectArray(kf["documents"]);
  const warnings = asStringArray(kf["warnings"]);
  const items: PersistedDocumentItem[] = documents.map((d, idx) => {
    const name = asString(d["name"]) ?? `Document ${idx + 1}`;
    const rawDomain = asString(d["domain"]) ?? "personal";
    const domain = (VALID_DOMAINS.has(rawDomain as DocumentDomain)
      ? rawDomain
      : "personal") as DocumentDomain;
    const phase = (asString(d["phase"]) ?? "before_move") as PersistedDocumentItem["phase"];
    return {
      id: slugifyId(name, domain, idx),
      name,
      domain,
      phase,
      whyNeeded: asString(d["why_needed"]) ?? "",
      whereToObtain: asString(d["where_to_obtain"]) ?? asString(d["issuing_authority"]) ?? "",
      needsApostille: d["needs_apostille"] === true,
      needsTranslation: d["needs_translation"] === true,
      submissionDestination: asString(d["submission_destination"]) ?? "",
      leadTimeDays: asNumber(d["lead_time_days"]) ?? null,
      issuingAuthority: asString(d["issuing_authority"]) ?? "",
      appliesWhen: asString(d["applies_when"]) ?? "",
    };
  });
  return { items, warnings };
}

function buildDocumentsCategory(
  outputs: SynthesizerInput[],
): PersistedRequirementCategory | null {
  const docs = findOutput(outputs, "documents_specialist");
  if (!docs) return null;
  const kf = (docs.output.domainSpecificData ?? {}) as Record<string, unknown>;
  const documents = asObjectArray(kf["documents"]);
  if (documents.length === 0) return null;

  const items: PersistedRequirementItem[] = documents.map((d) => {
    const name = asString(d["name"]) ?? "Document";
    const phase = asString(d["phase"]) ?? "before_move";
    const apostille = d["needs_apostille"] === true;
    const translation = d["needs_translation"] === true;
    const authority = asString(d["issuing_authority"]) ?? "Issuing authority";
    const tips: string[] = [];
    if (apostille) tips.push("Requires apostille (Hague convention).");
    if (translation) tips.push("Requires certified translation.");
    return {
      title: name,
      description: `Issued by ${authority}. Required ${phase.replace(/_/g, " ")}.`,
      steps: [
        `Request from ${authority}.`,
        ...(apostille ? ["Get apostille certification."] : []),
        ...(translation ? ["Get certified translation."] : []),
      ],
      documents: [name],
      estimatedTime:
        phase === "before_move"
          ? "Complete before departure"
          : phase === "visa_appointment"
          ? "Bring to visa appointment"
          : phase === "first_weeks"
          ? "Complete in first weeks after arrival"
          : "Complete in first months after arrival",
      tips: tips.length > 0 ? tips : undefined,
    };
  });

  return { category: "Documents", icon: "FileText", items };
}

function buildHealthcareCategory(
  outputs: SynthesizerInput[],
): PersistedRequirementCategory | null {
  const hc = findOutput(outputs, "healthcare_navigator");
  if (!hc) return null;
  const kf = (hc.output.domainSpecificData ?? {}) as Record<string, unknown>;
  const steps = asStringArray(kf["registration_steps"]);
  const insurance = asObjectArray(kf["insurance_options"]);
  const providers = asObjectArray(kf["recommended_providers"]);
  const warnings = asStringArray(kf["warnings"]);

  const items: PersistedRequirementItem[] = [];
  if (steps.length > 0) {
    items.push({
      title: "Register with the local healthcare system",
      description: "Steps to access public healthcare in your destination.",
      steps,
      documents: [],
      estimatedTime: "First weeks after arrival",
      tips: warnings.length > 0 ? warnings : undefined,
    });
  }
  if (insurance.length > 0) {
    items.push({
      title: "Choose health insurance",
      description: "Available insurance options for your situation.",
      steps: insurance.map((opt) => {
        const name = asString(opt["name"]) ?? "Provider";
        const type = asString(opt["type"]) ?? "plan";
        const monthly = asNumber(opt["approx_monthly_eur"]);
        const fee = monthly != null ? ` — approx. €${monthly}/month` : "";
        return `${name} (${type})${fee}`;
      }),
      documents: [],
      estimatedTime: "Before or shortly after arrival",
    });
  }
  if (providers.length > 0) {
    items.push({
      title: "Recommended providers",
      description: "English-friendly healthcare providers near your destination.",
      steps: providers.map((p) => {
        const name = asString(p["name"]) ?? "Provider";
        const city = asString(p["city"]) ?? "";
        const eng = p["english_speaking"] === true ? " (English-speaking)" : "";
        return `${name}${city ? ` — ${city}` : ""}${eng}`;
      }),
      documents: [],
      estimatedTime: "As needed",
      officialLink: asString(providers[0]?.["url"]),
    });
  }
  if (items.length === 0) return null;
  return { category: "Healthcare", icon: "Heart", items };
}

function buildBankingCategory(
  outputs: SynthesizerInput[],
): PersistedRequirementCategory | null {
  const bk = findOutput(outputs, "banking_helper");
  if (!bk) return null;
  const kf = (bk.output.domainSpecificData ?? {}) as Record<string, unknown>;
  const banks = asObjectArray(kf["recommended_banks"]);
  const requiredDocs = asStringArray(kf["required_docs_summary"]);
  const steps = asStringArray(kf["account_opening_steps"]);
  const bridges = asObjectArray(kf["digital_bridges"]);
  const warnings = asStringArray(kf["warnings"]);

  const items: PersistedRequirementItem[] = [];
  if (steps.length > 0 || banks.length > 0) {
    items.push({
      title: "Open a local bank account",
      description:
        banks.length > 0
          ? `Recommended: ${banks
              .map((b) => asString(b["name"]) ?? "")
              .filter(Boolean)
              .slice(0, 3)
              .join(", ")}.`
          : "Open a local bank account.",
      steps: steps.length > 0 ? steps : ["Choose a bank.", "Gather required documents.", "Visit a branch or apply online."],
      documents: requiredDocs,
      estimatedTime: "First weeks after arrival",
      officialLink: asString(banks[0]?.["url"]),
      tips: warnings.length > 0 ? warnings : undefined,
    });
  }
  if (bridges.length > 0) {
    items.push({
      title: "Set up a digital bridge account",
      description: "Multi-currency tools to bridge the gap before your local account is open.",
      steps: bridges.map((b) => {
        const name = asString(b["name"]) ?? "Provider";
        const useCase = asString(b["use_case"]) ?? "";
        return `${name}${useCase ? ` — ${useCase}` : ""}`;
      }),
      documents: [],
      estimatedTime: "Before departure",
      officialLink: asString(bridges[0]?.["url"]),
    });
  }
  if (items.length === 0) return null;
  return { category: "Banking", icon: "CreditCard", items };
}

function buildHousingCategory(
  outputs: SynthesizerInput[],
): PersistedRequirementCategory | null {
  const hs = findOutput(outputs, "housing_specialist");
  if (!hs) return null;
  const kf = (hs.output.domainSpecificData ?? {}) as Record<string, unknown>;
  const neighbourhoods = asObjectArray(kf["recommended_neighbourhoods"]);
  const platforms = asObjectArray(kf["rental_platforms"]);
  const depositMonths = asNumber(kf["typical_deposit_months"]);
  const warnings = asStringArray(kf["warnings"]);

  const items: PersistedRequirementItem[] = [];
  if (neighbourhoods.length > 0) {
    items.push({
      title: "Recommended neighbourhoods",
      description: "Areas that match your profile and lifestyle.",
      steps: neighbourhoods.map((n) => {
        const name = asString(n["name"]) ?? "Area";
        const vibe = asString(n["vibe"]) ?? "";
        const rent = asNumber(n["approx_rent_eur"]);
        const price = rent != null ? ` (~€${rent}/mo)` : "";
        return `${name}${vibe ? ` — ${vibe}` : ""}${price}`;
      }),
      documents: [],
      estimatedTime: "Research before arrival",
    });
  }
  if (platforms.length > 0) {
    items.push({
      title: "Find rentals via official platforms",
      description: "Trusted platforms to search for accommodation.",
      steps: platforms.map((p) => {
        const name = asString(p["name"]) ?? "Platform";
        return name;
      }),
      documents: [],
      estimatedTime: "Ongoing",
      officialLink: asString(platforms[0]?.["url"]),
      cost: depositMonths != null ? `Typical deposit: ${depositMonths} month(s) rent` : undefined,
      tips: warnings.length > 0 ? warnings : undefined,
    });
  }
  if (items.length === 0) return null;
  return { category: "Housing", icon: "Home", items };
}

function buildCulturalCategory(
  outputs: SynthesizerInput[],
): PersistedRequirementCategory | null {
  const cu = findOutput(outputs, "cultural_adapter");
  if (!cu) return null;
  const kf = (cu.output.domainSpecificData ?? {}) as Record<string, unknown>;
  const tips = asStringArray(kf["top_etiquette_tips"]);
  const channels = asObjectArray(kf["integration_channels"]);
  const warnings = asStringArray(kf["warnings"]);
  const langDiff = asString(kf["language_difficulty"]);
  const englishOk = kf["english_workable"] === true;

  const items: PersistedRequirementItem[] = [];
  if (tips.length > 0) {
    items.push({
      title: "Local etiquette and cultural norms",
      description: langDiff
        ? `Language difficulty: ${langDiff}. ${englishOk ? "English is workable in many situations." : "Local language strongly recommended."}`
        : "Cultural norms to be aware of.",
      steps: tips,
      documents: [],
      estimatedTime: "Ongoing — first months",
      tips: warnings.length > 0 ? warnings : undefined,
    });
  }
  if (channels.length > 0) {
    items.push({
      title: "Integration & community channels",
      description: "Communities and resources to plug into.",
      steps: channels.map((c) => asString(c["name"]) ?? "").filter(Boolean),
      documents: [],
      estimatedTime: "First months after arrival",
      officialLink: asString(channels[0]?.["url"]),
    });
  }
  if (items.length === 0) return null;
  return { category: "Culture & Integration", icon: "HelpCircle", items };
}

export function buildLocalRequirementsPayload(
  outputs: SynthesizerInput[],
  profile: Profile,
): PersistedLocalRequirements | null {
  const categories: PersistedRequirementCategory[] = [];
  const docs = buildDocumentsCategory(outputs);
  if (docs) categories.push(docs);
  const housing = buildHousingCategory(outputs);
  if (housing) categories.push(housing);
  const healthcare = buildHealthcareCategory(outputs);
  if (healthcare) categories.push(healthcare);
  const banking = buildBankingCategory(outputs);
  if (banking) categories.push(banking);
  const cultural = buildCulturalCategory(outputs);
  if (cultural) categories.push(cultural);

  const detailed = buildDocumentsDetailed(outputs);

  if (categories.length === 0 && detailed.items.length === 0) return null;

  const totalItems = categories.reduce((acc, c) => acc + c.items.length, 0);
  return {
    destination: profileString(profile, "destination"),
    city: profileString(profile, "destination_city") || undefined,
    researchedAt: new Date().toISOString(),
    categories,
    documentsDetailed: detailed.items.length > 0 ? detailed.items : undefined,
    documentWarnings: detailed.warnings.length > 0 ? detailed.warnings : undefined,
    summary: `${totalItems} local requirement${totalItems === 1 ? "" : "s"} across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`,
    disclaimer: DISCLAIMER,
  };
}
