/**
 * Sample SpecialistOutput payloads for the /dev/specialist-cards preview
 * page. Shapes mirror lib/agents/src/specialists/<name>.ts key_facts.
 */

import type {
  SchoolsOutput,
  PetOutput,
  IncomeComplianceOutput,
  FamilyReunionOutput,
  DepartureTaxOutput,
  VehicleImportOutput,
  PropertyPurchaseOutput,
  PostedWorkerOutput,
  TrailingSpouseOutput,
  HealthcareOutput,
  PriorVisaHistoryData,
} from "@/lib/gomate/specialist-types"

const NOW = new Date().toISOString()

const baseFields = {
  citations: [
    {
      url: "https://example.gov/source-1",
      label: "Official source — primary authority",
      note: "Used for thresholds + deadlines",
      scraped: true,
    },
    {
      url: "https://example.gov/source-2",
      label: "Secondary regulatory portal",
      scraped: true,
    },
  ],
  sourceUrlsUsed: ["https://example.gov/source-1", "https://example.gov/source-2"],
  retrievedAt: NOW,
  quality: "full" as const,
  confidence: "high" as const,
  wallClockMs: 5400,
  tokensUsed: 1820,
  modelUsed: "claude-sonnet-4-6",
}

export const sampleSchools: SchoolsOutput = {
  ...baseFields,
  specialist: "schools_specialist",
  contentParagraphs: [
    "Berlin runs a tiered school system: free state Grundschulen for ages 6–10, then Gymnasien (academic), Realschulen (vocational-academic), and Hauptschulen. International families typically pick a fee-paying international school for continuity if they expect to leave within 2–4 years.",
    "Per child, we’ve shortlisted 3 schools matched to their age, language ability, and your stated preference for international IB schooling.",
  ],
  domainSpecificData: {
    system_overview:
      "Public schools are free but lessons are in German. International schools teach in English/IB and have 6–12mo waitlists.",
    average_intl_school_fee_range_eur: { low: 14000, high: 26000 },
    children_recommendations: [
      {
        child_label: "Child age 7",
        schools: [
          {
            name: "Berlin International School (BIS)",
            type: "international",
            language: "English",
            approx_fee_eur_year: 19500,
            application_lead_months: 9,
            waitlist_likely: true,
            url: "https://example.gov/bis",
          },
          {
            name: "John F. Kennedy School",
            type: "bilingual",
            language: "German/English",
            approx_fee_eur_year: 0,
            application_lead_months: 12,
            waitlist_likely: true,
            url: null,
          },
          {
            name: "Quentin-Blake-Grundschule",
            type: "public",
            language: "German",
            approx_fee_eur_year: null,
            application_lead_months: 3,
            waitlist_likely: false,
            url: null,
          },
        ],
      },
      {
        child_label: "Child age 12",
        schools: [
          {
            name: "Berlin Metropolitan School",
            type: "international",
            language: "English (IB)",
            approx_fee_eur_year: 22500,
            application_lead_months: 9,
            waitlist_likely: true,
            url: "https://example.gov/bms",
          },
        ],
      },
    ],
    warnings: [
      "Public Gymnasium admission depends on Grade-4 transition exam — start preparing 6mo ahead.",
    ],
  },
}

export const samplePet: PetOutput = {
  ...baseFields,
  specialist: "pet_specialist",
  contentParagraphs: [
    "Bringing a dog into the EU from the US is a non-commercial movement under Reg. (EU) 576/2013. You need ISO microchip, rabies vaccination ≥21 days old, and a USDA APHIS endorsement issued within 10 days of travel.",
    "Your terrier is not on Germany’s restricted-breed list, but Berlin still requires registration and a dog-tax (Hundesteuer) payment within 14 days of arrival.",
  ],
  domainSpecificData: {
    import_requirements: [
      "Microchip ISO 11784/11785",
      "Rabies vaccine ≥21 days, ≤1 year old",
      "USDA APHIS-endorsed health certificate (10-day window)",
      "EU Annex IV declaration from owner",
    ],
    vaccination_timeline: [
      { step: "Microchip", lead_days: 90, notes: "Must be implanted before rabies vaccine" },
      { step: "Rabies vaccine", lead_days: 21, notes: "Minimum 21 days before travel" },
      { step: "USDA APHIS endorsement", lead_days: 10, notes: "Within 10 days of arrival" },
    ],
    breed_restrictions: {
      applies_to_user_pet: false,
      restricted_breeds: ["Pit bull terrier", "American Staffordshire", "Bull terrier"],
    },
    import_permit: {
      required: false,
      authority: "BVL (Federal Office of Consumer Protection)",
      url: "https://example.gov/bvl",
      lead_days: null,
    },
    quarantine_rules: {
      required: false,
      duration_days: null,
      notes: "No quarantine for compliant pets from rabies-controlled countries.",
    },
    warnings: ["Cabin transport for dogs >8kg is rare — book hold cargo well in advance."],
  },
}

export const sampleIncome: IncomeComplianceOutput = {
  ...baseFields,
  specialist: "digital_nomad_compliance_specialist",
  contentParagraphs: [
    "Portugal’s D8 Digital Nomad Visa requires proof of remote income ≥ 4× the national minimum wage, currently €3,480/month gross.",
    "Your stated income of €5,200/mo qualifies. Expect tax-residency in Portugal once you spend 183 days there in any rolling 12-month window.",
  ],
  domainSpecificData: {
    visa_name: "D8 — Digital Nomad Residence Visa",
    issuing_authority: "AIMA (Agência para a Integração, Migrações e Asilo)",
    income_threshold_eur_month: 3480,
    user_income_eur_month: 5200,
    income_qualifies: true,
    tax_residency_implications:
      "Tax-resident after 183 days/yr. Eligible for the new IFICI regime (10yr, 20% flat on Portuguese-source qualifying income).",
    visa_validity_months: 24,
    renewal_possible: true,
    warnings: [
      "Cannot work for Portuguese employers under D8 — only foreign-source income qualifies.",
    ],
  },
}

export const sampleFamilyReunion: FamilyReunionOutput = {
  ...baseFields,
  specialist: "family_reunion_specialist",
  contentParagraphs: [
    "As the spouse of an EU Blue Card holder, you qualify for Germany’s Familiennachzug zu Erwerbstätigen (§30 AufenthG).",
    "Sponsor income must cover the family without state support — the threshold rises with each dependent. After 3 years you gain an independent residence permit.",
  ],
  domainSpecificData: {
    route_name: "Familiennachzug zu Erwerbstätigen (§30 AufenthG)",
    sponsor_income_threshold_eur_month: 3200,
    accommodation_required: true,
    marriage_certificate_required: true,
    fiance_route_available: false,
    integration_test_required: false,
    processing_weeks: 10,
    dependent_can_work: true,
    independence_after_years: 3,
    warnings: [
      "Marriage certificate must be apostilled; Polish/Russian/Ukrainian docs need a sworn translation in DE.",
    ],
  },
}

export const sampleDepartureTax: DepartureTaxOutput = {
  ...baseFields,
  specialist: "departure_tax_specialist",
  contentParagraphs: [
    "Germany’s Wegzugsbesteuerung (§6 AStG) deems a sale of substantial company shareholdings (≥1%) on departure if you’ve been resident ≥7 of the last 12 years.",
    "Crypto and listed securities are not in scope; private real estate isn’t either. Your DE→PT corridor benefits from the 2017 treaty — capital-gains relief is available with proof of new residency.",
  ],
  domainSpecificData: {
    origin: "Germany",
    exit_tax_applies: true,
    asset_threshold_eur: 500000,
    residency_years_threshold: 7,
    capital_gains_trigger: "deemed_disposal",
    pension_treatment:
      "Public Rente accrues normally — taxed in Portugal as residency income under the treaty.",
    filing_form: "Anlage AESt (with annual return)",
    filing_deadline_relative_to_departure: "By 31 July following the year of departure",
    treaty_with_destination_exists: true,
    professional_advice_recommended: true,
    warnings: [
      "Spread sale across ≥2 years before departure to use Verlustrücktrag for any capital losses.",
    ],
  },
}

export const sampleVehicle: VehicleImportOutput = {
  ...baseFields,
  specialist: "vehicle_import_specialist",
  contentParagraphs: [
    "Importing your 2018 VW Tiguan from the US into Germany triggers 10% customs duty + 19% VAT on the customs value, unless you qualify for the returning-resident exemption (≥6mo prior ownership + ≥12mo prior residency abroad).",
    "Tiguan models from 2018 meet Euro 6d-TEMP and pass the Hauptuntersuchung straight away. You have 6 months from arrival to register at the Zulassungsstelle.",
  ],
  domainSpecificData: {
    import_duty_estimate_pct: 10,
    vat_applies: true,
    vat_rate_pct: 19,
    emissions_compliant: true,
    emissions_notes: "Euro 6d-TEMP — no retrofit required. Diesel still allowed in most Umweltzonen.",
    customs_form: "ATLAS-IMPOST (electronic customs declaration)",
    registration_authority: "Kfz-Zulassungsstelle (local district office)",
    technical_inspection_required: true,
    conformity_certificate_required: true,
    deadline_after_arrival_days: 180,
    warnings: ["EU CoC from VW is needed — request it before shipping; can take 4–6 weeks."],
  },
}

export const sampleProperty: PropertyPurchaseOutput = {
  ...baseFields,
  specialist: "property_purchase_specialist",
  contentParagraphs: [
    "Foreigners can buy property freely in Portugal — there are no nationality restrictions, though the Golden Visa real-estate route ended in 2023.",
    "Non-resident mortgages cap at 70% LTV, with 30% deposit + closing costs (IMT + stamp + notary ≈ 8% on a €400k purchase). The conveyancing process takes 8–12 weeks.",
  ],
  domainSpecificData: {
    foreigner_purchase_rules: "free",
    permit_authority: null,
    mortgage_available_to_non_residents: true,
    max_ltv_pct_non_resident: 70,
    transaction_tax_pct_total: 8,
    stamp_duty_pct: 0.8,
    transfer_tax_pct: 6,
    typical_process_weeks: 10,
    warnings: [
      "Always sign through a Portuguese notary — never directly with a developer in foreign currency.",
    ],
  },
}

export const samplePostedWorker: PostedWorkerOutput = {
  ...baseFields,
  specialist: "posted_worker_specialist",
  contentParagraphs: [
    "You’re being posted from a French employer to a German project — this falls under EU posted-worker rules. Your employer must obtain an A1 certificate (CLEISS/URSSAF) keeping you in French social-security, AND file a German PWD via ZOLL before you start work.",
    "Validity is up to 24 months under standard A1 rules; extensions need an Art. 16 derogation. A resident contact person in DE is mandatory.",
  ],
  domainSpecificData: {
    framework: "EU_A1",
    a1_or_coc_path: {
      issued_by: "URSSAF / CLEISS (France)",
      applied_by: "employer",
      lead_weeks: 4,
      max_validity_months: 24,
      url: "https://example.gov/cleiss-a1",
    },
    pwd_filing: {
      destination_authority: "ZOLL — Mindestlohn-Meldeportal",
      deadline_relative_to_start: "Before the first day of work",
      url: "https://example.gov/zoll-pwd",
    },
    employer_registration_required: true,
    contact_person_requirement: { required: true, must_be_resident: true },
    social_security_rules: { duration_cap_months: 24, extension_possible: true },
    warnings: [
      "Failure to file PWD on time triggers fines up to €30,000 per worker under MiLoG.",
    ],
  },
}

export const sampleTrailingSpouse: TrailingSpouseOutput = {
  ...baseFields,
  specialist: "trailing_spouse_career_specialist",
  contentParagraphs: [
    "Berlin’s tech and design scene is one of Europe’s most expat-friendly hiring markets — UX designers with English-only work portfolios routinely land roles within 3–4 months. Your dependent permit (Familiennachzug) includes unrestricted work rights from day one.",
    "Network through Rocket Internet alumni, SheCodes Berlin, and the IxDA Berlin chapter; recruiters at Honeypot and Talent.io specialise in placing English-speakers.",
  ],
  domainSpecificData: {
    field_demand_assessment: "high",
    dependent_can_work: true,
    separate_work_permit_required: false,
    language_requirement_for_field: "English-only roles common in product/tech; B1 German useful for agency work.",
    credential_recognition_needed: false,
    credential_recognition_authority: null,
    top_job_platforms: [
      { name: "Honeypot", url: "https://example.com/honeypot" },
      { name: "Talent.io", url: "https://example.com/talent" },
      { name: "LinkedIn DE", url: "https://example.com/linkedin-de" },
    ],
    professional_associations: [
      { name: "IxDA Berlin", url: "https://example.com/ixda" },
      { name: "UX Berlin Meetup", url: null },
    ],
    warnings: [
      "Salaries in design are ~25% below US benchmarks — calibrate offers vs cost-of-living.",
    ],
  },
}

export const sampleChronicHealth: HealthcareOutput = {
  ...baseFields,
  specialist: "healthcare_navigator",
  contentParagraphs: [
    "For Type 1 diabetes, Germany’s GKV (statutory insurance) covers insulin pumps, CGMs, and quarterly endocrinologist visits at near-zero out-of-pocket cost. Your US prescription brands (Humalog, Dexcom G7) are all available.",
    "Berlin has 4 endocrinology centres with English-speaking staff. The DRK (Red Cross) clinic in Westend accepts new patients within 2 weeks.",
  ],
  domainSpecificData: {
    registration_steps: [
      "Anmeldung within 14 days of arrival",
      "Choose a Krankenkasse (TK, AOK, BARMER) and enrol",
      "Receive eGK card",
      "Register with Hausarzt",
      "Get referral to endocrinologist",
    ],
    insurance_options: [
      { name: "Techniker Krankenkasse (TK)", type: "public", approx_monthly_eur: 480 },
      { name: "AOK Berlin", type: "public", approx_monthly_eur: 470 },
      { name: "Allianz Private", type: "private", approx_monthly_eur: 620 },
    ],
    recommended_providers: [
      {
        name: "Diabeteszentrum am Westend",
        city: "Berlin",
        english_speaking: true,
        url: "https://example.com/diabeteszentrum",
      },
      {
        name: "Charité Endokrinologie",
        city: "Berlin",
        english_speaking: true,
        url: "https://example.com/charite",
      },
    ],
    prescription_continuity: {
      applicable: true,
      notes:
        "All your medications are on the EU formulary. Bring 90-day supply + a translated doctor’s letter for the first GP visit.",
    },
    warnings: [
      "CGM sensors are GKV-covered but require a one-time application via your endocrinologist.",
    ],
  },
}

export const samplePriorVisaHistory: PriorVisaHistoryData = {
  visa_rejections: "yes",
  prior_visa_countries: "United Kingdom, Canada, Schengen (Spain)",
  prior_visa_types: "Tier 2 Skilled Worker (UK), Express Entry (CA, withdrawn), Schengen tourist",
  rejection_details:
    "2019 UK Tier 4 student visa refused for insufficient maintenance funds. Subsequently approved on appeal with updated bank statements.",
}
