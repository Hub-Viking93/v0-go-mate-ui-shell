// =============================================================
// @workspace/agents — canonical source registry
// =============================================================
// Per (country, domain), the official sources specialists should
// consult. Centralised here so:
//
//   • visa + documents + registration don't pick three different
//     pages for the same authority and produce conflicting facts.
//   • Adding a new destination is a single edit, not a hunt
//     across 12 specialist files.
//   • Source-quality (authority vs institution vs reference) is
//     declared once, not re-asserted per specialist.
//
// This is data, not policy. Specialists still decide which subset
// of the registry to actually fetch for a given run. The registry
// just guarantees the candidate URL pool is consistent.
//
// Country codes
// -------------
// ISO 3166-1 alpha-2 in upper case ("SE", "JP", "DE"). The lookup
// helper accepts country names too and normalises via
// country-normalizer.ts.
//
// Adding a country
// ----------------
// 1. Pick official URLs from the destination's actual
//    government / institution pages. Don't include explainer /
//    blog content here — that goes through Firecrawl + LLM
//    extraction, not the registry.
// 2. Mark each entry with its kind (authority / institution /
//    reference). When in doubt, prefer "authority" only for
//    actual gov / regulator domains.
// 3. Set priority — 1 is the canonical first stop, higher numbers
//    are secondary. Specialists may fetch in priority order.
//
// =============================================================

import type { SourceKind, SpecialistDomain } from "./_contracts.js";
import { normalizeCountryName } from "../country-normalizer.js";

export interface RegisteredSource {
  url: string;
  /** Bare host, no scheme/www. Filled by the helper if omitted. */
  domain?: string;
  kind: SourceKind;
  /** 1 = canonical first stop. Higher = secondary. */
  priority: number;
  /** Optional one-line note explaining when to consult this URL. */
  hint?: string;
}

type CountrySources = Partial<Record<SpecialistDomain, RegisteredSource[]>>;

// ---- Registry --------------------------------------------------------
//
// MVP coverage: top 8 destinations from current product traffic.
// Expand by destination in PRs that add the relevant country
// research bundle.
//
// Empty domain entries are intentional — they document that we
// know we'd consult an authority-domain for this country but
// haven't curated the URL yet. Specialists fall back to whitelist
// search when a registry entry is missing.

const REGISTRY: Record<string, CountrySources> = {
  // ---- Sweden -------------------------------------------------------
  SE: {
    visa: [
      { url: "https://www.migrationsverket.se/English/", kind: "authority", priority: 1 },
      { url: "https://www.swedenabroad.se/en/about-sweden-non-swedish-citizens/", kind: "authority", priority: 2 },
    ],
    documents: [
      { url: "https://www.migrationsverket.se/English/", kind: "authority", priority: 1, hint: "checklists per permit type" },
    ],
    registration: [
      { url: "https://www.skatteverket.se/servicelankar/otherlanguages/inenglish.4.12815e4f14a62bc048f4edc.html", kind: "authority", priority: 1, hint: "personnummer + folkbokföring" },
      { url: "https://www.migrationsverket.se/English/", kind: "authority", priority: 2 },
    ],
    healthcare: [
      { url: "https://www.1177.se/en/", kind: "institution", priority: 1, hint: "public healthcare entry point" },
      { url: "https://www.forsakringskassan.se/english", kind: "authority", priority: 2 },
    ],
    banking: [
      { url: "https://www.fi.se/en/", kind: "authority", priority: 1, hint: "Finansinspektionen — banking regulator" },
      { url: "https://www.bankid.com/en", kind: "institution", priority: 2 },
    ],
    tax: [
      { url: "https://www.skatteverket.se/servicelankar/otherlanguages/inenglish.4.12815e4f14a62bc048f4edc.html", kind: "authority", priority: 1 },
    ],
    departure_tax: [
      { url: "https://www.skatteverket.se/servicelankar/otherlanguages/inenglish.4.12815e4f14a62bc048f4edc.html", kind: "authority", priority: 1 },
    ],
    cultural: [],
    cost: [],
    housing: [
      { url: "https://www.boverket.se/en/", kind: "authority", priority: 2, hint: "national housing authority" },
    ],
    pet: [
      { url: "https://jordbruksverket.se/languages/english", kind: "authority", priority: 1, hint: "Jordbruksverket — pet import" },
    ],
    transport_id: [
      { url: "https://www.transportstyrelsen.se/en/", kind: "authority", priority: 1, hint: "license conversion + vehicle reg" },
    ],
  },

  // ---- Germany ------------------------------------------------------
  DE: {
    visa: [
      { url: "https://www.bamf.de/EN/Startseite/startseite_node.html", kind: "authority", priority: 1, hint: "Federal Office for Migration" },
      { url: "https://www.auswaertiges-amt.de/en", kind: "authority", priority: 2, hint: "Federal Foreign Office" },
    ],
    documents: [
      { url: "https://www.bamf.de/EN/Startseite/startseite_node.html", kind: "authority", priority: 1 },
    ],
    registration: [
      { url: "https://www.bmi.bund.de/EN/topics/migration/migration-policy/migration-policy-node.html", kind: "authority", priority: 1, hint: "Anmeldung" },
    ],
    healthcare: [
      { url: "https://www.bundesgesundheitsministerium.de/en/", kind: "authority", priority: 1 },
    ],
    banking: [
      { url: "https://www.bafin.de/EN/Homepage/homepage_node.html", kind: "authority", priority: 1 },
    ],
    tax: [
      { url: "https://www.bzst.de/EN/Home/home_node.html", kind: "authority", priority: 1, hint: "Federal Central Tax Office" },
    ],
    departure_tax: [
      { url: "https://www.bzst.de/EN/Home/home_node.html", kind: "authority", priority: 1 },
    ],
    cultural: [],
    cost: [],
    housing: [],
    pet: [
      { url: "https://www.bmel.de/EN/Home/home_node.html", kind: "authority", priority: 1, hint: "ministry of agriculture" },
    ],
    transport_id: [
      { url: "https://www.kba.de/EN/Home/home_node.html", kind: "authority", priority: 1, hint: "Kraftfahrt-Bundesamt — vehicle registration" },
    ],
  },

  // ---- Japan --------------------------------------------------------
  JP: {
    visa: [
      { url: "https://www.moj.go.jp/EN/", kind: "authority", priority: 1, hint: "Ministry of Justice + Immigration Services" },
      { url: "https://www.mofa.go.jp/j_info/visit/visa/index.html", kind: "authority", priority: 2 },
    ],
    documents: [
      { url: "https://www.moj.go.jp/EN/", kind: "authority", priority: 1 },
    ],
    registration: [
      { url: "https://www.soumu.go.jp/english/", kind: "authority", priority: 1, hint: "MyNumber + Resident Card" },
    ],
    healthcare: [
      { url: "https://www.mhlw.go.jp/english/", kind: "authority", priority: 1, hint: "Ministry of Health, Labour and Welfare" },
    ],
    banking: [
      { url: "https://www.fsa.go.jp/en/", kind: "authority", priority: 1, hint: "Financial Services Agency" },
    ],
    tax: [
      { url: "https://www.nta.go.jp/english/", kind: "authority", priority: 1, hint: "National Tax Agency" },
    ],
    departure_tax: [
      { url: "https://www.nta.go.jp/english/", kind: "authority", priority: 1 },
    ],
    cultural: [],
    cost: [],
    housing: [],
    pet: [
      { url: "https://www.maff.go.jp/aqs/english/", kind: "authority", priority: 1, hint: "Animal Quarantine Service" },
    ],
    transport_id: [
      { url: "https://www.npa.go.jp/english/index.html", kind: "authority", priority: 1, hint: "National Police Agency — license conversion" },
    ],
  },

  // ---- Portugal -----------------------------------------------------
  PT: {
    visa: [
      { url: "https://imigrante.sef.pt/en/", kind: "authority", priority: 1, hint: "SEF / AIMA" },
    ],
    registration: [
      { url: "https://www.sef.pt/en/", kind: "authority", priority: 1 },
    ],
    healthcare: [
      { url: "https://www.sns.gov.pt/", kind: "institution", priority: 1, hint: "Serviço Nacional de Saúde" },
    ],
    tax: [
      { url: "https://info.portaldasfinancas.gov.pt/en/", kind: "authority", priority: 1, hint: "Autoridade Tributária" },
    ],
    documents: [],
    banking: [],
    cultural: [],
    cost: [],
    housing: [],
    pet: [],
    departure_tax: [],
    transport_id: [],
  },

  // ---- Netherlands --------------------------------------------------
  NL: {
    visa: [
      { url: "https://ind.nl/en", kind: "authority", priority: 1, hint: "IND" },
    ],
    registration: [
      { url: "https://www.government.nl/topics/personal-data/registering-in-the-personal-records-database-brp", kind: "authority", priority: 1 },
    ],
    healthcare: [
      { url: "https://www.government.nl/topics/health-insurance", kind: "authority", priority: 1 },
    ],
    tax: [
      { url: "https://www.belastingdienst.nl/wps/wcm/connect/en/home/home", kind: "authority", priority: 1 },
    ],
    documents: [],
    banking: [],
    cultural: [],
    cost: [],
    housing: [],
    pet: [],
    departure_tax: [],
    transport_id: [],
  },

  // ---- Spain --------------------------------------------------------
  ES: {
    visa: [
      { url: "https://www.exteriores.gob.es/en/", kind: "authority", priority: 1 },
    ],
    registration: [
      { url: "https://administracion.gob.es/", kind: "authority", priority: 1, hint: "empadronamiento + NIE" },
    ],
    healthcare: [
      { url: "https://www.sanidad.gob.es/en/", kind: "authority", priority: 1 },
    ],
    tax: [
      { url: "https://sede.agenciatributaria.gob.es/Sede/en_gb/", kind: "authority", priority: 1 },
    ],
    documents: [],
    banking: [],
    cultural: [],
    cost: [],
    housing: [],
    pet: [],
    departure_tax: [],
    transport_id: [],
  },

  // ---- United Kingdom ----------------------------------------------
  GB: {
    visa: [
      { url: "https://www.gov.uk/browse/visas-immigration", kind: "authority", priority: 1 },
    ],
    registration: [
      { url: "https://www.gov.uk/", kind: "authority", priority: 1 },
    ],
    healthcare: [
      { url: "https://www.nhs.uk/", kind: "institution", priority: 1 },
    ],
    tax: [
      { url: "https://www.gov.uk/government/organisations/hm-revenue-customs", kind: "authority", priority: 1 },
    ],
    documents: [],
    banking: [],
    cultural: [],
    cost: [],
    housing: [],
    pet: [],
    departure_tax: [],
    transport_id: [],
  },

  // ---- United States -----------------------------------------------
  US: {
    visa: [
      { url: "https://travel.state.gov/content/travel/en/us-visas.html", kind: "authority", priority: 1 },
      { url: "https://www.uscis.gov/", kind: "authority", priority: 2 },
    ],
    registration: [],
    healthcare: [
      { url: "https://www.healthcare.gov/", kind: "institution", priority: 1 },
    ],
    tax: [
      { url: "https://www.irs.gov/", kind: "authority", priority: 1 },
    ],
    documents: [],
    banking: [],
    cultural: [],
    cost: [],
    housing: [],
    pet: [],
    departure_tax: [],
    transport_id: [],
  },
};

// ---- Country-name aliases --------------------------------------------
// Specialists receive `destination` as a free-form country name from
// the profile (e.g. "Sweden", "United States", "uk"). Map these to the
// ISO code used as the registry key.

const NAME_TO_ISO: Record<string, string> = {
  sweden: "SE",
  germany: "DE",
  japan: "JP",
  portugal: "PT",
  netherlands: "NL",
  "the netherlands": "NL",
  spain: "ES",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  britain: "GB",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  us: "US",
};

function inferDomainFromUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Resolve a free-form country name (or ISO code) to the registry's
 * canonical ISO key. Returns null when the country is unknown.
 */
export function toCountryCode(country: string | null | undefined): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (!trimmed) return null;
  // Already a 2-letter code?
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  // Try alias map first (handles common variants).
  const alias = NAME_TO_ISO[trimmed.toLowerCase()];
  if (alias) return alias;
  // Fall back through the package's own normaliser (handles
  // "Sverige" → "Sweden", etc.).
  const normalised = normalizeCountryName(trimmed);
  if (normalised && NAME_TO_ISO[normalised.toLowerCase()]) {
    return NAME_TO_ISO[normalised.toLowerCase()];
  }
  return null;
}

/**
 * Return the registered sources for a given (country, domain),
 * sorted by priority. Empty array when nothing is registered yet
 * (specialist falls back to whitelist search).
 */
export function getRegisteredSources(
  country: string | null | undefined,
  domain: SpecialistDomain,
): RegisteredSource[] {
  const iso = toCountryCode(country);
  if (!iso) return [];
  const country_sources = REGISTRY[iso];
  if (!country_sources) return [];
  const list = country_sources[domain];
  if (!list || list.length === 0) return [];
  // Fill the bare host when a registry entry omitted it, then sort.
  return [...list]
    .map((s) => ({ ...s, domain: s.domain ?? inferDomainFromUrl(s.url) }))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Whitelist guard — true when a URL's host appears in the registry
 * for ANY domain of the given country. Useful for specialists that
 * scrape free-form search results and want to drop non-official
 * domains before LLM extraction.
 */
export function isRegisteredHost(
  country: string | null | undefined,
  url: string,
): boolean {
  const iso = toCountryCode(country);
  if (!iso) return false;
  const host = inferDomainFromUrl(url);
  if (!host) return false;
  const country_sources = REGISTRY[iso];
  if (!country_sources) return false;
  for (const list of Object.values(country_sources)) {
    if (!list) continue;
    for (const entry of list) {
      const entryHost = entry.domain ?? inferDomainFromUrl(entry.url);
      if (entryHost && host === entryHost) return true;
    }
  }
  return false;
}

/** Exported for tests + a future "registry coverage" debug page. */
export { REGISTRY };
