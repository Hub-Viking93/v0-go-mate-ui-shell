// Official government sources database for relocation information

export interface OfficialSource {
  name: string
  url: string
  category: "immigration" | "visa" | "housing" | "banking" | "employment" | "healthcare" | "education" | "tax" | "safety" | "general"
  description?: string
}

export interface CountryOfficialSources {
  immigration?: string
  visaPortal?: string
  housing?: string
  banking?: string
  employment?: string
  healthcare?: string
  education?: string
  tax?: string
  safety?: string
  embassyFinder?: string
}

// Comprehensive official sources by country
export const officialSourcesByCountry: Record<string, CountryOfficialSources> = {
  germany: {
    immigration: "https://www.bamf.de/EN/Startseite/startseite_node.html",
    visaPortal: "https://www.auswaertiges-amt.de/en/visa-service",
    housing: "https://www.immobilienscout24.de/",
    banking: "https://www.bafin.de/EN/",
    employment: "https://www.arbeitsagentur.de/en/welcome",
    healthcare: "https://www.krankenkassen.de/",
    education: "https://www.daad.de/en/",
    tax: "https://www.bzst.de/EN/Home/home_node.html",
    embassyFinder: "https://www.auswaertiges-amt.de/en/aussenpolitik/laender",
  },
  france: {
    immigration: "https://www.immigration.interieur.gouv.fr/",
    visaPortal: "https://france-visas.gouv.fr/en/",
    housing: "https://www.seloger.com/",
    banking: "https://www.banque-france.fr/en",
    employment: "https://www.pole-emploi.fr/accueil/",
    healthcare: "https://www.ameli.fr/",
    education: "https://www.campusfrance.org/en",
    tax: "https://www.impots.gouv.fr/",
  },
  spain: {
    immigration: "https://www.inclusion.gob.es/",
    visaPortal: "https://www.exteriores.gob.es/",
    housing: "https://www.idealista.com/",
    banking: "https://www.bde.es/bde/en/",
    employment: "https://www.sepe.es/",
    healthcare: "https://www.sanidad.gob.es/",
    education: "https://www.educacion.gob.es/",
    tax: "https://sede.agenciatributaria.gob.es/",
  },
  italy: {
    immigration: "https://www.interno.gov.it/",
    visaPortal: "https://vistoperitalia.esteri.it/",
    housing: "https://www.immobiliare.it/",
    banking: "https://www.bancaditalia.it/",
    employment: "https://www.lavoro.gov.it/",
    healthcare: "https://www.salute.gov.it/",
    education: "https://www.miur.gov.it/",
    tax: "https://www.agenziaentrate.gov.it/",
  },
  netherlands: {
    immigration: "https://ind.nl/en",
    visaPortal: "https://www.netherlandsworldwide.nl/visa",
    housing: "https://www.funda.nl/",
    banking: "https://www.dnb.nl/en/",
    employment: "https://www.werk.nl/",
    healthcare: "https://www.government.nl/topics/health-insurance",
    education: "https://www.studyinholland.nl/",
    tax: "https://www.belastingdienst.nl/",
  },
  portugal: {
    immigration: "https://www.sef.pt/",
    visaPortal: "https://www.vistos.mne.gov.pt/",
    housing: "https://www.idealista.pt/",
    banking: "https://www.bportugal.pt/",
    employment: "https://www.iefp.pt/",
    healthcare: "https://www.sns.gov.pt/",
    education: "https://www.dges.gov.pt/",
    tax: "https://www.portaldasfinancas.gov.pt/",
  },
  "united kingdom": {
    immigration: "https://www.gov.uk/browse/visas-immigration",
    visaPortal: "https://www.gov.uk/apply-to-come-to-the-uk",
    housing: "https://www.rightmove.co.uk/",
    banking: "https://www.fca.org.uk/",
    employment: "https://www.gov.uk/jobsearch",
    healthcare: "https://www.nhs.uk/",
    education: "https://www.gov.uk/browse/education",
    tax: "https://www.gov.uk/government/organisations/hm-revenue-customs",
  },
  canada: {
    immigration: "https://www.canada.ca/en/immigration-refugees-citizenship.html",
    visaPortal: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html",
    housing: "https://www.realtor.ca/",
    banking: "https://www.osfi-bsif.gc.ca/",
    employment: "https://www.jobbank.gc.ca/",
    healthcare: "https://www.canada.ca/en/health-canada.html",
    education: "https://www.educanada.ca/",
    tax: "https://www.canada.ca/en/revenue-agency.html",
  },
  "united states": {
    immigration: "https://www.uscis.gov/",
    visaPortal: "https://travel.state.gov/content/travel/en/us-visas.html",
    housing: "https://www.zillow.com/",
    banking: "https://www.federalreserve.gov/",
    employment: "https://www.dol.gov/",
    healthcare: "https://www.healthcare.gov/",
    education: "https://www.ed.gov/",
    tax: "https://www.irs.gov/",
  },
  australia: {
    immigration: "https://immi.homeaffairs.gov.au/",
    visaPortal: "https://immi.homeaffairs.gov.au/visas/getting-a-visa",
    housing: "https://www.realestate.com.au/",
    banking: "https://www.rba.gov.au/",
    employment: "https://www.jobsearch.gov.au/",
    healthcare: "https://www.health.gov.au/",
    education: "https://www.studyaustralia.gov.au/",
    tax: "https://www.ato.gov.au/",
  },
  "new zealand": {
    immigration: "https://www.immigration.govt.nz/",
    visaPortal: "https://www.immigration.govt.nz/new-zealand-visas",
    housing: "https://www.trademe.co.nz/property",
    banking: "https://www.rbnz.govt.nz/",
    employment: "https://www.careers.govt.nz/",
    healthcare: "https://www.health.govt.nz/",
    education: "https://www.studyinnewzealand.govt.nz/",
    tax: "https://www.ird.govt.nz/",
  },
  japan: {
    immigration: "https://www.moj.go.jp/isa/index.html",
    visaPortal: "https://www.mofa.go.jp/j_info/visit/visa/index.html",
    housing: "https://suumo.jp/",
    banking: "https://www.boj.or.jp/en/",
    employment: "https://www.hellowork.mhlw.go.jp/",
    healthcare: "https://www.mhlw.go.jp/english/",
    education: "https://www.studyinjapan.go.jp/en/",
    tax: "https://www.nta.go.jp/english/",
  },
  singapore: {
    immigration: "https://www.ica.gov.sg/",
    visaPortal: "https://www.mom.gov.sg/passes-and-permits",
    housing: "https://www.propertyguru.com.sg/",
    banking: "https://www.mas.gov.sg/",
    employment: "https://www.mom.gov.sg/",
    healthcare: "https://www.moh.gov.sg/",
    education: "https://www.moe.gov.sg/",
    tax: "https://www.iras.gov.sg/",
  },
  "united arab emirates": {
    immigration: "https://icp.gov.ae/en/",
    visaPortal: "https://u.ae/en/information-and-services/visa-and-emirates-id",
    housing: "https://www.propertyfinder.ae/",
    banking: "https://www.centralbank.ae/",
    employment: "https://www.mohre.gov.ae/",
    healthcare: "https://www.mohap.gov.ae/",
    education: "https://www.moe.gov.ae/",
    tax: "https://tax.gov.ae/",
  },
  sweden: {
    immigration: "https://www.migrationsverket.se/English/Startpage.html",
    visaPortal: "https://www.migrationsverket.se/English/Private-individuals/Visiting-Sweden.html",
    housing: "https://www.hemnet.se/",
    employment: "https://arbetsformedlingen.se/",
    healthcare: "https://www.1177.se/",
    education: "https://www.studyinsweden.se/",
    tax: "https://www.skatteverket.se/",
  },
  denmark: {
    immigration: "https://www.nyidanmark.dk/en-GB",
    visaPortal: "https://www.nyidanmark.dk/en-GB/You-want-to-apply",
    housing: "https://www.boliga.dk/",
    employment: "https://www.workindenmark.dk/",
    healthcare: "https://www.sundhed.dk/",
    education: "https://studyindenmark.dk/",
    tax: "https://www.skat.dk/",
  },
  norway: {
    immigration: "https://www.udi.no/en/",
    visaPortal: "https://www.udi.no/en/want-to-apply/",
    housing: "https://www.finn.no/realestate/",
    employment: "https://www.nav.no/",
    healthcare: "https://www.helsenorge.no/",
    education: "https://www.studyinnorway.no/",
    tax: "https://www.skatteetaten.no/en/",
  },
  switzerland: {
    immigration: "https://www.sem.admin.ch/sem/en/home.html",
    visaPortal: "https://www.sem.admin.ch/sem/en/home/themen/einreise.html",
    housing: "https://www.homegate.ch/",
    banking: "https://www.finma.ch/en/",
    employment: "https://www.arbeit.swiss/",
    healthcare: "https://www.bag.admin.ch/",
    tax: "https://www.estv.admin.ch/",
  },
  austria: {
    immigration: "https://www.bmi.gv.at/",
    visaPortal: "https://www.bmeia.gv.at/en/travel-stay/entry-and-stay-in-austria/",
    housing: "https://www.willhaben.at/iad/immobilien",
    employment: "https://www.ams.at/",
    healthcare: "https://www.gesundheit.gv.at/",
    education: "https://www.studyinaustria.at/",
    tax: "https://www.bmf.gv.at/",
  },
  ireland: {
    immigration: "https://www.irishimmigration.ie/",
    visaPortal: "https://www.irishimmigration.ie/coming-to-visit-ireland/",
    housing: "https://www.daft.ie/",
    employment: "https://www.welfare.ie/",
    healthcare: "https://www.hse.ie/",
    education: "https://www.gov.ie/en/campaigns/study-in-ireland/",
    tax: "https://www.revenue.ie/",
  },
}

// Get sources for a country
export function getOfficialSources(country: string): CountryOfficialSources | null {
  const normalized = country.toLowerCase().trim()
  
  // Handle aliases
  const aliases: Record<string, string> = {
    "uk": "united kingdom",
    "usa": "united states",
    "uae": "united arab emirates",
    "dubai": "united arab emirates",
  }
  
  const key = aliases[normalized] || normalized
  return officialSourcesByCountry[key] || null
}

// Get a specific source type for a country
export function getOfficialSource(
  country: string, 
  sourceType: keyof CountryOfficialSources
): string | null {
  const sources = getOfficialSources(country)
  return sources?.[sourceType] || null
}

// Get all sources as an array for display
export function getOfficialSourcesArray(country: string): OfficialSource[] {
  const sources = getOfficialSources(country)
  if (!sources) return []
  
  const categoryMap: Record<keyof CountryOfficialSources, OfficialSource["category"]> = {
    immigration: "immigration",
    visaPortal: "visa",
    housing: "housing",
    banking: "banking",
    employment: "employment",
    healthcare: "healthcare",
    education: "education",
    tax: "tax",
    safety: "safety",
    embassyFinder: "general",
  }
  
  const nameMap: Record<keyof CountryOfficialSources, string> = {
    immigration: "Immigration Authority",
    visaPortal: "Visa Portal",
    housing: "Housing Portal",
    banking: "Banking Authority",
    employment: "Employment Services",
    healthcare: "Healthcare System",
    education: "Education Portal",
    tax: "Tax Authority",
    safety: "Safety Information",
    embassyFinder: "Embassy Finder",
  }
  
  return Object.entries(sources)
    .filter(([, url]) => url)
    .map(([key, url]) => ({
      name: nameMap[key as keyof CountryOfficialSources],
      url: url as string,
      category: categoryMap[key as keyof CountryOfficialSources],
    }))
}
