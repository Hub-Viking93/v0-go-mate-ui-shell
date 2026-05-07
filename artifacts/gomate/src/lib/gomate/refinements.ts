// =============================================================
// Refinement registry — post-research profile completion
// =============================================================
// The wizard at /onboarding asks ~the questions needed to *generate*
// a plan. A handful of fields aren't asked there because they're
// either conditional on profile shape (settle + family-reunion +
// primary-applicant) or refine an already-generated plan rather
// than block its first run.
//
// This module is the source-of-truth for those refinements:
//   - the questions to ask
//   - the conditional rules that decide whether a prompt applies
//   - the input shape per question
//
// UI consumes:
//   getApplicableRefinements(profile) -> RefinementPrompt[]
//
// When the user submits a refinement, the profile_data patch contains
// only the fields they answered. The next research-rerun (manual via
// /pre-move's "Regenerate" button) then weaves the new fields into
// visa-pathway, documents, tax, etc.
// =============================================================

import type { Profile } from "@/lib/gomate/profile-schema";

export type RefinementArea = "dashboard" | "immigration" | "documents";

export type RefinementInput =
  | { kind: "select"; options: { value: string; label: string }[] }
  | { kind: "country" }
  | { kind: "amount_currency" };

export interface RefinementField {
  /** profile_data key that gets patched on submit. */
  key: keyof Profile | string;
  label: string;
  /** Optional helper rendered under the input. */
  helper?: string;
  input: RefinementInput;
}

export interface RefinementPrompt {
  /** Stable id for React keys + dismiss state. */
  id: string;
  /** Eyebrow on the banner / sheet header (e.g. "Money", "Immigration"). */
  area: RefinementArea;
  /** Sheet header — short verb-led title. */
  title: string;
  /** One-sentence body for the banner row. */
  body: string;
  /** Fields the user fills. Currently always 1 per prompt; shape is
   *  ready for multi-field prompts. */
  fields: RefinementField[];
  /** Lower = surfaces first when multiple prompts apply. */
  priority: number;
  /** True when the underlying profile state means this prompt is
   *  meaningful for the current user. The banner derives this for
   *  the whole registry on each render. */
  applicableWhen: (p: Profile) => boolean;
}

const APOSTILLE_OPTIONS = [
  { value: "obtained", label: "Already obtained" },
  { value: "in_progress", label: "In progress" },
  { value: "not_needed", label: "Not started yet" },
];

const POLICE_OPTIONS = [
  { value: "obtained", label: "Already obtained" },
  { value: "applied", label: "Applied / waiting" },
  { value: "not_needed", label: "Not started yet" },
];

const REGISTRY: RefinementPrompt[] = [
  {
    id: "monthly_budget",
    area: "dashboard",
    title: "How much do you plan to spend per month?",
    body: "Sharpens your housing budget and cost-of-living guidance.",
    priority: 10,
    fields: [
      {
        key: "monthly_budget",
        label: "Monthly budget",
        helper: "Rent + utilities + food + transport. Pick the currency you actually budget in.",
        input: { kind: "amount_currency" },
      },
    ],
    applicableWhen: (p) => isMissing(p.monthly_budget),
  },
  {
    id: "prior_visa_country",
    area: "immigration",
    title: "Which country was your prior visa for?",
    body: "Helps us frame visa-pathway risk and prior-rejection sensitivity.",
    priority: 20,
    fields: [
      {
        key: "prior_visa_country",
        label: "Issuing country",
        input: { kind: "country" },
      },
    ],
    applicableWhen: (p) =>
      String(p.prior_visa ?? "").toLowerCase() === "yes" &&
      isMissing((p as Record<string, unknown>).prior_visa_country),
  },
  {
    id: "birth_certificate_apostille_status",
    area: "documents",
    title: "Birth certificate apostille",
    body: "Family-reunion permits often need this. Knowing your status sharpens document guidance.",
    priority: 30,
    fields: [
      {
        key: "birth_certificate_apostille_status",
        label: "Status",
        input: { kind: "select", options: APOSTILLE_OPTIONS },
      },
    ],
    applicableWhen: (p) =>
      p.purpose === "settle" &&
      isMissing((p as Record<string, unknown>).birth_certificate_apostille_status),
  },
  {
    id: "police_clearance_status",
    area: "documents",
    title: "Police clearance certificate",
    body: "Most primary-applicant residence permits require one — telling us where you are speeds prep.",
    priority: 40,
    fields: [
      {
        key: "police_clearance_status",
        label: "Status",
        input: { kind: "select", options: POLICE_OPTIONS },
      },
    ],
    applicableWhen: (p) =>
      p.visa_role === "primary" &&
      (p.purpose === "work" || p.purpose === "study" || p.purpose === "settle") &&
      isMissing((p as Record<string, unknown>).police_clearance_status),
  },
];

function isMissing(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

/**
 * Returns the refinement prompts that apply to the current profile,
 * sorted by priority. Optionally scope to one area (e.g. only
 * "dashboard" prompts when rendering the dashboard banner).
 */
export function getApplicableRefinements(
  profile: Profile,
  areaFilter?: RefinementArea,
): RefinementPrompt[] {
  return REGISTRY.filter((r) => r.applicableWhen(profile))
    .filter((r) => (areaFilter ? r.area === areaFilter : true))
    .sort((a, b) => a.priority - b.priority);
}

/** Export the registry for tests + a future "Refinements" page. */
export { REGISTRY };
