// Country → primary native language(s) mapping.
// Used by the onboarding wizard to pre-populate language suggestions
// based on the user's citizenship and current_location.
//
// Multiple languages per country are returned for officially-bilingual
// countries (Belgium, Switzerland, Canada, etc). The wizard treats the
// first entry as the most-likely default and offers the rest as picks.

export const COUNTRY_TO_NATIVE_LANGUAGES: Record<string, string[]> = {
  // Europe
  germany: ["German"],
  france: ["French"],
  spain: ["Spanish"],
  italy: ["Italian"],
  netherlands: ["Dutch"],
  belgium: ["Dutch", "French", "German"],
  austria: ["German"],
  switzerland: ["German", "French", "Italian"],
  sweden: ["Swedish"],
  norway: ["Norwegian"],
  denmark: ["Danish"],
  finland: ["Finnish", "Swedish"],
  ireland: ["English", "Irish"],
  portugal: ["Portuguese"],
  greece: ["Greek"],
  poland: ["Polish"],
  "czech republic": ["Czech"],
  czechia: ["Czech"],
  hungary: ["Hungarian"],
  romania: ["Romanian"],
  bulgaria: ["Bulgarian"],
  croatia: ["Croatian"],
  slovakia: ["Slovak"],
  slovenia: ["Slovenian"],
  estonia: ["Estonian"],
  latvia: ["Latvian"],
  lithuania: ["Lithuanian"],
  luxembourg: ["French", "German", "Luxembourgish"],
  malta: ["Maltese", "English"],
  cyprus: ["Greek", "Turkish"],
  iceland: ["Icelandic"],
  "united kingdom": ["English"],
  uk: ["English"],

  // Americas
  "united states": ["English"],
  usa: ["English"],
  canada: ["English", "French"],
  mexico: ["Spanish"],
  brazil: ["Portuguese"],
  argentina: ["Spanish"],
  chile: ["Spanish"],
  colombia: ["Spanish"],
  peru: ["Spanish"],
  uruguay: ["Spanish"],
  "costa rica": ["Spanish"],
  panama: ["Spanish"],

  // Asia / Oceania
  japan: ["Japanese"],
  "south korea": ["Korean"],
  korea: ["Korean"],
  china: ["Chinese (Mandarin)"],
  taiwan: ["Chinese (Mandarin)"],
  "hong kong": ["Chinese (Cantonese)", "English"],
  singapore: ["English", "Chinese (Mandarin)", "Malay"],
  thailand: ["Thai"],
  vietnam: ["Vietnamese"],
  indonesia: ["Indonesian"],
  malaysia: ["Malay", "English"],
  philippines: ["Filipino", "English"],
  india: ["Hindi", "English"],
  australia: ["English"],
  "new zealand": ["English"],

  // Middle East / Africa
  "united arab emirates": ["Arabic", "English"],
  uae: ["Arabic", "English"],
  "saudi arabia": ["Arabic"],
  qatar: ["Arabic", "English"],
  israel: ["Hebrew", "English"],
  turkey: ["Turkish"],
  egypt: ["Arabic"],
  morocco: ["Arabic", "French"],
  "south africa": ["English", "Afrikaans"],
  kenya: ["English", "Swahili"],
  nigeria: ["English"],
}

const normalize = (country: string) => country.trim().toLowerCase()

/**
 * Returns the native language(s) for a given country, or [] if unknown.
 * Pass either the canonical key ("sweden") or the display form ("Sweden") —
 * matching is case-insensitive.
 */
export function getNativeLanguages(country: string | null | undefined): string[] {
  if (!country) return []
  return COUNTRY_TO_NATIVE_LANGUAGES[normalize(country)] ?? []
}
