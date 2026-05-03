// =============================================================
// @workspace/agents — Wave 2.1 Validator agent
// =============================================================
// Pure code, no LLM. Takes the raw value handed back by the
// Extractor and the field key it was extracting; dispatches to the
// appropriate validation rule and returns a normalized value or a
// failure with errorCode + retryHint the Question Director can
// surface to the user.
//
// SPEC NOTE — additive `rulesApplied` field:
//   The spec ValidationResult is { valid:true, normalizedValue } |
//   { valid:false, errorCode, retryHint }. We additionally include
//   `rulesApplied: Record<string, unknown>` on BOTH branches so
//   profile-writer can persist the rule descriptor in
//   agent_audit.validation_rules_applied without re-deriving it.
//   This is purely additive; existing destructuring callers are
//   unaffected.
// =============================================================

import { FIELD_INFO, type AllFieldKey } from "./intake-fields.js";
import { getValidationRule, type ValidationRule } from "./validation-rules.js";
import { normalizeCountryName, normalizeCityName } from "./country-normalizer.js";

export type ValidationResult =
  | {
      valid: true;
      normalizedValue: unknown;
      rulesApplied: Record<string, unknown>;
    }
  | {
      valid: false;
      errorCode: string;
      retryHint: string;
      rulesApplied: Record<string, unknown>;
    };

// --- yes/no synonyms (case-folded) ---
const YES_SYNONYMS: ReadonlySet<string> = new Set([
  "yes", "y", "yeah", "yep", "yup", "sure", "definitely",
  "of course", "absolutely", "true", "correct", "affirmative",
  "ok", "okay",
]);
const NO_SYNONYMS: ReadonlySet<string> = new Set([
  "no", "n", "nah", "nope", "no way", "not really", "negative",
  "false", "incorrect",
]);

const CURRENCY_SYMBOL_TO_CODE: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₩": "KRW",
  "₽": "RUB",
  "kr": "SEK", // ambiguous (NOK/DKK/SEK) — default SEK; users can override
};

// 3-letter ISO 4217 codes we accept verbatim. Not exhaustive — keep this
// list aligned with the currency symbols we recognize plus the ones
// profile-schema's preferred_currency typically sees.
const KNOWN_CURRENCY_CODES: ReadonlySet<string> = new Set([
  "USD", "EUR", "GBP", "JPY", "SEK", "NOK", "DKK", "CHF", "CAD",
  "AUD", "NZD", "MXN", "BRL", "ARS", "INR", "CNY", "HKD", "SGD",
  "KRW", "ZAR", "AED", "SAR", "TRY", "PLN", "CZK", "HUF", "RON",
  "BGN", "ILS", "THB", "IDR", "MYR", "PHP", "VND", "RUB",
]);

function ruleDescriptor(rule: ValidationRule): Record<string, unknown> {
  return rule as unknown as Record<string, unknown>;
}

function fail(
  rule: ValidationRule,
  errorCode: string,
  retryHint: string,
): ValidationResult {
  return { valid: false, errorCode, retryHint, rulesApplied: ruleDescriptor(rule) };
}

function ok(rule: ValidationRule, normalizedValue: unknown): ValidationResult {
  return { valid: true, normalizedValue, rulesApplied: ruleDescriptor(rule) };
}

// --- per-rule validators ---

function validateYesNo(raw: unknown, rule: ValidationRule): ValidationResult {
  if (raw === "yes" || raw === "no") return ok(rule, raw);
  if (typeof raw === "boolean") return ok(rule, raw ? "yes" : "no");
  if (typeof raw === "string") {
    const folded = raw.trim().toLowerCase();
    if (YES_SYNONYMS.has(folded)) return ok(rule, "yes");
    if (NO_SYNONYMS.has(folded)) return ok(rule, "no");
  }
  return fail(rule, "unclear_yes_no", "Sorry — was that a yes or a no?");
}

function validateBirthYear(
  raw: unknown,
  rule: Extract<ValidationRule, { kind: "birth_year" }>,
): ValidationResult {
  let n: number | null = null;
  if (typeof raw === "number" && Number.isFinite(raw)) n = Math.trunc(raw);
  else if (typeof raw === "string") {
    const m = raw.match(/\b(\d{4})\b/);
    if (m) n = Number(m[1]);
  }
  if (n === null) {
    return fail(rule, "not_a_year", "I need a 4-digit birth year (e.g. 1995).");
  }
  if (n < rule.min || n > rule.max) {
    return fail(
      rule,
      "year_out_of_range",
      `Birth year must be between ${rule.min} and ${rule.max}.`,
    );
  }
  return ok(rule, n);
}

function validateCurrency(raw: unknown, rule: ValidationRule): ValidationResult {
  if (raw === null || raw === undefined) {
    return fail(rule, "missing_amount", "How much, and in what currency?");
  }
  const text = (typeof raw === "number" ? String(raw) : String(raw)).trim();
  if (text.length === 0) {
    return fail(rule, "missing_amount", "How much, and in what currency?");
  }

  // 1) Try "<symbol><amount>" e.g. "$5,000" "€1000" "£200"
  const symbolMatch = text.match(/^([$€£¥₹₩₽])\s*([\d.,]+)\s*([A-Za-z]{3})?$/);
  if (symbolMatch) {
    const code = symbolMatch[3]?.toUpperCase() ?? CURRENCY_SYMBOL_TO_CODE[symbolMatch[1]];
    const amount = Number(symbolMatch[2].replace(/[, ]/g, ""));
    if (Number.isFinite(amount) && amount >= 0 && code) {
      return ok(rule, `${amount} ${code}`);
    }
  }

  // 2) Try "<amount> <code>" e.g. "5000 USD", "5,000 SEK"
  const amountFirst = text.match(/^([\d.,]+)\s*([A-Za-z]{2,4})$/);
  if (amountFirst) {
    const amount = Number(amountFirst[1].replace(/[, ]/g, ""));
    const code = amountFirst[2].toUpperCase();
    if (Number.isFinite(amount) && amount >= 0) {
      if (KNOWN_CURRENCY_CODES.has(code)) {
        return ok(rule, `${amount} ${code}`);
      }
      // "5000 kr" → SEK
      if (code === "KR") return ok(rule, `${amount} SEK`);
    }
  }

  // 3) Try "<code> <amount>" e.g. "USD 5000", "EUR 1,000"
  const codeFirst = text.match(/^([A-Za-z]{2,4})\s*([\d.,]+)$/);
  if (codeFirst) {
    const code = codeFirst[1].toUpperCase();
    const amount = Number(codeFirst[2].replace(/[, ]/g, ""));
    if (KNOWN_CURRENCY_CODES.has(code) && Number.isFinite(amount) && amount >= 0) {
      return ok(rule, `${amount} ${code}`);
    }
  }

  // 4) Bare number — accept but flag missing currency.
  const bare = Number(text.replace(/[, ]/g, ""));
  if (Number.isFinite(bare) && bare >= 0) {
    return fail(
      rule,
      "missing_currency",
      "What currency is that in? (e.g. USD, EUR, SEK)",
    );
  }

  return fail(
    rule,
    "unparseable_currency",
    "I couldn't parse an amount. Try something like \"5000 USD\" or \"$5000\".",
  );
}

function validateCountry(raw: unknown, rule: ValidationRule): ValidationResult {
  if (typeof raw !== "string") {
    return fail(rule, "not_a_country", "Which country?");
  }
  const normalized = normalizeCountryName(raw);
  if (!normalized) {
    return fail(rule, "not_a_country", "Which country?");
  }
  return ok(rule, normalized);
}

function validateCity(raw: unknown, rule: ValidationRule): ValidationResult {
  if (typeof raw !== "string") {
    return fail(rule, "not_a_city", "Which city?");
  }
  const normalized = normalizeCityName(raw);
  if (!normalized) return fail(rule, "not_a_city", "Which city?");
  return ok(rule, normalized);
}

function validateInteger(
  raw: unknown,
  rule: Extract<ValidationRule, { kind: "integer" }>,
): ValidationResult {
  let n: number | null = null;
  if (typeof raw === "number" && Number.isFinite(raw)) n = Math.trunc(raw);
  else if (typeof raw === "string") {
    const m = raw.replace(/[, ]/g, "").match(/-?\d+/);
    if (m) n = Number(m[0]);
  }
  if (n === null || !Number.isFinite(n)) {
    return fail(rule, "not_an_integer", "I need a whole number.");
  }
  if (rule.min !== undefined && n < rule.min) {
    return fail(rule, "too_small", `Must be at least ${rule.min}.`);
  }
  if (rule.max !== undefined && n > rule.max) {
    return fail(rule, "too_large", `Must be at most ${rule.max}.`);
  }
  return ok(rule, n);
}

function validateMonths(raw: unknown, rule: ValidationRule): ValidationResult {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return ok(rule, Math.trunc(raw));
  }
  if (typeof raw !== "string") {
    return fail(rule, "not_a_duration", "Roughly how many months?");
  }
  const text = raw.trim().toLowerCase();
  // "12 months", "2 years", "18 mo"
  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:y|yr|yrs|year|years)\b/);
  if (yearMatch) {
    return ok(rule, Math.round(Number(yearMatch[1]) * 12));
  }
  const monthMatch = text.match(/(\d+)\s*(?:m|mo|mos|month|months)?\b/);
  if (monthMatch) return ok(rule, Number(monthMatch[1]));
  return fail(rule, "not_a_duration", "Roughly how many months?");
}

function validateName(raw: unknown, rule: ValidationRule): ValidationResult {
  if (typeof raw !== "string") {
    return fail(rule, "not_a_name", "What's your name?");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fail(rule, "not_a_name", "What's your name?");
  }
  // Reject pure numerics or clearly age-like strings — Extractor's safety net.
  if (/^\d+$/.test(trimmed)) {
    return fail(
      rule,
      "not_a_name",
      "That sounds like an age. What's your name?",
    );
  }
  if (/\b(\d{1,3})\s*(years?\s*old|yo)\b/i.test(trimmed)) {
    return fail(
      rule,
      "not_a_name",
      "That sounds like an age. What's your name?",
    );
  }
  // Names should contain at least one letter.
  if (!/[A-Za-zÀ-ÿ]/.test(trimmed)) {
    return fail(rule, "not_a_name", "What's your name?");
  }
  return ok(rule, trimmed);
}

function validateDate(raw: unknown, rule: ValidationRule): ValidationResult {
  if (typeof raw !== "string" && !(raw instanceof Date)) {
    return fail(rule, "not_a_date", "When? (e.g. 2026-09-01 or September 2026)");
  }
  const text = raw instanceof Date ? raw.toISOString() : raw.trim();
  // Try ISO-ish first, then Date.parse fallback.
  const iso = text.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]);
    const dd = iso[3] ? Number(iso[3]) : 1;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const padded = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      return ok(rule, padded);
    }
  }
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) {
    return ok(rule, new Date(parsed).toISOString().slice(0, 10));
  }
  return fail(rule, "not_a_date", "When? (e.g. 2026-09-01 or September 2026)");
}

function validateEnum(
  raw: unknown,
  rule: Extract<ValidationRule, { kind: "enum" }>,
): ValidationResult {
  if (typeof raw !== "string") {
    return fail(
      rule,
      "not_in_enum",
      `Pick one of: ${rule.values.join(", ")}.`,
    );
  }
  const folded = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  for (const allowed of rule.values) {
    if (allowed.toLowerCase() === folded) return ok(rule, allowed);
  }
  // Loose match: if the answer is a longer phrase like
  // "stable, consistent for the last 4 years" or "spouse / sambo",
  // accept the first allowed value that appears as a whole word.
  const lower = raw.toLowerCase();
  for (const allowed of rule.values) {
    const a = allowed.toLowerCase();
    const re = new RegExp(`(^|[^a-z0-9_])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`);
    if (re.test(lower)) return ok(rule, allowed);
  }
  return fail(
    rule,
    "not_in_enum",
    `Pick one of: ${rule.values.join(", ")}.`,
  );
}

function validateString(raw: unknown, rule: ValidationRule): ValidationResult {
  if (typeof raw !== "string") {
    if (raw === null || raw === undefined) {
      return fail(rule, "missing_value", "Could you say a bit more?");
    }
    return ok(rule, String(raw).trim());
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fail(rule, "missing_value", "Could you say a bit more?");
  }
  return ok(rule, trimmed);
}

/**
 * Run schema validation on a raw value coming back from the Extractor.
 * Pure, deterministic, no IO.
 *
 * @param rawValue  Whatever the Extractor produced (string|number|"yes"|"no"|null).
 * @param fieldKey  The pending field this value is supposed to fill.
 */
export function validate(
  rawValue: string | number | "yes" | "no" | null,
  fieldKey: AllFieldKey,
): ValidationResult {
  const rule = getValidationRule(fieldKey);

  // Null short-circuit — Extractor said "I couldn't tell". Validator
  // never invents a value; it surfaces the gap so the Question Director
  // can re-ask.
  if (rawValue === null) {
    return fail(rule, "missing_value", "I didn't catch that — could you tell me again?");
  }

  switch (rule.kind) {
    case "yes_no":     return validateYesNo(rawValue, rule);
    case "birth_year": return validateBirthYear(rawValue, rule);
    case "currency":   return validateCurrency(rawValue, rule);
    case "country":    return validateCountry(rawValue, rule);
    case "city":       return validateCity(rawValue, rule);
    case "integer":    return validateInteger(rawValue, rule);
    case "months":     return validateMonths(rawValue, rule);
    case "name":       return validateName(rawValue, rule);
    case "date":       return validateDate(rawValue, rule);
    case "enum":       return validateEnum(rawValue, rule);
    case "string":     return validateString(rawValue, rule);
  }
}
