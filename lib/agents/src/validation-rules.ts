// =============================================================
// @workspace/agents — Wave 2.1 validation-rule registry
// =============================================================
// Maps every AllFieldKey to a deterministic validation rule. Kept
// separate from intake-fields.ts so the schema snapshot stays a
// pure structural mirror of profile-schema.ts; validation is a
// downstream concern.
//
// Rule kinds correspond 1:1 to dispatchers in validator.ts.
// Adding a new rule kind requires:
//   1. add it here as a discriminated-union arm,
//   2. handle it in validator.ts validate(),
//   3. assign it in FIELD_RULES below.
//
// Enums are sourced from the Zod schema in profile-schema.ts.
// =============================================================

import type { AllFieldKey } from "./intake-fields.js";

export type ValidationRule =
  | { kind: "yes_no" }
  | { kind: "birth_year"; min: number; max: number }
  | { kind: "currency" }
  | { kind: "country" }
  | { kind: "city" }
  | { kind: "integer"; min?: number; max?: number }
  | { kind: "months" }
  | { kind: "name" }
  | { kind: "date" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "string" };

const CURRENT_YEAR = new Date().getUTCFullYear();
const BIRTH_YEAR_MIN = 1900;
const BIRTH_YEAR_MAX = CURRENT_YEAR - 16;

// --- Enum value sources (from profile-schema's Zod definitions) ---
const PURPOSE_VALUES = ["study", "work", "settle", "digital_nomad", "other"] as const;
const VISA_ROLE_VALUES = ["primary", "dependent"] as const;
const PARTNER_VISA_STATUS_VALUES = [
  "citizen",
  "permanent_resident",
  "work_visa",
  "student_visa",
  "other",
] as const;
const RELATIONSHIP_TYPE_VALUES = [
  "spouse",
  "fiancé",
  "fiance",
  "registered_partner",
  "cohabitant",
  "parent",
  "child",
  "other",
] as const;
const INCOME_CONSISTENCY_VALUES = ["stable", "variable", "new"] as const;

const COUNTRY_FIELDS: ReadonlySet<AllFieldKey> = new Set([
  "citizenship",
  "destination",
  "current_location",
  "prior_visa_country",
  "vehicle_origin_country",
] satisfies AllFieldKey[]);

const CITY_FIELDS: ReadonlySet<AllFieldKey> = new Set([
  "target_city",
] satisfies AllFieldKey[]);

const CURRENCY_FIELDS: ReadonlySet<AllFieldKey> = new Set([
  "savings_available",
  "monthly_budget",
  "monthly_income",
  "rental_budget_max",
] satisfies AllFieldKey[]);

const INTEGER_FIELDS: ReadonlySet<AllFieldKey> = new Set([
  "children_count",
  "commute_tolerance_minutes",
  "estimated_goods_volume_cubic_meters",
  "origin_lease_termination_notice_days",
  "years_experience",
] satisfies AllFieldKey[]);

const MONTHS_FIELDS: ReadonlySet<AllFieldKey> = new Set([
  "income_history_months",
  "posting_duration_months",
] satisfies AllFieldKey[]);

const NAME_FIELDS: ReadonlySet<AllFieldKey> = new Set([
  "name",
] satisfies AllFieldKey[]);

const ENUM_FIELDS: Partial<Record<AllFieldKey, readonly string[]>> = {
  purpose: PURPOSE_VALUES,
  visa_role: VISA_ROLE_VALUES,
  partner_visa_status: PARTNER_VISA_STATUS_VALUES,
  relationship_type: RELATIONSHIP_TYPE_VALUES,
  income_consistency: INCOME_CONSISTENCY_VALUES,
};

// --- Yes/no fields are imported from intake-fields by checking type === "yes_no". ---
// We re-derive the set here to keep validation rules self-contained without a
// runtime FIELD_INFO walk on every lookup.
import { FIELD_INFO } from "./intake-fields.js";

export function getValidationRule(fieldKey: AllFieldKey): ValidationRule {
  if (FIELD_INFO[fieldKey]?.type === "yes_no") return { kind: "yes_no" };
  if (fieldKey === "birth_year") {
    return { kind: "birth_year", min: BIRTH_YEAR_MIN, max: BIRTH_YEAR_MAX };
  }
  if (CURRENCY_FIELDS.has(fieldKey)) return { kind: "currency" };
  if (COUNTRY_FIELDS.has(fieldKey)) return { kind: "country" };
  if (CITY_FIELDS.has(fieldKey)) return { kind: "city" };
  if (MONTHS_FIELDS.has(fieldKey)) return { kind: "months" };
  if (INTEGER_FIELDS.has(fieldKey)) return { kind: "integer", min: 0 };
  if (NAME_FIELDS.has(fieldKey)) return { kind: "name" };
  const enumValues = ENUM_FIELDS[fieldKey];
  if (enumValues) return { kind: "enum", values: enumValues };
  // Default — accept any string, just trim. Date fields are handled here too
  // until profile-schema introduces explicit date columns.
  return { kind: "string" };
}
