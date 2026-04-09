/**
 * Guide Generator Service
 * 
 * Generates comprehensive relocation guides based on user profile data.
 * Each guide contains sections for visa, budget, housing, banking,
 * healthcare, culture, jobs/education, timeline, and checklist.
 */

import type { Profile } from "./profile-schema"
import { getCostOfLivingData, calculateMonthlyBudget, calculateSavingsTarget } from "./web-research"
import type { CostOfLivingData } from "./web-research"
import { generateVisaRecommendation } from "./profile-summary"
import { getOfficialSourcesArray } from "./official-sources"
import { getVisaStatus } from "./visa-checker"
import { getCurrencyFromCountry, getCurrencySymbol } from "./currency"
import { enrichGuide } from "./guide-enrichment"
import { getExchangeRate } from "./exchange-rate"

// Guide section types
export interface GuideOverview {
  title: string
  subtitle: string
  summary: string
  keyFacts: { label: string; value: string }[]
  lastUpdated: string
}

export interface VisaSection {
  recommendedVisa: string
  visaType: string
  eligibility: string
  processingTime: string
  estimatedCost: string
  requirements: string[]
  applicationSteps: string[]
  tips: string[]
  warnings: string[]
  officialLink?: string
  detailedProcess?: string
}

export interface BudgetSection {
  monthlyBudget: {
    minimum: number
    comfortable: number
    breakdown: Record<string, number>
  }
  savingsTarget: {
    emergencyFund: number
    movingCosts: number
    initialSetup: number
    visaFees: number
    total: number
    timeline: string
  }
  costComparison?: string
  savingStrategy?: string
  tips: string[]
}

export interface HousingSection {
  overview: string
  averageRent: { studio: string; oneBed: string; twoBed: string }
  popularAreas: { name: string; description: string; priceLevel: string }[]
  rentalPlatforms: { name: string; url: string; description: string }[]
  depositInfo: string
  tips: string[]
  warnings: string[]
  neighborhoodGuide?: string
  rentalProcess?: string
}

export interface BankingSection {
  overview: string
  recommendedBanks: { name: string; type: string; features: string[]; url?: string }[]
  requirements: string[]
  digitalBanks: { name: string; features: string[] }[]
  tips: string[]
  accountOpeningGuide?: string
}

export interface HealthcareSection {
  overview: string
  systemType: string
  insuranceRequirements: string
  registrationSteps: string[]
  emergencyInfo: string
  recommendedProviders: string[]
  tips: string[]
  registrationGuide?: string
  insuranceAdvice?: string
}

export interface CultureSection {
  overview: string
  language: { official: string; englishLevel: string; learningTips: string[] }
  socialNorms: string[]
  workCulture: string[]
  doAndDonts: { dos: string[]; donts: string[] }
  localTips: string[]
  deepDive?: string
  workplaceCulture?: string
  socialIntegration?: string
}

export interface JobsSection {
  overview: string
  jobMarket: string
  inDemandSkills: string[]
  jobPlatforms: { name: string; url: string; description: string }[]
  salaryExpectations: string
  workPermitInfo: string
  networkingTips: string[]
  marketOverview?: string
  searchStrategy?: string
}

export interface EducationSection {
  overview: string
  systemType: string
  popularInstitutions: { name: string; type: string; ranking?: string }[]
  applicationProcess: string[]
  tuitionInfo: string
  scholarships: string[]
  tips: string[]
  systemOverview?: string
  applicationStrategy?: string
}

export interface NightlifeSection {
  overview: string
  bestAreas: { name: string; vibe: string; priceLevel: string }[]
  popularVenues: { name: string; type: string; description: string }[]
  legalInfo: { drinkingAge: number; closingTime: string; smokingRules: string }
  datingScene: string
  lgbtqFriendly: string
  tips: string[]
}

export interface SafetySection {
  overview: string
  safetyRating: string // e.g., "Very Safe", "Generally Safe", etc.
  crimeLevel: string
  areasToAvoid: string[]
  emergencyNumbers: { police: string; ambulance: string; fire: string; general: string }
  commonScams: string[]
  naturalDisasters: string[]
  womenSafety: string
  lgbtqSafety: string
  tips: string[]
}

export interface ExpatCommunitySection {
  overview: string
  expatPopulation: string
  mainNationalities: string[]
  communities: { name: string; type: string; url?: string; description: string }[]
  socialGroups: { name: string; platform: string; focus: string }[]
  networking: string[]
  expatHubs: { area: string; description: string }[]
  tips: string[]
}

export interface TransportSection {
  overview: string
  publicTransport: { type: string; coverage: string; monthlyPass: string }[]
  apps: { name: string; description: string }[]
  drivingInfo: string
  cyclingInfo: string
  rideshare: { name: string; availability: string }[]
  tips: string[]
}

export interface FoodSection {
  overview: string
  localCuisine: string[]
  groceryStores: { name: string; type: string; priceLevel: string }[]
  foodDelivery: { name: string; description: string }[]
  dietaryOptions: { vegetarian: string; vegan: string; halal: string; kosher: string }
  tipping: string
  tips: string[]
}

export interface TimelineSection {
  totalMonths: number
  overview?: string
  phases: {
    name: string
    duration: string
    tasks: string[]
    tips: string[]
  }[]
}

export interface ChecklistSection {
  categories: {
    name: string
    items: { task: string; priority: "high" | "medium" | "low"; timeframe: string }[]
  }[]
}

export interface Guide {
  id?: string
  title: string
  destination: string
  destinationCity?: string
  purpose: string
  currency: string
  overview: GuideOverview
  visa: VisaSection
  budget: BudgetSection
  housing: HousingSection
  banking: BankingSection
  healthcare: HealthcareSection
  culture: CultureSection
  jobs?: JobsSection
  education?: EducationSection
  nightlife?: NightlifeSection
  safety?: SafetySection
  expatCommunity?: ExpatCommunitySection
  transport?: TransportSection
  food?: FoodSection
  timeline: TimelineSection
  checklist: ChecklistSection
  officialLinks: { name: string; url: string; category: string }[]
  usefulTips: string[]
  createdAt: string
  status: "draft" | "generating" | "complete"
}

// Country-specific data for guide generation
export const COUNTRY_DATA: Record<string, {
  currency: string
  language: string
  englishLevel: string
  healthcareSystem: string
  bankingNotes: string
  cultureTips: string[]
  popularBanks: { name: string; type: string; features: string[] }[]
  rentalPlatforms: { name: string; url: string; description: string }[]
  jobPlatforms: { name: string; url: string; description: string }[]
  nightlife?: {
    overview: string
    bestAreas: { name: string; vibe: string; priceLevel: string }[]
    legalInfo: { drinkingAge: number; closingTime: string; smokingRules: string }
    lgbtqFriendly: string
  }
  safety?: {
    rating: string
    crimeLevel: string
    emergencyNumbers: { police: string; ambulance: string; fire: string; general: string }
    commonScams: string[]
    womenSafety: string
    lgbtqSafety: string
  }
  expatCommunity?: {
    population: string
    mainNationalities: string[]
    communities: { name: string; type: string; url?: string; description: string }[]
    expatHubs: { area: string; description: string }[]
  }
  transport?: {
    publicTransport: { type: string; coverage: string; monthlyPass: string }[]
    apps: { name: string; description: string }[]
    cycling: string
  }
  food?: {
    localCuisine: string[]
    groceryStores: { name: string; type: string; priceLevel: string }[]
    tipping: string
  }
  taxInfo?: {
    incomeTaxBrackets: { upTo: number | null; rate: number }[]
    socialContributions: string
    specialRegimes?: { name: string; summary: string; eligibility: string }[]
    taxYear: string
    filingDeadline: string
    disclaimer: string
    officialLink: string
    lastVerified: string
  }
  commonlyForgotten?: {
    item: string
    why: string
    when: "before_move" | "first_week" | "first_month" | "ongoing"
    applies_to?: string[] | null
    lastVerified: string
  }[]
}> = {
  Germany: {
    currency: "EUR",
    language: "German",
    englishLevel: "Moderate in cities, lower elsewhere",
    healthcareSystem: "Statutory health insurance (Gesetzliche Krankenversicherung)",
    bankingNotes: "Schufa credit score is important. Many landlords require it.",
    cultureTips: [
      "Punctuality is highly valued - arrive on time or early",
      "Cash is still widely used, always carry some",
      "Sundays are quiet - most shops are closed",
      "Recycling is taken seriously with a deposit system (Pfand)",
      "Direct communication style is normal, not rude",
    ],
    popularBanks: [
      { name: "N26", type: "Digital", features: ["Free basic account", "English app", "Quick setup"] },
      { name: "DKB", type: "Traditional/Online", features: ["Free account", "Good for expats", "Visa card"] },
      { name: "Commerzbank", type: "Traditional", features: ["Branch network", "English support"] },
    ],
    rentalPlatforms: [
      { name: "ImmobilienScout24", url: "https://www.immobilienscout24.de", description: "Largest rental platform" },
      { name: "WG-Gesucht", url: "https://www.wg-gesucht.de", description: "Shared apartments (WGs)" },
      { name: "eBay Kleinanzeigen", url: "https://www.kleinanzeigen.de", description: "Classified ads, direct rentals" },
    ],
    jobPlatforms: [
      { name: "StepStone", url: "https://www.stepstone.de", description: "Major job board" },
      { name: "Indeed Germany", url: "https://de.indeed.com", description: "International job board" },
      { name: "LinkedIn", url: "https://www.linkedin.com", description: "Professional networking" },
      { name: "XING", url: "https://www.xing.com", description: "German professional network" },
    ],
    nightlife: {
      overview: "Germany has a vibrant nightlife scene, especially in Berlin which is world-famous for its techno clubs. Cities like Munich, Hamburg, and Cologne also offer diverse options from beer halls to modern clubs.",
      bestAreas: [
        { name: "Berlin - Kreuzberg/Friedrichshain", vibe: "Alternative, techno, diverse crowds", priceLevel: "€€" },
        { name: "Berlin - Mitte", vibe: "Upscale bars, cocktail lounges", priceLevel: "€€€" },
        { name: "Munich - Schwabing", vibe: "Traditional pubs, trendy bars", priceLevel: "€€€" },
        { name: "Hamburg - Reeperbahn", vibe: "Famous party street, diverse venues", priceLevel: "€€" },
      ],
      legalInfo: { drinkingAge: 16, closingTime: "No legal closing time in Berlin", smokingRules: "Banned indoors, varies by state" },
      lgbtqFriendly: "Very LGBTQ+ friendly, especially Berlin. Schöneberg in Berlin is a famous gay neighborhood.",
    },
    safety: {
      rating: "Very Safe",
      crimeLevel: "Low crime rate, petty theft in tourist areas",
      emergencyNumbers: { police: "110", ambulance: "112", fire: "112", general: "112" },
      commonScams: ["Fake petition signers", "Shell games near tourist spots", "Overcharging taxis"],
      womenSafety: "Generally very safe for women. Well-lit streets and reliable public transport.",
      lgbtqSafety: "Very safe and accepting, especially in major cities. Legal protections in place.",
    },
    expatCommunity: {
      population: "~13 million foreigners (15% of population)",
      mainNationalities: ["Turkish", "Polish", "Syrian", "Romanian", "Italian", "American"],
      communities: [
        { name: "InterNations Germany", type: "Network", url: "https://www.internations.org/germany-expats", description: "Global expat community with local events" },
        { name: "Toytown Germany", type: "Forum", url: "https://www.toytowngermany.com", description: "English-speaking expat forum" },
        { name: "Facebook Expat Groups", type: "Social", description: "City-specific groups like 'Expats in Berlin'" },
      ],
      expatHubs: [
        { area: "Berlin - Prenzlauer Berg", description: "Popular with young professionals and families" },
        { area: "Munich - Maxvorstadt", description: "International crowd near universities" },
        { area: "Frankfurt - Westend", description: "Finance professionals and families" },
      ],
    },
    transport: {
      publicTransport: [
        { type: "U-Bahn/S-Bahn", coverage: "Excellent in cities", monthlyPass: "€49 (Deutschland-Ticket)" },
        { type: "Regional trains", coverage: "Good nationwide", monthlyPass: "Included in €49 ticket" },
        { type: "Buses/Trams", coverage: "Comprehensive", monthlyPass: "Included in city pass" },
      ],
      apps: [
        { name: "DB Navigator", description: "Official Deutsche Bahn app for trains" },
        { name: "BVG/MVV apps", description: "City-specific transit apps" },
      ],
      cycling: "Excellent cycling infrastructure, especially in Berlin and Munich. Bike-sharing widely available.",
    },
    food: {
      localCuisine: ["Bratwurst", "Schnitzel", "Currywurst", "Pretzels", "Döner Kebab", "Spätzle"],
      groceryStores: [
        { name: "Aldi/Lidl", type: "Discount", priceLevel: "€" },
        { name: "REWE/Edeka", type: "Standard", priceLevel: "€€" },
        { name: "Bio Company", type: "Organic", priceLevel: "€€€" },
      ],
      tipping: "5-10% is customary, often just round up the bill",
    },
    taxInfo: {
      incomeTaxBrackets: [
        { upTo: 38441, rate: 0.3697 },
        { upTo: 75518, rate: 0.3697 },
        { upTo: null, rate: 0.4195 },
      ],
      socialContributions: "Social contributions (~18%) are included in the first bracket rate. Employer also pays ~20% on top of gross salary.",
      specialRegimes: [],
      taxYear: "Jan–Dec",
      filingDeadline: "31 July of the following year",
      disclaimer: "Rates are for 2025 employee income tax (Einkommensteuer). Solidarity surcharge (5.5% of tax) applies above thresholds. Church tax (8-9%) may apply. Self-employed rates differ.",
      officialLink: "https://www.bzst.de",
      lastVerified: "2025-03-01",
    },
    commonlyForgotten: [
      { item: "Anmeldung (address registration) within 14 days", why: "Legally required within 14 days of moving in. Without it you cannot open a bank account, get health insurance, or receive your tax ID.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Rundfunkbeitrag (broadcasting fee)", why: "Every household must pay ~€18.36/month for public broadcasting. You will receive a letter — ignoring it leads to fines.", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Liability insurance (Haftpflichtversicherung)", why: "Not legally required but culturally expected. Covers accidental damage to others' property. Landlords often ask for proof.", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Deregister from your home country", why: "Many countries require formal deregistration. Failing to do so can cause tax residency complications and double taxation.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
      { item: "SCHUFA credit history", why: "Germany's credit scoring system. Without a SCHUFA record, renting an apartment is very difficult. Start building it early by opening a German bank account.", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Garbage separation rules (Mülltrennung)", why: "Germany has strict recycling rules with separate bins for paper, packaging, bio, glass, and residual waste. Incorrect sorting can result in fines from your landlord.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
    ],
  },
  Netherlands: {
    currency: "EUR",
    language: "Dutch",
    englishLevel: "Very high, widely spoken",
    healthcareSystem: "Mandatory private insurance (Zorgverzekering)",
    bankingNotes: "BSN (citizen service number) required to open most accounts.",
    cultureTips: [
      "Cycling is the main transport - learn the rules",
      "Dutch directness is cultural, not rudeness",
      "Split bills are common (going Dutch)",
      "Appointments are sacred - always be on time",
      "Gezelligheid (coziness/togetherness) is valued",
    ],
    popularBanks: [
      { name: "ING", type: "Traditional", features: ["English support", "Good app", "Widely accepted"] },
      { name: "ABN AMRO", type: "Traditional", features: ["Expat services", "English support"] },
      { name: "Bunq", type: "Digital", features: ["No BSN needed initially", "English app", "Quick setup"] },
    ],
    rentalPlatforms: [
      { name: "Funda", url: "https://www.funda.nl", description: "Main rental and buying platform" },
      { name: "Pararius", url: "https://www.pararius.com", description: "Expat-friendly, English available" },
      { name: "Kamernet", url: "https://www.kamernet.nl", description: "Rooms and shared housing" },
    ],
    jobPlatforms: [
      { name: "Indeed NL", url: "https://www.indeed.nl", description: "Major job board" },
      { name: "LinkedIn", url: "https://www.linkedin.com", description: "Professional networking" },
      { name: "Glassdoor", url: "https://www.glassdoor.nl", description: "Jobs with company reviews" },
    ],
    nightlife: {
      overview: "The Netherlands has a diverse nightlife scene from Amsterdam's famous clubs to cozy brown cafes. Rotterdam has an emerging electronic music scene, while Utrecht and The Hague offer laid-back options.",
      bestAreas: [
        { name: "Amsterdam - Leidseplein", vibe: "Tourist-friendly, clubs and bars", priceLevel: "€€€" },
        { name: "Amsterdam - De Pijp", vibe: "Trendy, local crowd", priceLevel: "€€" },
        { name: "Rotterdam - Witte de Withstraat", vibe: "Hip, artistic, diverse", priceLevel: "€€" },
      ],
      legalInfo: { drinkingAge: 18, closingTime: "Varies, many clubs until 4-5 AM", smokingRules: "Tobacco banned indoors, cannabis in licensed coffee shops" },
      lgbtqFriendly: "One of the most LGBTQ+ friendly countries. Amsterdam has vibrant gay scene around Reguliersdwarsstraat.",
    },
    safety: {
      rating: "Very Safe",
      crimeLevel: "Low, bike theft is common",
      emergencyNumbers: { police: "112", ambulance: "112", fire: "112", general: "112" },
      commonScams: ["Fake drugs", "Pickpockets in tourist areas", "Overpriced tourist restaurants"],
      womenSafety: "Very safe for women. Excellent cycling infrastructure and well-lit streets.",
      lgbtqSafety: "One of the safest countries for LGBTQ+ individuals. Strong legal protections.",
    },
    expatCommunity: {
      population: "~2.5 million foreigners (14% of population)",
      mainNationalities: ["German", "Polish", "Turkish", "Moroccan", "British", "American"],
      communities: [
        { name: "InterNations Netherlands", type: "Network", url: "https://www.internations.org/netherlands-expats", description: "Global expat community" },
        { name: "Amsterdam Expats", type: "Facebook Group", description: "Active community with 50k+ members" },
        { name: "I amsterdam", type: "Official", url: "https://www.iamsterdam.com", description: "Official expat resources" },
      ],
      expatHubs: [
        { area: "Amsterdam - Oud-Zuid", description: "Popular with international professionals" },
        { area: "The Hague - Statenkwartier", description: "Many diplomats and EU workers" },
        { area: "Eindhoven - City Center", description: "Tech workers and students" },
      ],
    },
    transport: {
      publicTransport: [
        { type: "NS Trains", coverage: "Excellent nationwide", monthlyPass: "€350-400/month" },
        { type: "Metro/Tram", coverage: "Good in cities", monthlyPass: "€90-100/month" },
        { type: "OV-fiets", coverage: "Bike rental at stations", monthlyPass: "€4/ride" },
      ],
      apps: [
        { name: "NS App", description: "Train schedules and tickets" },
        { name: "9292", description: "All public transport planning" },
      ],
      cycling: "Cycling is king! Excellent bike paths everywhere. Get a good bike and multiple locks.",
    },
    food: {
      localCuisine: ["Stroopwafels", "Bitterballen", "Haring", "Poffertjes", "Stamppot", "Kibbeling"],
      groceryStores: [
        { name: "Albert Heijn", type: "Standard", priceLevel: "€€" },
        { name: "Jumbo", type: "Standard", priceLevel: "€€" },
        { name: "Lidl/Aldi", type: "Discount", priceLevel: "€" },
      ],
      tipping: "Not expected but appreciated. Round up or 5-10% for good service.",
    },
    taxInfo: {
      incomeTaxBrackets: [
        { upTo: 38098, rate: 0.3693 },
        { upTo: 75518, rate: 0.4950 },
        { upTo: null, rate: 0.4950 },
      ],
      socialContributions: "Employee social contributions ~27.65% (pension, health, unemployment). Employer pays an additional ~20-22%.",
      specialRegimes: [
        {
          name: "30% Ruling",
          summary: "Highly skilled migrants can receive 30% of salary tax-free for up to 5 years, effectively reducing taxable income.",
          eligibility: "Must be recruited from abroad, meet minimum salary threshold (~€46,107 for 2025), and have specific expertise not readily available in NL.",
        },
      ],
      taxYear: "Jan–Dec",
      filingDeadline: "1 May of the following year (extension possible until 1 September)",
      disclaimer: "Rates are for 2025 Dutch income tax (Box 1). The 30% ruling significantly reduces effective tax. Self-employed and freelancers pay different social contributions.",
      officialLink: "https://www.belastingdienst.nl",
      lastVerified: "2025-03-01",
    },
    commonlyForgotten: [
      { item: "BSN appointment (book in advance)", why: "The BSN (citizen service number) appointment at your municipality often has a 2-4 week wait. Book before you arrive or immediately on arrival.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
      { item: "DigiD registration", why: "DigiD is the Dutch digital identity system required for taxes, healthcare, and government services. You need a BSN first, then registration takes 1-2 weeks by post.", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Health insurance from day 1", why: "Health insurance (zorgverzekering) is mandatory from your first day of residence. You have 4 months to arrange it, but you are liable from day 1. Fines apply for late registration.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Deregister from your home country", why: "Many countries require formal deregistration. Failing to do so can cause tax residency complications and double taxation.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Buy or rent a bicycle", why: "Cycling is the primary mode of transport in Dutch cities. Public transport is expensive and a bike is essential for daily life.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Apply for the 30% ruling early", why: "If eligible, the 30% tax ruling must be applied for within 4 months of starting employment. Missing the deadline means losing years of tax benefit.", when: "first_month", applies_to: ["non_eu"], lastVerified: "2026-03-01" },
    ],
  },
  Spain: {
    currency: "EUR",
    language: "Spanish",
    englishLevel: "Low to moderate",
    healthcareSystem: "Public healthcare (SNS) or private insurance",
    bankingNotes: "NIE (foreigner ID number) required for most banking services.",
    cultureTips: [
      "Siesta culture - many businesses close 2-5 PM",
      "Dinner is late - 9-10 PM is normal",
      "Personal relationships matter in business",
      "Greetings involve two kisses on the cheek",
      "Learning Spanish is essential outside tourist areas",
    ],
    popularBanks: [
      { name: "BBVA", type: "Traditional", features: ["English app", "Good expat services"] },
      { name: "Santander", type: "Traditional", features: ["Wide branch network", "International transfers"] },
      { name: "N26", type: "Digital", features: ["No NIE needed initially", "English app"] },
    ],
    rentalPlatforms: [
      { name: "Idealista", url: "https://www.idealista.com", description: "Largest rental platform" },
      { name: "Fotocasa", url: "https://www.fotocasa.es", description: "Popular alternative" },
      { name: "Spotahome", url: "https://www.spotahome.com", description: "Verified listings, expat-friendly" },
    ],
    jobPlatforms: [
      { name: "InfoJobs", url: "https://www.infojobs.net", description: "Major Spanish job board" },
      { name: "LinkedIn", url: "https://www.linkedin.com", description: "Professional networking" },
      { name: "Indeed Spain", url: "https://www.indeed.es", description: "International job board" },
    ],
    nightlife: {
      overview: "Spain is famous for its late-night culture. Dinner at 10 PM, clubs open at midnight, and parties until sunrise. Barcelona and Madrid are world-class nightlife destinations.",
      bestAreas: [
        { name: "Barcelona - El Born", vibe: "Trendy cocktail bars, hip crowd", priceLevel: "€€" },
        { name: "Madrid - Malasaña", vibe: "Alternative, indie scene", priceLevel: "€€" },
        { name: "Madrid - Chueca", vibe: "LGBTQ+ friendly, diverse", priceLevel: "€€" },
        { name: "Ibiza", vibe: "World-famous clubs", priceLevel: "€€€€" },
      ],
      legalInfo: { drinkingAge: 18, closingTime: "Varies, 3-6 AM typical", smokingRules: "Banned indoors" },
      lgbtqFriendly: "Very LGBTQ+ friendly. Madrid's Chueca and Barcelona's Eixample are famous gay neighborhoods.",
    },
    safety: {
      rating: "Generally Safe",
      crimeLevel: "Low violent crime, pickpocketing in tourist areas",
      emergencyNumbers: { police: "091", ambulance: "061", fire: "080", general: "112" },
      commonScams: ["Pickpockets on Las Ramblas", "Fake police", "Rose sellers", "Bird poop scam"],
      womenSafety: "Generally safe. Use normal precautions in nightlife areas.",
      lgbtqSafety: "Very safe. Spain was among first to legalize same-sex marriage.",
    },
    expatCommunity: {
      population: "~6 million foreigners (13% of population)",
      mainNationalities: ["Romanian", "Moroccan", "British", "Colombian", "Italian", "American"],
      communities: [
        { name: "InterNations Spain", type: "Network", url: "https://www.internations.org/spain-expats", description: "Events and networking" },
        { name: "Expat.com Spain", type: "Forum", url: "https://www.expat.com/en/destination/europe/spain/", description: "Advice and community" },
        { name: "Barcelona Connect", type: "Facebook Group", description: "Active Barcelona expat community" },
      ],
      expatHubs: [
        { area: "Barcelona - Eixample", description: "International professionals and students" },
        { area: "Madrid - Salamanca", description: "Upscale, international crowd" },
        { area: "Valencia - Ruzafa", description: "Digital nomads and creatives" },
      ],
    },
    transport: {
      publicTransport: [
        { type: "Metro", coverage: "Excellent in Madrid/Barcelona", monthlyPass: "€40-55/month" },
        { type: "Cercanías", coverage: "Regional trains", monthlyPass: "Included in metro pass" },
        { type: "Bus", coverage: "Comprehensive", monthlyPass: "€40-55/month" },
      ],
      apps: [
        { name: "Moovit", description: "Multi-city transit planning" },
        { name: "Renfe", description: "National train bookings" },
      ],
      cycling: "Growing infrastructure, especially in Valencia and Barcelona. E-scooters popular.",
    },
    food: {
      localCuisine: ["Paella", "Tapas", "Jamón Ibérico", "Gazpacho", "Tortilla Española", "Churros"],
      groceryStores: [
        { name: "Mercadona", type: "Standard", priceLevel: "€" },
        { name: "Carrefour", type: "Hypermarket", priceLevel: "€€" },
        { name: "El Corte Inglés", type: "Premium", priceLevel: "€€€" },
      ],
      tipping: "Not expected, 5-10% for exceptional service at restaurants.",
    },
    taxInfo: {
      incomeTaxBrackets: [
        { upTo: 12450, rate: 0.19 },
        { upTo: 20200, rate: 0.24 },
        { upTo: 35200, rate: 0.30 },
        { upTo: 60000, rate: 0.37 },
        { upTo: null, rate: 0.45 },
      ],
      socialContributions: "Employee social security ~6.35%. Employer pays ~29.9%. Self-employed (autónomo) pay ~30% of chosen base.",
      specialRegimes: [
        {
          name: "Beckham Law (Ley Beckham)",
          summary: "Flat 24% tax rate on Spanish-sourced income for up to 6 years. Foreign income (except employment) exempt from Spanish tax.",
          eligibility: "Must not have been Spanish tax resident in previous 5 years. Must move to Spain due to employment contract or company director role.",
        },
      ],
      taxYear: "Jan–Dec",
      filingDeadline: "30 June of the following year (Campaña de la Renta starts in April)",
      disclaimer: "Rates are for 2025 Spanish general income tax (IRPF). Regional surcharges vary by autonomous community. Beckham Law may significantly reduce effective rate. Self-employed rates differ.",
      officialLink: "https://sede.agenciatributaria.gob.es",
      lastVerified: "2025-03-01",
    },
    commonlyForgotten: [
      { item: "NIE vs NIF — know the difference", why: "NIE is your foreigner ID number (for residency). NIF is your tax number (for finances). You need both, and the application processes are separate.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Empadronamiento (municipal registration)", why: "Register at your local town hall (ayuntamiento) to prove residency. Required for healthcare, school enrollment, and many administrative procedures.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Siesta hours affect office availability", why: "Many government offices and businesses close between 14:00-17:00. Plan errands for morning hours to avoid wasted trips.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Autónomo registration if freelance", why: "Self-employed workers must register as autónomo with Social Security. There is a reduced flat-rate quota for the first year (~€80/month).", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Deregister from your home country", why: "Many countries require formal deregistration. Failing to do so can cause tax residency complications and double taxation.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
    ],
  },
  Portugal: {
    currency: "EUR",
    language: "Portuguese",
    englishLevel: "Moderate to good in cities",
    healthcareSystem: "National Health Service (SNS) or private",
    bankingNotes: "NIF (tax number) required. Some banks offer non-resident accounts.",
    cultureTips: [
      "Relaxed pace of life - don't rush things",
      "Coffee culture is strong - locals drink espresso",
      "Fado music is part of the cultural identity",
      "Sunday lunch is family time",
      "Learning Portuguese opens many doors",
    ],
    popularBanks: [
      { name: "ActivoBank", type: "Digital", features: ["Free account", "English support", "Good app"] },
      { name: "Millennium BCP", type: "Traditional", features: ["Large network", "Expat services"] },
      { name: "Revolut", type: "Digital", features: ["Easy setup", "Multi-currency"] },
    ],
    rentalPlatforms: [
      { name: "Idealista", url: "https://www.idealista.pt", description: "Largest rental platform" },
      { name: "Imovirtual", url: "https://www.imovirtual.com", description: "Popular alternative" },
      { name: "OLX Portugal", url: "https://www.olx.pt", description: "Classified ads with rentals" },
    ],
    jobPlatforms: [
      { name: "Net-Empregos", url: "https://www.net-empregos.com", description: "Major Portuguese job board" },
      { name: "LinkedIn", url: "https://www.linkedin.com", description: "Professional networking" },
      { name: "Indeed Portugal", url: "https://www.indeed.pt", description: "International job board" },
    ],
    taxInfo: {
      incomeTaxBrackets: [
        { upTo: 7703, rate: 0.1325 },
        { upTo: 11623, rate: 0.18 },
        { upTo: 16472, rate: 0.23 },
        { upTo: 21321, rate: 0.26 },
        { upTo: 27146, rate: 0.3275 },
        { upTo: 39791, rate: 0.37 },
        { upTo: 51997, rate: 0.435 },
        { upTo: 81199, rate: 0.45 },
        { upTo: null, rate: 0.48 },
      ],
      socialContributions: "Employee social security ~11%. Employer pays ~23.75%. Self-employed pay ~21.4%.",
      specialRegimes: [
        {
          name: "Non-Habitual Resident (NHR 2.0)",
          summary: "20% flat tax on eligible Portuguese-sourced employment/self-employment income for 10 years. Replaced original NHR regime in 2024.",
          eligibility: "Must not have been Portuguese tax resident in previous 5 years. Must work in eligible professions (tech, science, academia) or for companies qualifying under tax incentive regimes.",
        },
      ],
      taxYear: "Jan–Dec",
      filingDeadline: "30 June of the following year",
      disclaimer: "Rates are for 2025 Portuguese income tax (IRS). NHR 2.0 regime may significantly reduce effective rate for eligible workers. Self-employed rates differ.",
      officialLink: "https://www.portaldasfinancas.gov.pt",
      lastVerified: "2025-03-01",
    },
    commonlyForgotten: [
      { item: "NIF appointment may require a fiscal representative", why: "Non-EU citizens often need a fiscal representative (representante fiscal) to obtain a NIF (tax number). This can take weeks to arrange and costs €100-300/year.", when: "before_move", applies_to: ["non_eu"], lastVerified: "2026-03-01" },
      { item: "NISS for social security", why: "The NISS (social security number) is separate from the NIF. You need it to start working legally. Apply at the Social Security office after getting your NIF.", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "MB Way for payments", why: "MB Way is Portugal's dominant mobile payment system, used everywhere from restaurants to parking. Link it to your Portuguese bank account early.", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Deregister from your home country", why: "Many countries require formal deregistration. Failing to do so can cause tax residency complications and double taxation.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
      { item: "NIF application before arrival", why: "You can apply for a NIF before arriving in Portugal. Having it ready speeds up bank account opening, rental contracts, and utility setup.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
    ],
  },
  Sweden: {
    currency: "SEK",
    language: "Swedish",
    englishLevel: "Very high, widely spoken",
    healthcareSystem: "Tax-funded public healthcare",
    bankingNotes: "Personal number (personnummer) essential for most services.",
    cultureTips: [
      "Fika (coffee break) is sacred social time",
      "Lagom - moderation in everything",
      "Queuing systems (take a number) are everywhere",
      "Nature access rights (Allemansrätten) allow free roaming",
      "Swedes value personal space and quiet",
    ],
    popularBanks: [
      { name: "Swedbank", type: "Traditional", features: ["Large network", "English support"] },
      { name: "SEB", type: "Traditional", features: ["International focus", "Good app"] },
      { name: "Handelsbanken", type: "Traditional", features: ["Personal service", "Local branches"] },
    ],
    rentalPlatforms: [
      { name: "Blocket Bostad", url: "https://www.blocket.se", description: "Main classified ads site" },
      { name: "Bostaddirekt", url: "https://www.bostaddirekt.com", description: "Second-hand rentals" },
      { name: "Qasa", url: "https://www.qasa.se", description: "Verified rental platform" },
    ],
    jobPlatforms: [
      { name: "Arbetsförmedlingen", url: "https://www.arbetsformedlingen.se", description: "Public employment service" },
      { name: "LinkedIn", url: "https://www.linkedin.com", description: "Professional networking" },
      { name: "Indeed Sweden", url: "https://www.indeed.se", description: "International job board" },
    ],
    taxInfo: {
      incomeTaxBrackets: [
        { upTo: 614000, rate: 0.32 },
        { upTo: null, rate: 0.52 },
      ],
      socialContributions: "Employee social contributions ~7%. Employer pays ~31.42% (largest component). Total tax burden is high but includes generous social benefits.",
      specialRegimes: [
        {
          name: "SINK Tax (for temporary workers)",
          summary: "Flat 25% tax on employment income for non-residents working temporarily in Sweden. No deductions allowed.",
          eligibility: "Non-resident staying in Sweden for less than 6 months. Applied for at Skatteverket.",
        },
        {
          name: "Expert Tax Relief (Forskarskattenämnden)",
          summary: "25% of salary exempt from income tax and social contributions for up to 7 years. Effectively reduces tax on the first ~SEK 100,000/month.",
          eligibility: "Foreign experts, researchers, or key personnel earning above ~SEK 106,200/month (2025). Must apply within 3 months of starting work.",
        },
      ],
      taxYear: "Jan–Dec",
      filingDeadline: "2 May of the following year",
      disclaimer: "Rates are for 2025 Swedish income tax. The first bracket includes ~32% municipal tax (varies by municipality). State tax of ~20% applies above SEK 614,000. Expert tax relief can significantly reduce effective rate. Self-employed rates differ.",
      officialLink: "https://www.skatteverket.se",
      lastVerified: "2025-03-01",
    },
    commonlyForgotten: [
      { item: "Personnummer wait time (2-6 weeks)", why: "The Swedish personal number (personnummer) is required for almost everything — bank accounts, phone contracts, healthcare. It can take 2-6 weeks to receive after registration at Skatteverket.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "BankID is essential for daily life", why: "BankID is Sweden's digital identification system used for banking, government services, and even package delivery. You need a personnummer and a Swedish bank account first.", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Skatteverket registration in person", why: "You must register in person at Skatteverket (Swedish Tax Agency) with your passport and proof of residence. This triggers the personnummer process.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Winter gear before October", why: "Swedish winters start early and are harsh. Buy proper winter clothing (jacket, boots, thermal layers) before October — prices rise and stock runs low as winter approaches.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Deregister from your home country", why: "Many countries require formal deregistration. Failing to do so can cause tax residency complications and double taxation.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Apply for Expert Tax Relief within 3 months", why: "If eligible, the application to Forskarskattenämnden must be submitted within 3 months of starting work. Missing this deadline forfeits up to 7 years of tax savings.", when: "first_month", applies_to: ["non_eu"], lastVerified: "2026-03-01" },
    ],
  },
  Japan: {
    currency: "JPY",
    language: "Japanese",
    englishLevel: "Low, improving in major cities",
    healthcareSystem: "National Health Insurance (Kokumin Kenko Hoken)",
    bankingNotes: "Residence card and seal (hanko/inkan) often required.",
    cultureTips: [
      "Bowing is important - depth indicates respect level",
      "Remove shoes when entering homes and some businesses",
      "Business cards are exchanged with both hands",
      "Tipping is not customary and can be offensive",
      "Silence and indirect communication are valued",
    ],
    popularBanks: [
      { name: "Japan Post Bank", type: "Traditional", features: ["Easy to open", "Many ATMs"] },
      { name: "SMBC", type: "Traditional", features: ["Large network", "Some English support"] },
      { name: "Sony Bank", type: "Digital", features: ["Online banking", "Multi-currency"] },
    ],
    rentalPlatforms: [
      { name: "Suumo", url: "https://suumo.jp", description: "Major rental platform" },
      { name: "GaijinPot Apartments", url: "https://apartments.gaijinpot.com", description: "Foreigner-friendly" },
      { name: "Real Estate Japan", url: "https://realestate.co.jp", description: "English listings" },
    ],
    jobPlatforms: [
      { name: "GaijinPot Jobs", url: "https://jobs.gaijinpot.com", description: "Jobs for foreigners" },
      { name: "Daijob", url: "https://www.daijob.com", description: "Bilingual job board" },
      { name: "LinkedIn", url: "https://www.linkedin.com", description: "Professional networking" },
    ],
    taxInfo: {
      incomeTaxBrackets: [
        { upTo: 1950000, rate: 0.05 },
        { upTo: 3300000, rate: 0.10 },
        { upTo: 6950000, rate: 0.20 },
        { upTo: 9000000, rate: 0.23 },
        { upTo: 18000000, rate: 0.33 },
        { upTo: 40000000, rate: 0.40 },
        { upTo: null, rate: 0.45 },
      ],
      socialContributions: "Employee pays ~15% (health insurance, pension, employment insurance). Employer pays a similar amount. Exact rate depends on age and income level.",
      specialRegimes: [],
      taxYear: "Jan–Dec",
      filingDeadline: "15 March of the following year (kakutei shinkoku)",
      disclaimer: "Rates are for 2025 Japanese national income tax. Resident tax (~10%) is charged separately by municipality. Amounts in JPY. Self-employed rates differ.",
      officialLink: "https://www.nta.go.jp",
      lastVerified: "2025-03-01",
    },
    commonlyForgotten: [
      { item: "Residence card at airport immigration", why: "Your Zairyu Card (residence card) is issued at the airport on arrival. Do not leave the immigration area without it — it is your primary ID in Japan.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Ward office registration within 14 days", why: "You must register at your local ward office (kuyakusho) within 14 days of moving in. This is required for health insurance, pension, and other services.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Hanko/Inkan seal", why: "A personal seal (hanko) is still required for many official documents, bank accounts, and contracts in Japan. Get one made early — custom seals take a few days.", when: "first_month", applies_to: null, lastVerified: "2026-03-01" },
      { item: "National Health Insurance enrollment", why: "If not covered by employer health insurance, you must enroll in National Health Insurance (Kokumin Kenko Hoken) at the ward office. Coverage starts from your move-in date.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Garbage sorting rules (gomi bunbetsu)", why: "Japan has strict garbage separation rules that vary by municipality. Incorrect sorting leads to rejected bags and neighbor complaints. Get the schedule from your ward office.", when: "first_week", applies_to: null, lastVerified: "2026-03-01" },
      { item: "Deregister from your home country", why: "Many countries require formal deregistration. Failing to do so can cause tax residency complications and double taxation.", when: "before_move", applies_to: null, lastVerified: "2026-03-01" },
    ],
  },
}

// Default country data for unlisted countries
const DEFAULT_COUNTRY_DATA = {
  currency: "Local currency",
  language: "Local language",
  englishLevel: "Varies",
  healthcareSystem: "Check local requirements",
  bankingNotes: "ID and proof of address typically required",
  cultureTips: [
    "Research local customs before arrival",
    "Learn basic phrases in the local language",
    "Observe how locals behave in various situations",
    "Be respectful of religious and cultural practices",
  ],
  popularBanks: [
    { name: "Local bank", type: "Traditional", features: ["Branch network", "Local support"] },
    { name: "Wise", type: "Digital", features: ["Multi-currency", "International transfers"] },
    { name: "Revolut", type: "Digital", features: ["Easy setup", "Travel-friendly"] },
  ],
  rentalPlatforms: [
    { name: "Local platforms", url: "#", description: "Research local rental websites" },
    { name: "Facebook Groups", url: "https://www.facebook.com", description: "Expat housing groups" },
  ],
  jobPlatforms: [
    { name: "LinkedIn", url: "https://www.linkedin.com", description: "Professional networking" },
    { name: "Indeed", url: "https://www.indeed.com", description: "International job board" },
  ],
}

/**
 * Convert all numeric cost values in CostOfLivingData by a given exchange rate.
 */
function convertCostData(data: CostOfLivingData, rate: number, newCurrency: string): CostOfLivingData {
  const r = (v: number) => Math.round(v * rate)
  return {
    ...data,
    currency: newCurrency,
    monthlyRent1Bed: { city: r(data.monthlyRent1Bed.city), outside: r(data.monthlyRent1Bed.outside) },
    monthlyRent3Bed: { city: r(data.monthlyRent3Bed.city), outside: r(data.monthlyRent3Bed.outside) },
    utilities: r(data.utilities),
    internet: r(data.internet),
    mealInexpensive: r(data.mealInexpensive),
    mealMidRange: r(data.mealMidRange),
    groceries: r(data.groceries),
    transportation: r(data.transportation),
  }
}

/**
 * Generate a comprehensive relocation guide from profile data
 */
export async function generateGuide(profile: Profile): Promise<Guide> {
  const destination = profile.destination || "Unknown"
  const countryData = COUNTRY_DATA[destination] || DEFAULT_COUNTRY_DATA
  const purpose = profile.purpose || "other"
  const city = profile.target_city

  // Get cost of living and budget data
  let costOfLiving = getCostOfLivingData(destination, city)

  // Convert cost data from source currency to destination currency if they differ
  if (costOfLiving) {
    const sourceCurrency = costOfLiving.currency || "USD"
    const destCurrency = countryData.currency !== "Local currency"
      ? countryData.currency
      : getCurrencyFromCountry(destination) || "EUR"

    if (sourceCurrency !== destCurrency) {
      const rate = await getExchangeRate(sourceCurrency, destCurrency)
      if (rate && rate !== 1) {
        console.log(`[GoMate][Guide] Converting cost data from ${sourceCurrency} to ${destCurrency} (rate: ${rate})`)
        costOfLiving = convertCostData(costOfLiving, rate, destCurrency)
      }
    }
  }

  const budgetData = costOfLiving ? calculateMonthlyBudget(profile, costOfLiving) : null
  const savingsData = budgetData ? calculateSavingsTarget(profile, budgetData.comfortable) : null

  // Get visa recommendation
  const visaRec = generateVisaRecommendation(profile)

  // Get official sources
  const officialSources = getOfficialSourcesArray(destination)

  // Check visa-free status
  const visaStatus = profile.citizenship ? getVisaStatus(profile.citizenship, destination) : null

  // Build the guide
  // Resolve the destination's currency code
  const guideCurrency = countryData.currency !== "Local currency"
    ? countryData.currency
    : getCurrencyFromCountry(destination) || "EUR"

  const guide: Guide = {
    title: `Your ${destination} Relocation Guide`,
    destination,
    destinationCity: city,
    purpose,
    currency: guideCurrency,
    overview: generateOverview(profile, countryData, visaStatus),
    visa: generateVisaSection(profile, visaRec, visaStatus),
    budget: generateBudgetSection(profile, costOfLiving, budgetData, savingsData),
    housing: generateHousingSection(profile, countryData, costOfLiving, guideCurrency),
    banking: generateBankingSection(profile, countryData),
    healthcare: generateHealthcareSection(profile, countryData),
    culture: generateCultureSection(profile, countryData),
    timeline: generateTimelineSection(profile),
    checklist: generateChecklistSection(profile),
    officialLinks: officialSources.map(s => ({ name: s.name, url: s.url, category: s.category })),
    usefulTips: generateUsefulTips(profile, countryData),
    createdAt: new Date().toISOString(),
    status: "complete",
  }

  // Add purpose-specific sections
  if (purpose === "work" || purpose === "digital_nomad") {
    guide.jobs = generateJobsSection(profile, countryData)
  }
  if (purpose === "study") {
    guide.education = generateEducationSection(profile, countryData)
  }

  // Enrich with LLM-generated deep content (falls back to skeleton on failure)
  const enrichedGuide = await enrichGuide(profile, guide)
  return enrichedGuide
}

function generateOverview(
  profile: Profile,
  countryData: typeof DEFAULT_COUNTRY_DATA,
  visaStatus: ReturnType<typeof getVisaStatus> | null
): GuideOverview {
  const destination = profile.destination || "your destination"
  const purpose = profile.purpose || "relocating"
  
  const purposeText: Record<string, string> = {
    study: "study",
    work: "work",
    settle: "settle permanently",
    digital_nomad: "work remotely",
    other: "relocate",
  }
  
  return {
    title: `Moving to ${destination}`,
    subtitle: `Your personalized guide to ${purposeText[purpose] || "relocating"} in ${destination}`,
    summary: `This guide has been tailored to your profile. It covers key information about relocating to ${destination}, from visa requirements to finding housing and settling in. Always verify details with the relevant authorities.`,
    keyFacts: [
      { label: "Currency", value: countryData.currency },
      { label: "Language", value: countryData.language },
      { label: "English Level", value: countryData.englishLevel },
      { label: "Visa Required", value: visaStatus?.visaFree ? "No (Freedom of Movement)" : "Yes" },
      { label: "Healthcare", value: countryData.healthcareSystem.split("(")[0].trim() },
    ],
    lastUpdated: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  }
}

function generateVisaSection(
  profile: Profile,
  visaRec: ReturnType<typeof generateVisaRecommendation>,
  visaStatus: ReturnType<typeof getVisaStatus> | null
): VisaSection {
  const destination = profile.destination || ""
  
  if (visaStatus?.visaFree) {
    return {
      recommendedVisa: "None required",
      visaType: "Freedom of Movement",
      eligibility: visaStatus.reason,
      processingTime: "N/A",
      estimatedCost: "Free",
      requirements: [
        "Valid passport or national ID",
        "Registration at local municipality after arrival",
        "Health insurance (may be required)",
      ],
      applicationSteps: [
        "Travel to your destination",
        "Register with local authorities within required timeframe",
        "Obtain local ID/residence card if staying long-term",
      ],
      tips: [
        "Even without a visa, register with local authorities promptly",
        "Keep proof of sufficient funds for initial period",
        "Arrange health insurance before or shortly after arrival",
      ],
      warnings: [],
    }
  }
  
  return {
    recommendedVisa: visaRec?.primaryVisa || "Visa required — consult embassy",
    visaType: visaRec?.primaryVisa || "Standard visa",
    eligibility: visaRec?.visaFreeStatus?.reason || "Check eligibility with the consulate",
    processingTime: visaRec?.processingTime || "4-12 weeks (varies)",
    estimatedCost: "Varies — check official embassy site",
    requirements: visaRec?.requirements || [
      "Valid passport",
      "Completed application form",
      "Passport-sized photos",
      "Proof of financial means",
    ],
    applicationSteps: [
      "Gather all required documents",
      "Complete the visa application form",
      "Schedule appointment at embassy/consulate",
      "Attend appointment and submit biometrics if required",
      "Wait for processing",
      "Collect visa and prepare for travel",
    ],
    tips: visaRec?.tips || [
      "Apply well in advance of your planned travel date",
      "Keep copies of all documents",
    ],
    warnings: [
      "Start your application well in advance",
      "Ensure all documents are translated if required",
      "Keep copies of all submitted documents",
    ],
    officialLink: `https://www.google.com/search?q=${encodeURIComponent(`${destination} visa application official`)}`,
  }
}

function generateBudgetSection(
  profile: Profile,
  costOfLiving: ReturnType<typeof getCostOfLivingData>,
  budgetData: ReturnType<typeof calculateMonthlyBudget>,
  savingsData: ReturnType<typeof calculateSavingsTarget>
): BudgetSection {
  const defaultBudget = {
    minimum: 1500,
    comfortable: 2500,
    breakdown: {
      "Rent": 800,
      "Utilities": 150,
      "Groceries": 300,
      "Transport": 100,
      "Healthcare": 150,
      "Other": 200,
    },
  }
  
  const defaultSavings = {
    emergencyFund: 7500,
    movingCosts: 3000,
    initialSetup: 2000,
    visaFees: 500,
    total: 13000,
    timeline: "6-12 months",
  }
  
  return {
    monthlyBudget: budgetData || defaultBudget,
    savingsTarget: savingsData || defaultSavings,
    costComparison: costOfLiving 
      ? `Based on ${costOfLiving.city || costOfLiving.country} cost of living data`
      : undefined,
    tips: [
      "Build an emergency fund covering 3-6 months of expenses",
      "Factor in one-time setup costs like deposits and furniture",
      "Keep some money in your home currency as backup",
      "Research tax implications for your income sources",
      "Consider cost differences between cities",
    ],
  }
}

function generateHousingSection(
  profile: Profile,
  countryData: typeof DEFAULT_COUNTRY_DATA,
  costOfLiving: ReturnType<typeof getCostOfLivingData>,
  currencyCode: string
): HousingSection {
  const destination = profile.destination || ""
  const sym = getCurrencySymbol(currencyCode)

  return {
    overview: `Finding housing in ${destination} can be competitive, especially in major cities. Start your search early and be prepared to act quickly when you find a suitable place.`,
    averageRent: {
      studio: costOfLiving?.monthlyRent1Bed
        ? `${sym}${Math.round(costOfLiving.monthlyRent1Bed.city * 0.8)}/month`
        : "Varies",
      oneBed: costOfLiving?.monthlyRent1Bed
        ? `${sym}${costOfLiving.monthlyRent1Bed.city}/month (city center)`
        : "Varies",
      twoBed: costOfLiving?.monthlyRent3Bed
        ? `${sym}${Math.round(costOfLiving.monthlyRent3Bed.city * 0.7)}/month`
        : "Varies",
    },
    popularAreas: [],
    rentalPlatforms: countryData.rentalPlatforms,
    depositInfo: "Typically 1-3 months rent as deposit, refundable at end of tenancy",
    tips: [
      "Consider temporary accommodation first to explore neighborhoods",
      "Have all documents ready: ID, proof of income, references",
      "Be wary of scams - never pay before viewing",
      "Understand what's included in rent (utilities, internet, etc.)",
      "Join expat Facebook groups for housing leads",
    ],
    warnings: [
      "Scams are common - never wire money without seeing the property",
      "Some landlords prefer local tenants - be persistent",
      "Rental contracts may be in local language - get translations",
    ],
  }
}

function generateBankingSection(
  profile: Profile,
  countryData: typeof DEFAULT_COUNTRY_DATA
): BankingSection {
  return {
    overview: `Opening a bank account is one of your first priorities. ${countryData.bankingNotes}`,
    recommendedBanks: countryData.popularBanks.map(b => ({
      ...b,
      url: undefined,
    })),
    requirements: [
      "Valid passport or ID",
      "Proof of address (utility bill, rental contract)",
      "Local tax/ID number if required",
      "Initial deposit (amount varies)",
    ],
    digitalBanks: [
      { name: "Wise", features: ["Multi-currency", "Low fees", "No local ID needed"] },
      { name: "Revolut", features: ["Easy setup", "Good exchange rates", "Virtual cards"] },
    ],
    tips: [
      "Open a digital bank account before arrival for immediate access",
      "Traditional banks may offer better services for long-term residents",
      "Keep your home country account active initially",
      "Research fees for international transfers",
    ],
  }
}

function generateHealthcareSection(
  profile: Profile,
  countryData: typeof DEFAULT_COUNTRY_DATA
): HealthcareSection {
  const destination = profile.destination || ""
  
  return {
    overview: `Healthcare in ${destination}: ${countryData.healthcareSystem}`,
    systemType: countryData.healthcareSystem,
    insuranceRequirements: "Health insurance is typically mandatory for visa holders and residents",
    registrationSteps: [
      "Obtain health insurance (public or private)",
      "Register with local health authority",
      "Choose a general practitioner (GP)",
      "Obtain health card/number",
    ],
    emergencyInfo: "In most EU countries, dial 112 for emergencies",
    recommendedProviders: [],
    tips: [
      "Arrange travel insurance for your initial period",
      "Bring copies of medical records and prescriptions",
      "Research if your medications are available locally",
      "Learn basic medical vocabulary in local language",
      profile.healthcare_needs ? "Inform your doctor about your specific healthcare needs" : "",
    ].filter(Boolean),
  }
}

function generateCultureSection(
  profile: Profile,
  countryData: typeof DEFAULT_COUNTRY_DATA
): CultureSection {
  return {
    overview: `Understanding local culture will help you integrate faster and avoid misunderstandings.`,
    language: {
      official: countryData.language,
      englishLevel: countryData.englishLevel,
      learningTips: [
        "Start learning basics before you arrive",
        "Use language learning apps like Duolingo or Babbel",
        "Practice with locals - most appreciate the effort",
        "Join language exchange meetups",
      ],
    },
    socialNorms: countryData.cultureTips,
    workCulture: [
      "Research typical working hours and expectations",
      "Understand hierarchy and communication styles",
      "Learn about local holidays and customs",
    ],
    doAndDonts: {
      dos: [
        "Learn basic greetings in local language",
        "Be open to new experiences",
        "Respect local traditions",
        "Join expat and local communities",
      ],
      donts: [
        "Don't assume everyone speaks English",
        "Don't criticize local customs",
        "Don't compare everything to your home country",
      ],
    },
    localTips: countryData.cultureTips,
  }
}

function generateJobsSection(
  profile: Profile,
  countryData: typeof DEFAULT_COUNTRY_DATA
): JobsSection {
  const destination = profile.destination || ""
  
  return {
    overview: `The job market in ${destination} varies by industry and location. ${profile.job_offer === "yes" ? "Having a job offer is a significant advantage for your visa application." : "Starting your job search early is recommended."}`,
    jobMarket: "Research current demand in your field",
    inDemandSkills: [
      "Technology and IT",
      "Engineering",
      "Healthcare",
      "Finance",
      "Languages",
    ],
    jobPlatforms: countryData.jobPlatforms,
    salaryExpectations: "Research typical salaries for your role and location",
    workPermitInfo: profile.job_offer === "yes" 
      ? "Your employer may sponsor your work permit"
      : "Work permit requirements depend on your visa type",
    networkingTips: [
      "Update your LinkedIn profile",
      "Join industry-specific groups and events",
      "Attend expat networking events",
      "Consider local recruiters specializing in expats",
    ],
  }
}

function generateEducationSection(
  profile: Profile,
  countryData: typeof DEFAULT_COUNTRY_DATA
): EducationSection {
  const destination = profile.destination || ""
  const studyType = profile.study_type || "university"
  
  return {
    overview: `${destination} offers quality education options. ${studyType === "university" ? "Many universities offer programs in English." : "Language requirements vary by institution."}`,
    systemType: `Education system in ${destination}`,
    popularInstitutions: [],
    applicationProcess: [
      "Research programs and requirements",
      "Prepare required documents (transcripts, language certificates)",
      "Submit applications before deadlines",
      "Arrange student visa once accepted",
    ],
    tuitionInfo: "Tuition varies by institution and program type",
    scholarships: [
      "Research government scholarships for international students",
      "Check university-specific financial aid",
      "Look for industry-sponsored programs",
    ],
    tips: [
      "Start applications 6-12 months in advance",
      "Check language requirements early",
      "Connect with current international students",
      profile.study_field ? `Research specific requirements for ${profile.study_field}` : "",
    ].filter(Boolean),
  }
}

function generateTimelineSection(profile: Profile): TimelineSection {
  const timeline = profile.timeline || ""
  const purpose = profile.purpose || "other"
  
  // Estimate total months based on timeline
  let totalMonths = 6
  if (timeline.includes("month")) {
    const match = timeline.match(/(\d+)/)
    if (match) totalMonths = Math.max(parseInt(match[1]), 3)
  } else if (timeline.includes("year")) {
    totalMonths = 12
  } else if (timeline.includes("ASAP") || timeline.includes("soon")) {
    totalMonths = 3
  }
  
  const phases = [
    {
      name: "Research & Planning",
      duration: `Month 1-${Math.max(1, Math.floor(totalMonths * 0.2))}`,
      tasks: [
        "Research visa requirements thoroughly",
        "Create detailed budget and savings plan",
        "Begin learning the local language",
        "Research housing options and neighborhoods",
      ],
      tips: ["Don't rush this phase - good planning saves problems later"],
    },
    {
      name: "Visa & Documentation",
      duration: `Month ${Math.floor(totalMonths * 0.2) + 1}-${Math.floor(totalMonths * 0.5)}`,
      tasks: [
        "Gather all required documents",
        "Submit visa application",
        "Arrange document translations/apostilles",
        "Sort out financial proof requirements",
      ],
      tips: ["Start earlier than you think - visa processing can be slow"],
    },
    {
      name: "Pre-Move Preparation",
      duration: `Month ${Math.floor(totalMonths * 0.5) + 1}-${Math.floor(totalMonths * 0.8)}`,
      tasks: [
        "Arrange temporary accommodation",
        "Book travel and shipping",
        "Notify banks and services of move",
        "Arrange travel insurance",
      ],
      tips: ["Book temporary accommodation for first 2-4 weeks"],
    },
    {
      name: "Move & Settle",
      duration: `Month ${Math.floor(totalMonths * 0.8) + 1}-${totalMonths}`,
      tasks: [
        "Register with local authorities",
        "Open local bank account",
        "Find permanent housing",
        "Set up utilities and internet",
        "Register for healthcare",
      ],
      tips: ["Give yourself grace period to adjust - it takes time"],
    },
  ]
  
  return { totalMonths, phases }
}

function generateChecklistSection(profile: Profile): ChecklistSection {
  const purpose = profile.purpose || "other"
  
  const categories = [
    {
      name: "Documents",
      items: [
        { task: "Valid passport (6+ months validity)", priority: "high" as const, timeframe: "Immediately" },
        { task: "Birth certificate (apostilled if needed)", priority: "high" as const, timeframe: "1-2 months before" },
        { task: "Educational certificates", priority: "medium" as const, timeframe: "1-2 months before" },
        { task: "Police clearance certificate", priority: "medium" as const, timeframe: "1-2 months before" },
        { task: "Medical records and prescriptions", priority: "medium" as const, timeframe: "1 month before" },
      ],
    },
    {
      name: "Visa & Legal",
      items: [
        { task: "Research visa requirements", priority: "high" as const, timeframe: "3-6 months before" },
        { task: "Gather visa documents", priority: "high" as const, timeframe: "2-3 months before" },
        { task: "Submit visa application", priority: "high" as const, timeframe: "2-3 months before" },
        { task: "Arrange travel insurance", priority: "high" as const, timeframe: "1 month before" },
      ],
    },
    {
      name: "Financial",
      items: [
        { task: "Create moving budget", priority: "high" as const, timeframe: "3-6 months before" },
        { task: "Save emergency fund", priority: "high" as const, timeframe: "Ongoing" },
        { task: "Notify bank of move", priority: "medium" as const, timeframe: "1 month before" },
        { task: "Research tax implications", priority: "medium" as const, timeframe: "2 months before" },
      ],
    },
    {
      name: "Housing",
      items: [
        { task: "Research neighborhoods", priority: "medium" as const, timeframe: "2-3 months before" },
        { task: "Book temporary accommodation", priority: "high" as const, timeframe: "1-2 months before" },
        { task: "Search for permanent housing", priority: "medium" as const, timeframe: "After arrival" },
      ],
    },
    {
      name: "After Arrival",
      items: [
        { task: "Register with local authorities", priority: "high" as const, timeframe: "First week" },
        { task: "Open local bank account", priority: "high" as const, timeframe: "First 2 weeks" },
        { task: "Register for healthcare", priority: "high" as const, timeframe: "First month" },
        { task: "Get local phone number", priority: "medium" as const, timeframe: "First week" },
      ],
    },
  ]
  
  // Add purpose-specific items
  if (purpose === "work") {
    categories.push({
      name: "Employment",
      items: [
        { task: "Update CV/resume for local format", priority: "high" as const, timeframe: "2 months before" },
        { task: "Research job market", priority: "medium" as const, timeframe: "2-3 months before" },
        { task: "Register with tax authority", priority: "high" as const, timeframe: "First month" },
      ],
    })
  }
  
  if (purpose === "study") {
    categories.push({
      name: "Education",
      items: [
        { task: "Submit university applications", priority: "high" as const, timeframe: "6-12 months before" },
        { task: "Arrange student accommodation", priority: "high" as const, timeframe: "2-3 months before" },
        { task: "Apply for scholarships", priority: "medium" as const, timeframe: "6+ months before" },
      ],
    })
  }
  
  return { categories }
}

function generateUsefulTips(
  profile: Profile,
  countryData: typeof DEFAULT_COUNTRY_DATA
): string[] {
  const tips = [
    "Join expat Facebook groups and forums for your destination",
    "Download offline maps before traveling",
    "Keep digital copies of all important documents",
    "Learn basic emergency phrases in the local language",
    "Set up a VPN if you need access to services from your home country",
    ...countryData.cultureTips.slice(0, 3),
  ]
  
  if (profile.pets) {
    tips.push("Research pet import requirements well in advance - they can be complex")
  }
  
  if (profile.moving_alone === "no") {
    tips.push("Look into family-friendly areas and international schools if applicable")
  }
  
  return tips
}

/**
 * Generate guide from profile - convenience wrapper that returns DB format
 */
export async function generateGuideFromProfile(profile: Profile) {
  const guide = await generateGuide(profile)
  return {
    title: guide.title,
    destination: guide.destination,
    destination_city: guide.destinationCity,
    purpose: guide.purpose,
    sections: {
      overview: guide.overview,
      visa: guide.visa,
      budget: guide.budget,
      housing: guide.housing,
      banking: guide.banking,
      healthcare: guide.healthcare,
      culture: guide.culture,
      jobs: guide.jobs || null,
      education: guide.education || null,
      timeline: guide.timeline,
      checklist: guide.checklist,
      officialLinks: guide.officialLinks,
      usefulTips: guide.usefulTips,
    },
  }
}

/**
 * Convert guide to database format
 */
export function guideToDbFormat(guide: Guide, userId: string, planId?: string) {
  return {
    user_id: userId,
    plan_id: planId,
    title: guide.title,
    destination: guide.destination,
    destination_city: guide.destinationCity,
    purpose: guide.purpose,
    currency: guide.currency,
    overview: guide.overview,
    visa_section: guide.visa,
    budget_section: guide.budget,
    housing_section: guide.housing,
    banking_section: guide.banking,
    healthcare_section: guide.healthcare,
    culture_section: guide.culture,
    jobs_section: guide.jobs || null,
    education_section: guide.education || null,
    timeline_section: guide.timeline,
    checklist_section: guide.checklist,
    official_links: guide.officialLinks,
    useful_tips: guide.usefulTips,
    status: guide.status,
  }
}
