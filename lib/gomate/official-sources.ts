/**
 * Global Official Sources Registry
 * 
 * Compact 6-category structure for 195 countries.
 * AI + Firecrawl uses these verified URLs to extract real-time information.
 * 
 * Categories:
 * - immigration: Main visa/immigration authority (required)
 * - visa: E-visa or visa application portal
 * - housing: Housing ministry or rental regulations
 * - banking: Central bank or financial regulator
 * - employment: Labor ministry or job portal
 * - safety: Police, emergency, travel advisory
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface CountrySources {
  immigration: string;      // Required - visa/immigration authority
  visa?: string;            // E-visa or visa application portal
  housing?: string;         // Housing ministry or rental regulations
  banking?: string;         // Central bank or financial regulator
  employment?: string;      // Labor ministry or job portal
  safety?: string;          // Police, emergency, travel advisory
}

export interface EmbassyPattern {
  finder: string;
  name: string;
}

// ============================================================================
// EMBASSY PATTERNS - For finding embassies by destination country
// ============================================================================

export const EMBASSY_PATTERNS: Record<string, EmbassyPattern> = {
  "Japan": {
    finder: "https://www.mofa.go.jp/about/emb_cons/mofaserv.html",
    name: "Embassy of Japan"
  },
  "Germany": {
    finder: "https://www.auswaertiges-amt.de/en/aussenpolitik/laenderinformationen",
    name: "German Embassy"
  },
  "United States": {
    finder: "https://www.usembassy.gov/",
    name: "U.S. Embassy"
  },
  "United Kingdom": {
    finder: "https://www.gov.uk/world/embassies",
    name: "British Embassy"
  },
  "Canada": {
    finder: "https://www.international.gc.ca/world-monde/country-pays/index.aspx",
    name: "Canadian Embassy"
  },
  "Australia": {
    finder: "https://www.dfat.gov.au/about-us/our-locations/missions/",
    name: "Australian Embassy"
  },
  "France": {
    finder: "https://www.diplomatie.gouv.fr/en/french-diplomatic-missions/",
    name: "French Embassy"
  },
  "Spain": {
    finder: "https://www.exteriores.gob.es/en/EmbaijdasConsulados/",
    name: "Spanish Embassy"
  },
  "Italy": {
    finder: "https://www.esteri.it/en/ministero/struttura/rete-diplomatica-consolare/",
    name: "Italian Embassy"
  },
  "Netherlands": {
    finder: "https://www.netherlandsworldwide.nl/",
    name: "Dutch Embassy"
  },
  "Sweden": {
    finder: "https://www.swedenabroad.se/",
    name: "Swedish Embassy"
  },
  "Norway": {
    finder: "https://www.norway.no/en/",
    name: "Norwegian Embassy"
  },
  "South Korea": {
    finder: "https://www.mofa.go.kr/eng/nation/m_4882/list.do",
    name: "Korean Embassy"
  },
  "Singapore": {
    finder: "https://www.mfa.gov.sg/Overseas-Missions",
    name: "Singapore Embassy"
  },
  "New Zealand": {
    finder: "https://www.mfat.govt.nz/en/embassies/",
    name: "New Zealand Embassy"
  },
  "Portugal": {
    finder: "https://portaldiplomatico.mne.gov.pt/en/embassies-and-consulates",
    name: "Portuguese Embassy"
  },
  "Switzerland": {
    finder: "https://www.eda.admin.ch/eda/en/home/representations-and-travel-advice.html",
    name: "Swiss Embassy"
  },
  "China": {
    finder: "http://www.china-embassy.org/eng/",
    name: "Chinese Embassy"
  },
  "UAE": {
    finder: "https://www.mofaic.gov.ae/en/Missions",
    name: "UAE Embassy"
  },
  "India": {
    finder: "https://www.mea.gov.in/indian-missions-abroad.htm",
    name: "Indian Embassy"
  },
  "Brazil": {
    finder: "https://www.gov.br/mre/en/subjects/diplomatic-missions",
    name: "Brazilian Embassy"
  },
  "Mexico": {
    finder: "https://directorio.sre.gob.mx/index.php/embajadas-de-mexico-en-el-mundo",
    name: "Mexican Embassy"
  },
  "South Africa": {
    finder: "https://www.dirco.gov.za/foreign-relations/sa-abroad/",
    name: "South African Embassy"
  },
  "Thailand": {
    finder: "https://www.thaiembassy.com/",
    name: "Thai Embassy"
  },
  "Malaysia": {
    finder: "https://www.kln.gov.my/",
    name: "Malaysian Embassy"
  },
  "Indonesia": {
    finder: "https://kemlu.go.id/",
    name: "Indonesian Embassy"
  },
  "Philippines": {
    finder: "https://dfa.gov.ph/",
    name: "Philippine Embassy"
  },
  "Vietnam": {
    finder: "https://vietnamembassy.us/",
    name: "Vietnamese Embassy"
  }
};

// ============================================================================
// OFFICIAL SOURCES REGISTRY - Phase 6.1: First 50 Countries
// ============================================================================

export const OFFICIAL_SOURCES: Record<string, CountrySources> = {
  // =========================================================================
  // EUROPE (20 countries)
  // =========================================================================
  
  "Germany": {
    immigration: "https://www.make-it-in-germany.com/en/",
    visa: "https://www.auswaertiges-amt.de/en/visa-service",
    housing: "https://www.immobilienscout24.de/",
    banking: "https://www.bundesbank.de/en/",
    employment: "https://www.arbeitsagentur.de/en/welcome",
    safety: "https://www.polizei.de/"
  },
  
  "Portugal": {
    immigration: "https://imigrante.sef.pt/en/",
    visa: "https://vistos.mne.gov.pt/en/",
    housing: "https://www.idealista.pt/",
    banking: "https://www.bportugal.pt/en",
    employment: "https://www.iefp.pt/",
    safety: "https://www.psp.pt/"
  },
  
  "Spain": {
    immigration: "https://www.inclusion.gob.es/web/guest/home",
    visa: "https://www.exteriores.gob.es/en/ServiciosAlCiudadano/Paginas/Visados.aspx",
    housing: "https://www.idealista.com/",
    banking: "https://www.bde.es/bde/en/",
    employment: "https://www.sepe.es/",
    safety: "https://www.policia.es/"
  },
  
  "Netherlands": {
    immigration: "https://ind.nl/en",
    visa: "https://www.netherlandsworldwide.nl/visa-the-netherlands",
    housing: "https://www.funda.nl/",
    banking: "https://www.dnb.nl/en/",
    employment: "https://www.werk.nl/",
    safety: "https://www.politie.nl/"
  },
  
  "United Kingdom": {
    immigration: "https://www.gov.uk/browse/visas-immigration",
    visa: "https://www.gov.uk/apply-to-come-to-the-uk",
    housing: "https://www.rightmove.co.uk/",
    banking: "https://www.bankofengland.co.uk/",
    employment: "https://www.gov.uk/jobsearch",
    safety: "https://www.police.uk/"
  },
  
  "France": {
    immigration: "https://www.france-visas.gouv.fr/en/",
    visa: "https://www.service-public.fr/particuliers/vosdroits/N19804?lang=en",
    housing: "https://www.seloger.com/",
    banking: "https://www.banque-france.fr/en",
    employment: "https://www.pole-emploi.fr/",
    safety: "https://www.police-nationale.interieur.gouv.fr/"
  },
  
  "Italy": {
    immigration: "https://vistoperitalia.esteri.it/home/en",
    visa: "https://www.esteri.it/en/servizi-consolari-e-visti/",
    housing: "https://www.immobiliare.it/",
    banking: "https://www.bancaditalia.it/",
    employment: "https://www.anpal.gov.it/",
    safety: "https://www.poliziadistato.it/"
  },
  
  "Sweden": {
    immigration: "https://www.migrationsverket.se/English/",
    visa: "https://www.swedenabroad.se/en/about-sweden-non-swedish-citizens/going-to-sweden/",
    housing: "https://www.hemnet.se/",
    banking: "https://www.riksbank.se/en-gb/",
    employment: "https://arbetsformedlingen.se/other-languages/english-engelska",
    safety: "https://polisen.se/en/"
  },
  
  "Switzerland": {
    immigration: "https://www.sem.admin.ch/sem/en/home.html",
    visa: "https://www.eda.admin.ch/eda/en/fdfa/entry-switzerland-residence.html",
    housing: "https://www.homegate.ch/",
    banking: "https://www.snb.ch/en/",
    employment: "https://www.arbeit.swiss/",
    safety: "https://www.fedpol.admin.ch/fedpol/en/home.html"
  },
  
  "Austria": {
    immigration: "https://www.migration.gv.at/en/",
    visa: "https://www.bmeia.gv.at/en/travel-stay/entry-and-residence-in-austria/",
    housing: "https://www.willhaben.at/iad/immobilien",
    banking: "https://www.oenb.at/en/",
    employment: "https://www.ams.at/",
    safety: "https://www.polizei.gv.at/"
  },
  
  "Ireland": {
    immigration: "https://www.irishimmigration.ie/",
    visa: "https://www.visas.inis.gov.ie/",
    housing: "https://www.daft.ie/",
    banking: "https://www.centralbank.ie/",
    employment: "https://www.gov.ie/en/service/40cf48-find-a-job/",
    safety: "https://www.garda.ie/"
  },
  
  "Poland": {
    immigration: "https://www.gov.pl/web/mswia-en/migration",
    visa: "https://www.gov.pl/web/diplomacy/visas",
    housing: "https://www.otodom.pl/",
    banking: "https://www.nbp.pl/homen.aspx",
    employment: "https://www.praca.gov.pl/",
    safety: "https://www.policja.pl/"
  },
  
  "Czech Republic": {
    immigration: "https://www.mvcr.cz/mvcren/",
    visa: "https://www.mzv.cz/jnp/en/information_for_aliens/",
    housing: "https://www.sreality.cz/",
    banking: "https://www.cnb.cz/en/",
    employment: "https://www.mpsv.cz/web/en",
    safety: "https://www.policie.cz/"
  },
  
  "Hungary": {
    immigration: "https://www.bmbah.hu/",
    visa: "https://konzuliszolgalat.kormany.hu/en",
    housing: "https://ingatlan.com/",
    banking: "https://www.mnb.hu/en",
    employment: "https://nfsz.munka.hu/",
    safety: "https://www.police.hu/"
  },
  
  "Denmark": {
    immigration: "https://www.nyidanmark.dk/en-GB",
    visa: "https://www.um.dk/en/travel-and-residence/",
    housing: "https://www.boligportal.dk/",
    banking: "https://www.nationalbanken.dk/en",
    employment: "https://jobnet.dk/",
    safety: "https://politi.dk/en"
  },
  
  "Norway": {
    immigration: "https://www.udi.no/en/",
    visa: "https://www.norway.no/en/missions/",
    housing: "https://www.finn.no/realestate/",
    banking: "https://www.norges-bank.no/en/",
    employment: "https://www.nav.no/en/home",
    safety: "https://www.politiet.no/en/"
  },
  
  "Belgium": {
    immigration: "https://dofi.ibz.be/en",
    visa: "https://diplomatie.belgium.be/en/travel-to-belgium/visa-belgium",
    housing: "https://www.immoweb.be/",
    banking: "https://www.nbb.be/en",
    employment: "https://www.actiris.brussels/en/",
    safety: "https://www.police.be/"
  },
  
  "Greece": {
    immigration: "https://migration.gov.gr/en/",
    visa: "https://www.mfa.gr/en/visas/",
    housing: "https://www.spitogatos.gr/",
    banking: "https://www.bankofgreece.gr/en/",
    employment: "https://www.dypa.gov.gr/",
    safety: "https://www.astynomia.gr/"
  },
  
  "Finland": {
    immigration: "https://migri.fi/en/home",
    visa: "https://um.fi/visa-to-finland",
    housing: "https://www.oikotie.fi/",
    banking: "https://www.suomenpankki.fi/en/",
    employment: "https://www.te-palvelut.fi/en/",
    safety: "https://poliisi.fi/en/"
  },
  
  "Croatia": {
    immigration: "https://mup.gov.hr/aliens-702/702",
    visa: "https://mvep.gov.hr/services-for-citizens/visas-background-21501/21501",
    housing: "https://www.njuskalo.hr/nekretnine",
    banking: "https://www.hnb.hr/home",
    employment: "https://www.hzz.hr/",
    safety: "https://mup.gov.hr/"
  },

  // =========================================================================
  // ASIA (12 countries)
  // =========================================================================
  
  "Japan": {
    immigration: "https://www.isa.go.jp/en/",
    visa: "https://www.mofa.go.jp/j_info/visit/visa/",
    housing: "https://suumo.jp/",
    banking: "https://www.boj.or.jp/en/",
    employment: "https://www.hellowork.mhlw.go.jp/",
    safety: "https://www.npa.go.jp/english/"
  },
  
  "South Korea": {
    immigration: "https://www.immigration.go.kr/immigration_eng/index.do",
    visa: "https://www.visa.go.kr/",
    housing: "https://www.zigbang.com/",
    banking: "https://www.bok.or.kr/eng/main/main.do",
    employment: "https://www.work.go.kr/",
    safety: "https://www.police.go.kr/eng/index.do"
  },
  
  "Thailand": {
    immigration: "https://www.immigration.go.th/",
    visa: "https://thaievisa.go.th/",
    housing: "https://www.ddproperty.com/",
    banking: "https://www.bot.or.th/en/",
    employment: "https://www.doe.go.th/",
    safety: "https://www.royalthaipolice.go.th/"
  },
  
  "Singapore": {
    immigration: "https://www.ica.gov.sg/",
    visa: "https://www.mom.gov.sg/passes-and-permits",
    housing: "https://www.propertyguru.com.sg/",
    banking: "https://www.mas.gov.sg/",
    employment: "https://www.mycareersfuture.gov.sg/",
    safety: "https://www.police.gov.sg/"
  },
  
  "UAE": {
    immigration: "https://icp.gov.ae/en/",
    visa: "https://www.mohre.gov.ae/en/home.aspx",
    housing: "https://www.propertyfinder.ae/",
    banking: "https://www.centralbank.ae/en",
    employment: "https://www.mohre.gov.ae/en/services/work-permit.aspx",
    safety: "https://www.dubaipolice.gov.ae/"
  },
  
  "India": {
    immigration: "https://www.mea.gov.in/",
    visa: "https://indianvisaonline.gov.in/",
    housing: "https://www.99acres.com/",
    banking: "https://www.rbi.org.in/",
    employment: "https://www.ncs.gov.in/",
    safety: "https://www.mha.gov.in/"
  },
  
  "Vietnam": {
    immigration: "https://www.immigration.gov.vn/",
    visa: "https://evisa.xuatnhapcanh.gov.vn/",
    housing: "https://batdongsan.com.vn/",
    banking: "https://www.sbv.gov.vn/",
    employment: "https://www.molisa.gov.vn/",
    safety: "https://bocongan.gov.vn/"
  },
  
  "Malaysia": {
    immigration: "https://www.imi.gov.my/",
    visa: "https://www.windowmalaysia.my/",
    housing: "https://www.propertyguru.com.my/",
    banking: "https://www.bnm.gov.my/",
    employment: "https://www.mohr.gov.my/",
    safety: "https://www.rmp.gov.my/"
  },
  
  "Indonesia": {
    immigration: "https://www.imigrasi.go.id/",
    visa: "https://visa-online.imigrasi.go.id/",
    housing: "https://www.rumah123.com/",
    banking: "https://www.bi.go.id/en/",
    employment: "https://kemnaker.go.id/",
    safety: "https://www.polri.go.id/"
  },
  
  "Philippines": {
    immigration: "https://immigration.gov.ph/",
    visa: "https://www.dfa.gov.ph/",
    housing: "https://www.lamudi.com.ph/",
    banking: "https://www.bsp.gov.ph/",
    employment: "https://www.dole.gov.ph/",
    safety: "https://pnp.gov.ph/"
  },
  
  "Taiwan": {
    immigration: "https://www.immigration.gov.tw/",
    visa: "https://www.boca.gov.tw/",
    housing: "https://www.591.com.tw/",
    banking: "https://www.cbc.gov.tw/en/",
    employment: "https://www.mol.gov.tw/",
    safety: "https://www.npa.gov.tw/"
  },
  
  "Hong Kong": {
    immigration: "https://www.immd.gov.hk/eng/",
    visa: "https://www.gov.hk/en/nonresidents/visarequire/",
    housing: "https://www.28hse.com/",
    banking: "https://www.hkma.gov.hk/",
    employment: "https://www.labour.gov.hk/",
    safety: "https://www.police.gov.hk/"
  },

  // =========================================================================
  // AMERICAS (10 countries)
  // =========================================================================
  
  "United States": {
    immigration: "https://www.uscis.gov/",
    visa: "https://travel.state.gov/content/travel/en/us-visas.html",
    housing: "https://www.zillow.com/",
    banking: "https://www.federalreserve.gov/",
    employment: "https://www.dol.gov/",
    safety: "https://www.usa.gov/crime"
  },
  
  "Canada": {
    immigration: "https://www.canada.ca/en/immigration-refugees-citizenship.html",
    visa: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html",
    housing: "https://www.realtor.ca/",
    banking: "https://www.bankofcanada.ca/",
    employment: "https://www.jobbank.gc.ca/",
    safety: "https://www.rcmp-grc.gc.ca/"
  },
  
  "Mexico": {
    immigration: "https://www.gob.mx/inm",
    visa: "https://www.gob.mx/sre/acciones-y-programas/visa-information",
    housing: "https://www.inmuebles24.com/",
    banking: "https://www.banxico.org.mx/",
    employment: "https://www.empleo.gob.mx/",
    safety: "https://www.gob.mx/segob"
  },
  
  "Brazil": {
    immigration: "https://www.gov.br/pf/pt-br/assuntos/imigracao",
    visa: "https://www.gov.br/mre/pt-br/assuntos/portal-consular/vistos",
    housing: "https://www.zapimoveis.com.br/",
    banking: "https://www.bcb.gov.br/en",
    employment: "https://empregabrasil.mte.gov.br/",
    safety: "https://www.gov.br/pf/pt-br"
  },
  
  "Argentina": {
    immigration: "https://www.argentina.gob.ar/interior/migraciones",
    visa: "https://www.cancilleria.gob.ar/en/services/visas",
    housing: "https://www.zonaprop.com.ar/",
    banking: "https://www.bcra.gob.ar/",
    employment: "https://www.argentina.gob.ar/trabajo",
    safety: "https://www.argentina.gob.ar/seguridad"
  },
  
  "Chile": {
    immigration: "https://www.extranjeria.gob.cl/",
    visa: "https://www.chile.gob.cl/",
    housing: "https://www.portalinmobiliario.com/",
    banking: "https://www.bcentral.cl/",
    employment: "https://www.chilevalora.cl/",
    safety: "https://www.carabineros.cl/"
  },
  
  "Colombia": {
    immigration: "https://www.migracioncolombia.gov.co/",
    visa: "https://www.cancilleria.gov.co/tramites_servicios/visa",
    housing: "https://www.fincaraiz.com.co/",
    banking: "https://www.banrep.gov.co/",
    employment: "https://www.mintrabajo.gov.co/",
    safety: "https://www.policia.gov.co/"
  },
  
  "Costa Rica": {
    immigration: "https://www.migracion.go.cr/",
    visa: "https://www.rree.go.cr/",
    housing: "https://www.encuentra24.com/costa-rica",
    banking: "https://www.bccr.fi.cr/",
    employment: "https://www.mtss.go.cr/",
    safety: "https://www.seguridadpublica.go.cr/"
  },
  
  "Panama": {
    immigration: "https://www.migracion.gob.pa/",
    visa: "https://www.mire.gob.pa/",
    housing: "https://www.encuentra24.com/panama",
    banking: "https://www.superbancos.gob.pa/",
    employment: "https://www.mitradel.gob.pa/",
    safety: "https://www.policia.gob.pa/"
  },
  
  "Peru": {
    immigration: "https://www.migraciones.gob.pe/",
    visa: "https://www.gob.pe/rree",
    housing: "https://www.adondevivir.com/",
    banking: "https://www.bcrp.gob.pe/",
    employment: "https://www.gob.pe/mtpe",
    safety: "https://www.policia.gob.pe/"
  },

  // =========================================================================
  // OCEANIA (3 countries)
  // =========================================================================
  
  "Australia": {
    immigration: "https://immi.homeaffairs.gov.au/",
    visa: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder",
    housing: "https://www.realestate.com.au/",
    banking: "https://www.rba.gov.au/",
    employment: "https://www.seek.com.au/",
    safety: "https://www.afp.gov.au/"
  },
  
  "New Zealand": {
    immigration: "https://www.immigration.govt.nz/",
    visa: "https://www.immigration.govt.nz/new-zealand-visas",
    housing: "https://www.trademe.co.nz/property",
    banking: "https://www.rbnz.govt.nz/",
    employment: "https://www.seek.co.nz/",
    safety: "https://www.police.govt.nz/"
  },
  
  "Fiji": {
    immigration: "https://www.immigration.gov.fj/",
    visa: "https://www.fiji.gov.fj/",
    housing: "https://www.fijirealestate.com/",
    banking: "https://www.rbf.gov.fj/",
    employment: "https://www.employment.gov.fj/",
    safety: "https://www.fiji.gov.fj/police"
  },

  // =========================================================================
  // AFRICA (5 countries)
  // =========================================================================
  
  "South Africa": {
    immigration: "https://www.dha.gov.za/",
    visa: "https://www.vfsvisaonline.com/southafrica/",
    housing: "https://www.property24.com/",
    banking: "https://www.resbank.co.za/",
    employment: "https://www.labour.gov.za/",
    safety: "https://www.saps.gov.za/"
  },
  
  "Morocco": {
    immigration: "https://www.service-public.ma/",
    visa: "https://www.consulat.ma/",
    housing: "https://www.mubawab.ma/",
    banking: "https://www.bkam.ma/",
    employment: "https://www.anapec.org/",
    safety: "https://www.police.gov.ma/"
  },
  
  "Egypt": {
    immigration: "https://www.immigration.gov.eg/",
    visa: "https://visa2egypt.gov.eg/",
    housing: "https://www.propertyfinder.eg/",
    banking: "https://www.cbe.org.eg/",
    employment: "https://www.manpower.gov.eg/",
    safety: "https://www.moi.gov.eg/"
  },
  
  "Kenya": {
    immigration: "https://immigration.go.ke/",
    visa: "https://evisa.go.ke/",
    housing: "https://www.buyrentkenya.com/",
    banking: "https://www.centralbank.go.ke/",
    employment: "https://www.labour.go.ke/",
    safety: "https://www.nationalpolice.go.ke/"
  },
  
  "Nigeria": {
    immigration: "https://immigration.gov.ng/",
    visa: "https://portal.immigration.gov.ng/",
    housing: "https://www.propertypro.ng/",
    banking: "https://www.cbn.gov.ng/",
    employment: "https://www.labour.gov.ng/",
    safety: "https://www.npf.gov.ng/"
  },

  // =========================================================================
  // PHASE 6.2: EUROPE (15 additional countries) - Total: 35
  // =========================================================================
  
  "Romania": {
    immigration: "https://igi.mai.gov.ro/en/",
    visa: "https://evisa.mae.ro/",
    housing: "https://www.imobiliare.ro/",
    banking: "https://www.bnr.ro/",
    employment: "https://www.anofm.ro/",
    safety: "https://www.politiaromana.ro/"
  },
  
  "Bulgaria": {
    immigration: "https://www.mvr.bg/en/",
    visa: "https://www.mfa.bg/en/services-travel/consular-services/visa",
    housing: "https://www.imot.bg/",
    banking: "https://www.bnb.bg/",
    employment: "https://www.az.government.bg/",
    safety: "https://www.mvr.bg/en/"
  },
  
  "Estonia": {
    immigration: "https://www.politsei.ee/en/",
    visa: "https://vm.ee/en/visa-information",
    housing: "https://www.kv.ee/",
    banking: "https://www.eestipank.ee/en",
    employment: "https://www.tootukassa.ee/en",
    safety: "https://www.politsei.ee/en/"
  },
  
  "Latvia": {
    immigration: "https://www.pmlp.gov.lv/en",
    visa: "https://www.mfa.gov.lv/en/consular-information/visas",
    housing: "https://www.ss.lv/",
    banking: "https://www.bank.lv/en/",
    employment: "https://www.nva.gov.lv/en",
    safety: "https://www.vp.gov.lv/"
  },
  
  "Lithuania": {
    immigration: "https://www.migracija.lt/en/",
    visa: "https://keliauk.urm.lt/en/",
    housing: "https://www.aruodas.lt/",
    banking: "https://www.lb.lt/en/",
    employment: "https://uzt.lt/en/",
    safety: "https://policija.lt/"
  },
  
  "Slovakia": {
    immigration: "https://www.minv.sk/?uhcp-en",
    visa: "https://www.mzv.sk/en/consular-info/visa-information",
    housing: "https://www.nehnutelnosti.sk/",
    banking: "https://www.nbs.sk/en/",
    employment: "https://www.upsvr.gov.sk/",
    safety: "https://www.minv.sk/?policia"
  },
  
  "Slovenia": {
    immigration: "https://www.gov.si/en/topics/entering-and-residing/",
    visa: "https://www.gov.si/en/topics/visa-information/",
    housing: "https://www.nepremicnine.net/",
    banking: "https://www.bsi.si/en/",
    employment: "https://www.ess.gov.si/",
    safety: "https://www.policija.si/"
  },
  
  "Malta": {
    immigration: "https://homeaffairs.gov.mt/en/mhas-departments/identity-malta-agency/",
    visa: "https://foreignandeu.gov.mt/en/Pages/Visa-Information.aspx",
    housing: "https://www.maltapark.com/",
    banking: "https://www.centralbankmalta.org/",
    employment: "https://jobsplus.gov.mt/",
    safety: "https://pulizija.gov.mt/"
  },
  
  "Luxembourg": {
    immigration: "https://maee.gouvernement.lu/en/services-aux-citoyens/immigration.html",
    visa: "https://maee.gouvernement.lu/en/services-aux-citoyens/visa.html",
    housing: "https://www.athome.lu/",
    banking: "https://www.bcl.lu/en/",
    employment: "https://adem.public.lu/en.html",
    safety: "https://police.public.lu/"
  },
  
  "Cyprus": {
    immigration: "https://www.moi.gov.cy/moi/crmd/crmd.nsf/",
    visa: "https://www.mfa.gov.cy/visa",
    housing: "https://www.bazaraki.com/real-estate/",
    banking: "https://www.centralbank.cy/",
    employment: "https://www.mlsi.gov.cy/",
    safety: "https://www.police.gov.cy/"
  },
  
  "Iceland": {
    immigration: "https://www.utl.is/index.php/en/",
    visa: "https://www.government.is/topics/foreign-affairs/visa-to-iceland/",
    housing: "https://www.mbl.is/fasteignir/",
    banking: "https://www.cb.is/",
    employment: "https://www.vinnumalastofnun.is/en",
    safety: "https://www.logreglan.is/english/"
  },
  
  "Serbia": {
    immigration: "https://www.mup.gov.rs/wps/portal/en/",
    visa: "https://www.mfa.gov.rs/en/citizens/travel-serbia/visa-regime",
    housing: "https://www.nekretnine.rs/",
    banking: "https://www.nbs.rs/en/",
    employment: "https://www.nsz.gov.rs/",
    safety: "https://www.mup.gov.rs/"
  },
  
  "Albania": {
    immigration: "https://e-albania.al/",
    visa: "https://punetejashtme.gov.al/en/",
    housing: "https://www.merrjep.al/",
    banking: "https://www.bankofalbania.org/",
    employment: "https://www.shkp.gov.al/",
    safety: "https://www.asp.gov.al/"
  },
  
  "Montenegro": {
    immigration: "https://www.gov.me/en/mup",
    visa: "https://www.gov.me/en/mfa",
    housing: "https://www.nekretnine.me/",
    banking: "https://www.cbcg.me/en",
    employment: "https://www.zzzcg.me/",
    safety: "https://www.gov.me/en/mup"
  },
  
  "North Macedonia": {
    immigration: "https://mvr.gov.mk/",
    visa: "https://www.mfa.gov.mk/en/page/6/visa-regimes",
    housing: "https://www.pazar3.mk/",
    banking: "https://www.nbrm.mk/",
    employment: "https://av.gov.mk/",
    safety: "https://mvr.gov.mk/"
  },

  // =========================================================================
  // PHASE 6.2: ASIA (15 additional countries) - Total: 27
  // =========================================================================
  
  "China": {
    immigration: "https://www.nia.gov.cn/",
    visa: "https://www.visaforchina.cn/",
    housing: "https://www.fang.com/",
    banking: "https://www.pbc.gov.cn/en/",
    employment: "https://www.mohrss.gov.cn/",
    safety: "https://www.mps.gov.cn/"
  },
  
  "Israel": {
    immigration: "https://www.gov.il/en/departments/population_and_immigration_authority",
    visa: "https://embassies.gov.il/",
    housing: "https://www.yad2.co.il/",
    banking: "https://www.boi.org.il/en/",
    employment: "https://www.gov.il/en/departments/ministry_of_labor",
    safety: "https://www.police.gov.il/"
  },
  
  "Jordan": {
    immigration: "https://moi.gov.jo/",
    visa: "https://www.mfa.gov.jo/",
    housing: "https://jo.opensooq.com/",
    banking: "https://www.cbj.gov.jo/",
    employment: "https://mol.gov.jo/",
    safety: "https://www.psd.gov.jo/"
  },
  
  "Qatar": {
    immigration: "https://www.moi.gov.qa/",
    visa: "https://portal.moi.gov.qa/",
    housing: "https://www.propertyfinder.qa/",
    banking: "https://www.qcb.gov.qa/",
    employment: "https://www.adlsa.gov.qa/",
    safety: "https://www.moi.gov.qa/"
  },
  
  "Saudi Arabia": {
    immigration: "https://www.moi.gov.sa/",
    visa: "https://visa.mofa.gov.sa/",
    housing: "https://sa.aqar.fm/",
    banking: "https://www.sama.gov.sa/en-us/",
    employment: "https://hrsd.gov.sa/en",
    safety: "https://www.moi.gov.sa/"
  },
  
  "Bahrain": {
    immigration: "https://www.npra.gov.bh/",
    visa: "https://www.evisa.gov.bh/",
    housing: "https://www.propertyfinder.bh/",
    banking: "https://www.cbb.gov.bh/",
    employment: "https://www.lmra.bh/",
    safety: "https://www.interior.gov.bh/"
  },
  
  "Kuwait": {
    immigration: "https://www.moi.gov.kw/",
    visa: "https://www.mofa.gov.kw/",
    housing: "https://www.4sale.com.kw/",
    banking: "https://www.cbk.gov.kw/",
    employment: "https://www.manpower.gov.kw/",
    safety: "https://www.moi.gov.kw/"
  },
  
  "Oman": {
    immigration: "https://www.rop.gov.om/",
    visa: "https://evisa.rop.gov.om/",
    housing: "https://www.propertyfinder.om/",
    banking: "https://cbo.gov.om/",
    employment: "https://www.mol.gov.om/",
    safety: "https://www.rop.gov.om/"
  },
  
  "Sri Lanka": {
    immigration: "https://www.immigration.gov.lk/",
    visa: "https://www.eta.gov.lk/",
    housing: "https://www.lankapropertyweb.com/",
    banking: "https://www.cbsl.gov.lk/",
    employment: "https://www.labourdept.gov.lk/",
    safety: "https://www.police.lk/"
  },
  
  "Nepal": {
    immigration: "https://www.immigration.gov.np/",
    visa: "https://online.nepalimmigration.gov.np/",
    housing: "https://hamrobazaar.com/",
    banking: "https://www.nrb.org.np/",
    employment: "https://moless.gov.np/",
    safety: "https://www.nepalpolice.gov.np/"
  },
  
  "Bangladesh": {
    immigration: "https://www.dip.gov.bd/",
    visa: "https://www.visa.gov.bd/",
    housing: "https://www.bproperty.com/",
    banking: "https://www.bb.org.bd/",
    employment: "https://bmet.gov.bd/",
    safety: "https://www.police.gov.bd/"
  },
  
  "Cambodia": {
    immigration: "https://www.immigration.gov.kh/",
    visa: "https://www.evisa.gov.kh/",
    housing: "https://www.realestate.com.kh/",
    banking: "https://www.nbc.gov.kh/",
    employment: "https://www.mlvt.gov.kh/",
    safety: "https://www.police.gov.kh/"
  },
  
  "Myanmar": {
    immigration: "https://www.mip.gov.mm/",
    visa: "https://evisa.moip.gov.mm/",
    housing: "https://www.imyanmarhouse.com/",
    banking: "https://www.cbm.gov.mm/",
    employment: "https://www.mol.gov.mm/",
    safety: "https://www.mip.gov.mm/"
  },
  
  "Pakistan": {
    immigration: "https://www.interior.gov.pk/",
    visa: "https://visa.nadra.gov.pk/",
    housing: "https://www.zameen.com/",
    banking: "https://www.sbp.org.pk/",
    employment: "https://ophrd.gov.pk/",
    safety: "https://www.police.gov.pk/"
  },
  
  "Kazakhstan": {
    immigration: "https://www.gov.kz/",
    visa: "https://www.vmp.gov.kz/",
    housing: "https://krisha.kz/",
    banking: "https://www.nationalbank.kz/",
    employment: "https://www.enbek.kz/",
    safety: "https://www.gov.kz/memleket/entities/qriim"
  },

  // =========================================================================
  // PHASE 6.2: AMERICAS (10 additional countries) - Total: 20
  // =========================================================================
  
  "Uruguay": {
    immigration: "https://www.gub.uy/ministerio-relaciones-exteriores/",
    visa: "https://www.gub.uy/tramites/visa-residencia",
    housing: "https://www.gallito.com.uy/",
    banking: "https://www.bcu.gub.uy/",
    employment: "https://www.mtss.gub.uy/",
    safety: "https://www.minterior.gub.uy/"
  },
  
  "Ecuador": {
    immigration: "https://www.cancilleria.gob.ec/",
    visa: "https://www.gob.ec/mremh/tramites/visa-residencia",
    housing: "https://www.plusvalia.com/",
    banking: "https://www.bce.fin.ec/",
    employment: "https://www.trabajo.gob.ec/",
    safety: "https://www.ministeriodegobierno.gob.ec/"
  },
  
  "Bolivia": {
    immigration: "https://www.migracion.gob.bo/",
    visa: "https://www.cancilleria.gob.bo/",
    housing: "https://www.clasificados.com.bo/",
    banking: "https://www.bcb.gob.bo/",
    employment: "https://www.mintrabajo.gob.bo/",
    safety: "https://www.policia.bo/"
  },
  
  "Paraguay": {
    immigration: "https://www.migraciones.gov.py/",
    visa: "https://www.mre.gov.py/",
    housing: "https://www.clasipar.com.py/",
    banking: "https://www.bcp.gov.py/",
    employment: "https://www.mtess.gov.py/",
    safety: "https://www.policianacional.gov.py/"
  },
  
  "Guatemala": {
    immigration: "https://igm.gob.gt/",
    visa: "https://www.minex.gob.gt/",
    housing: "https://www.encuentra24.com/guatemala",
    banking: "https://www.banguat.gob.gt/",
    employment: "https://www.mintrabajo.gob.gt/",
    safety: "https://pnc.gob.gt/"
  },
  
  "Honduras": {
    immigration: "https://inm.gob.hn/",
    visa: "https://www.sre.gob.hn/",
    housing: "https://www.encuentra24.com/honduras",
    banking: "https://www.bch.hn/",
    employment: "https://www.trabajo.gob.hn/",
    safety: "https://www.policianacional.gob.hn/"
  },
  
  "Nicaragua": {
    immigration: "https://www.migob.gob.ni/migracion/",
    visa: "https://www.cancilleria.gob.ni/",
    housing: "https://www.encuentra24.com/nicaragua",
    banking: "https://www.bcn.gob.ni/",
    employment: "https://www.mitrab.gob.ni/",
    safety: "https://www.policia.gob.ni/"
  },
  
  "El Salvador": {
    immigration: "https://www.migracion.gob.sv/",
    visa: "https://www.rree.gob.sv/",
    housing: "https://www.encuentra24.com/el-salvador",
    banking: "https://www.bcr.gob.sv/",
    employment: "https://www.mtps.gob.sv/",
    safety: "https://www.pnc.gob.sv/"
  },
  
  "Dominican Republic": {
    immigration: "https://www.dgm.gob.do/",
    visa: "https://www.mirex.gob.do/",
    housing: "https://www.corotos.com.do/",
    banking: "https://www.bancentral.gov.do/",
    employment: "https://mt.gob.do/",
    safety: "https://www.policianacional.gob.do/"
  },
  
  "Jamaica": {
    immigration: "https://www.pica.gov.jm/",
    visa: "https://www.mfaft.gov.jm/",
    housing: "https://www.jamaicaclassifiedsonline.com/",
    banking: "https://boj.org.jm/",
    employment: "https://www.mlss.gov.jm/",
    safety: "https://www.jcf.gov.jm/"
  },

  // =========================================================================
  // PHASE 6.2: AFRICA (10 additional countries) - Total: 15
  // =========================================================================
  
  "Tunisia": {
    immigration: "https://www.migration.gov.tn/",
    visa: "https://www.diplomatie.gov.tn/",
    housing: "https://www.mubawab.tn/",
    banking: "https://www.bct.gov.tn/",
    employment: "https://www.emploi.gov.tn/",
    safety: "https://www.interieur.gov.tn/"
  },
  
  "Ghana": {
    immigration: "https://home.gis.gov.gh/",
    visa: "https://www.mfa.gov.gh/",
    housing: "https://www.meqasa.com/",
    banking: "https://www.bog.gov.gh/",
    employment: "https://www.melr.gov.gh/",
    safety: "https://police.gov.gh/"
  },
  
  "Tanzania": {
    immigration: "https://www.immigration.go.tz/",
    visa: "https://visa.immigration.go.tz/",
    housing: "https://www.zoomtanzania.com/",
    banking: "https://www.bot.go.tz/",
    employment: "https://www.kazi.go.tz/",
    safety: "https://www.polisi.go.tz/"
  },
  
  "Uganda": {
    immigration: "https://www.immigration.go.ug/",
    visa: "https://visas.immigration.go.ug/",
    housing: "https://www.lamudi.co.ug/",
    banking: "https://www.bou.or.ug/",
    employment: "https://www.mglsd.go.ug/",
    safety: "https://www.upf.go.ug/"
  },
  
  "Rwanda": {
    immigration: "https://www.migration.gov.rw/",
    visa: "https://www.migration.gov.rw/",
    housing: "https://www.jumia.rw/",
    banking: "https://www.bnr.rw/",
    employment: "https://www.mifotra.gov.rw/",
    safety: "https://www.police.gov.rw/"
  },
  
  "Ethiopia": {
    immigration: "https://www.evisa.gov.et/",
    visa: "https://www.evisa.gov.et/",
    housing: "https://ethiopianproperties.com/",
    banking: "https://www.nbe.gov.et/",
    employment: "https://www.molsa.gov.et/",
    safety: "https://www.efp.gov.et/"
  },
  
  "Senegal": {
    immigration: "https://www.dgpn.sn/",
    visa: "https://www.diplomatie.gouv.sn/",
    housing: "https://www.expat-dakar.com/",
    banking: "https://www.bceao.int/",
    employment: "https://www.emploi.gouv.sn/",
    safety: "https://www.dgpn.sn/"
  },
  
  "Ivory Coast": {
    immigration: "https://www.snedai.ci/",
    visa: "https://www.diplomatie.gouv.ci/",
    housing: "https://www.jumia-house.ci/",
    banking: "https://www.bceao.int/",
    employment: "https://www.emploi.gouv.ci/",
    safety: "https://www.police.gouv.ci/"
  },
  
  "Mauritius": {
    immigration: "https://passport.govmu.org/",
    visa: "https://passport.govmu.org/",
    housing: "https://www.lexpressproperty.com/",
    banking: "https://www.bom.mu/",
    employment: "https://labour.govmu.org/",
    safety: "https://police.govmu.org/"
  },
  
  "Namibia": {
    immigration: "https://mha.gov.na/",
    visa: "https://mha.gov.na/",
    housing: "https://www.myproperty.com.na/",
    banking: "https://www.bon.com.na/",
    employment: "https://mol.gov.na/",
    safety: "https://www.nampol.gov.na/"
  },

  // =========================================================================
  // PHASE 6.3: EUROPE (9 additional countries) - Total: 44
  // =========================================================================
  
  "Belarus": {
    immigration: "https://gpk.gov.by/",
    visa: "https://mfa.gov.by/en/visa/",
    housing: "https://realt.by/",
    banking: "https://www.nbrb.by/",
    employment: "https://www.mintrud.gov.by/",
    safety: "https://mvd.gov.by/"
  },
  
  "Ukraine": {
    immigration: "https://dpsu.gov.ua/",
    visa: "https://mfa.gov.ua/en/consular-affairs/entry-and-stay-foreigners-ukraine",
    housing: "https://dom.ria.com/",
    banking: "https://bank.gov.ua/",
    employment: "https://www.dcz.gov.ua/",
    safety: "https://www.npu.gov.ua/"
  },
  
  "Moldova": {
    immigration: "https://bma.gov.md/",
    visa: "https://www.mfa.gov.md/en/content/visa-information",
    housing: "https://www.999.md/",
    banking: "https://www.bnm.md/",
    employment: "https://www.anofm.md/",
    safety: "https://politia.md/"
  },
  
  "Georgia": {
    immigration: "https://migration.gov.ge/",
    visa: "https://www.geoconsul.gov.ge/",
    housing: "https://www.myhome.ge/",
    banking: "https://nbg.gov.ge/",
    employment: "https://worknet.gov.ge/",
    safety: "https://police.ge/"
  },
  
  "Armenia": {
    immigration: "https://www.police.am/en/passport-visa-department",
    visa: "https://www.mfa.am/en/visa/",
    housing: "https://www.list.am/",
    banking: "https://www.cba.am/",
    employment: "https://employment.am/",
    safety: "https://www.police.am/"
  },
  
  "Azerbaijan": {
    immigration: "https://migration.gov.az/",
    visa: "https://evisa.gov.az/",
    housing: "https://bina.az/",
    banking: "https://www.cbar.az/",
    employment: "https://www.e-gov.az/en/services/by-category/133",
    safety: "https://mia.gov.az/"
  },
  
  "Bosnia and Herzegovina": {
    immigration: "https://sps.gov.ba/",
    visa: "https://www.mvp.gov.ba/konzularne_informacije/vize/default.aspx",
    housing: "https://www.olx.ba/",
    banking: "https://www.cbbh.ba/",
    employment: "https://www.arz.gov.ba/",
    safety: "https://www.fup.gov.ba/"
  },
  
  "Kosovo": {
    immigration: "https://mpb.rks-gov.net/",
    visa: "https://www.mfa-ks.net/",
    housing: "https://www.merrjep.com/",
    banking: "https://bqk-kos.org/",
    employment: "https://aprk.rks-gov.net/",
    safety: "https://www.kosovopolice.com/"
  },
  
  "Vatican City": {
    immigration: "https://www.vaticanstate.va/",
    safety: "https://www.vaticanstate.va/"
  },

  // =========================================================================
  // PHASE 6.3: ASIA (15 additional countries) - Total: 27
  // =========================================================================
  
  "Lebanon": {
    immigration: "https://www.general-security.gov.lb/",
    visa: "https://www.general-security.gov.lb/en/posts/31",
    housing: "https://www.olx.com.lb/",
    banking: "https://www.bdl.gov.lb/",
    employment: "https://www.labor.gov.lb/",
    safety: "https://www.isf.gov.lb/"
  },
  
  "Iraq": {
    immigration: "https://www.mofa.gov.iq/",
    visa: "https://visa.mofa.gov.iq/",
    housing: "https://www.opensooq.com/iq",
    banking: "https://cbi.iq/",
    employment: "https://www.molsa.gov.iq/",
    safety: "https://moi.gov.iq/"
  },
  
  "Iran": {
    immigration: "https://mfa.gov.ir/",
    visa: "https://e_visa.mfa.ir/en/",
    housing: "https://www.divar.ir/",
    banking: "https://www.cbi.ir/",
    employment: "https://www.mcls.gov.ir/",
    safety: "https://www.police.ir/"
  },
  
  "Syria": {
    immigration: "https://www.mofa.gov.sy/",
    visa: "https://www.mofa.gov.sy/",
    banking: "https://www.cb.gov.sy/",
    safety: "https://www.moi.gov.sy/"
  },
  
  "Yemen": {
    immigration: "https://www.mofa-ye.org/",
    visa: "https://www.mofa-ye.org/",
    banking: "https://www.centralbank.gov.ye/",
    safety: "https://www.moi-ye.org/"
  },
  
  "Afghanistan": {
    immigration: "https://www.mofa.gov.af/",
    visa: "https://evisa.mofa.gov.af/",
    banking: "https://dab.gov.af/",
    safety: "https://moi.gov.af/"
  },
  
  "Turkmenistan": {
    immigration: "https://migration.gov.tm/",
    visa: "https://www.mfa.gov.tm/",
    banking: "https://cbt.gov.tm/",
    employment: "https://www.mlsp.gov.tm/",
    safety: "https://www.mfa.gov.tm/"
  },
  
  "Uzbekistan": {
    immigration: "https://www.mfa.uz/",
    visa: "https://e-visa.gov.uz/",
    housing: "https://www.olx.uz/",
    banking: "https://cbu.uz/",
    employment: "https://ish.mehnat.uz/",
    safety: "https://www.iiv.uz/"
  },
  
  "Tajikistan": {
    immigration: "https://www.mfa.tj/",
    visa: "https://www.evisa.tj/",
    housing: "https://tj.lalafo.tj/",
    banking: "https://nbt.tj/",
    employment: "https://www.mehnat.tj/",
    safety: "https://www.vkd.tj/"
  },
  
  "Kyrgyzstan": {
    immigration: "https://www.mfa.gov.kg/",
    visa: "https://evisa.e-gov.kg/",
    housing: "https://www.house.kg/",
    banking: "https://www.nbkr.kg/",
    employment: "https://mlsp.gov.kg/",
    safety: "https://mvd.gov.kg/"
  },
  
  "Mongolia": {
    immigration: "https://immigration.gov.mn/",
    visa: "https://evisa.mn/",
    housing: "https://www.unegui.mn/",
    banking: "https://www.mongolbank.mn/",
    employment: "https://www.mlsp.gov.mn/",
    safety: "https://police.gov.mn/"
  },
  
  "Brunei": {
    immigration: "https://www.immigration.gov.bn/",
    visa: "https://www.immigration.gov.bn/en/visa",
    housing: "https://www.bruneida.com/",
    banking: "https://www.bdcb.gov.bn/",
    employment: "https://www.jpm.gov.bn/",
    safety: "https://www.police.gov.bn/"
  },
  
  "Laos": {
    immigration: "https://immigration.gov.la/",
    visa: "https://laoevisa.gov.la/",
    housing: "https://laos.lalafo.com/",
    banking: "https://www.bol.gov.la/",
    employment: "https://www.molsw.gov.la/",
    safety: "https://www.mps.gov.la/"
  },
  
  "Timor-Leste": {
    immigration: "https://migracao.gov.tl/",
    visa: "https://www.timorleste.tl/",
    banking: "https://www.bancocentral.tl/",
    employment: "https://www.sejd.gov.tl/",
    safety: "https://www.pntl.gov.tl/"
  },
  
  "Maldives": {
    immigration: "https://immigration.gov.mv/",
    visa: "https://www.immigration.gov.mv/",
    housing: "https://www.maldives.com/",
    banking: "https://www.mma.gov.mv/",
    employment: "https://www.employment.gov.mv/",
    safety: "https://www.police.gov.mv/"
  },

  // =========================================================================
  // PHASE 6.3: AMERICAS (10 additional countries) - Total: 30
  // =========================================================================
  
  "Cuba": {
    immigration: "https://www.minrex.gob.cu/",
    visa: "https://www.minrex.gob.cu/es/servicios-consulares",
    banking: "https://www.bc.gob.cu/",
    employment: "https://www.mtss.gob.cu/",
    safety: "https://www.minint.gob.cu/"
  },
  
  "Haiti": {
    immigration: "https://www.mae.gouv.ht/",
    visa: "https://www.mae.gouv.ht/",
    banking: "https://www.brh.ht/",
    employment: "https://www.mast.gouv.ht/",
    safety: "https://www.pnh.ht/"
  },
  
  "Trinidad and Tobago": {
    immigration: "https://www.immigration.gov.tt/",
    visa: "https://www.ttconnect.gov.tt/gortt/portal/ttconnect/",
    housing: "https://www.trinidadexpress.com/classifieds/",
    banking: "https://www.central-bank.org.tt/",
    employment: "https://www.labour.gov.tt/",
    safety: "https://www.ttps.gov.tt/"
  },
  
  "Bahamas": {
    immigration: "https://www.immigration.gov.bs/",
    visa: "https://www.bahamas.gov.bs/wps/portal/public/gov/government/services/",
    housing: "https://www.coldwellbankerbahamas.com/",
    banking: "https://www.centralbankbahamas.com/",
    employment: "https://www.bahamas.gov.bs/",
    safety: "https://www.royalbahamaspolice.org/"
  },
  
  "Barbados": {
    immigration: "https://www.immigration.gov.bb/",
    visa: "https://www.foreign.gov.bb/",
    housing: "https://www.terracaribbeanrealty.com/",
    banking: "https://www.centralbank.org.bb/",
    employment: "https://labour.gov.bb/",
    safety: "https://www.barbadospolice.gov.bb/"
  },
  
  "Belize": {
    immigration: "https://www.ins.gov.bz/",
    visa: "https://www.mfa.gov.bz/",
    housing: "https://www.belizerealestate.com/",
    banking: "https://www.centralbank.org.bz/",
    employment: "https://www.labour.gov.bz/",
    safety: "https://www.police.gov.bz/"
  },
  
  "Guyana": {
    immigration: "https://www.moha.gov.gy/",
    visa: "https://www.minfor.gov.gy/",
    housing: "https://www.guyanaproperties.com/",
    banking: "https://www.bankofguyana.org.gy/",
    employment: "https://www.mlhsss.gov.gy/",
    safety: "https://www.guyanapoliceforce.gy/"
  },
  
  "Suriname": {
    immigration: "https://www.suriname.nu/",
    visa: "https://www.gov.sr/",
    housing: "https://www.suriname.nu/",
    banking: "https://www.cbvs.sr/",
    employment: "https://www.gov.sr/",
    safety: "https://www.politie.sr/"
  },
  
  "Grenada": {
    immigration: "https://www.gov.gd/",
    visa: "https://www.gov.gd/immigration",
    housing: "https://www.century21grenada.com/",
    banking: "https://www.eccb-centralbank.org/",
    employment: "https://www.gov.gd/",
    safety: "https://www.rgpf.gd/"
  },
  
  "Saint Lucia": {
    immigration: "https://www.govt.lc/ministries/home-affairs-justice-and-national-security",
    visa: "https://www.stlucia.gov.lc/",
    housing: "https://www.coldwellbankersaintlucia.com/",
    banking: "https://www.eccb-centralbank.org/",
    employment: "https://www.govt.lc/",
    safety: "https://www.rslpf.com/"
  },

  // =========================================================================
  // PHASE 6.3: AFRICA (16 additional countries) - Total: 31
  // =========================================================================
  
  "Algeria": {
    immigration: "https://www.interieur.gov.dz/",
    visa: "https://www.consulat-algerie.com/",
    housing: "https://www.ouedkniss.com/",
    banking: "https://www.bank-of-algeria.dz/",
    employment: "https://www.anem.dz/",
    safety: "https://www.dgsn.dz/"
  },
  
  "Libya": {
    immigration: "https://www.mofa.gov.ly/",
    visa: "https://www.mofa.gov.ly/",
    banking: "https://cbl.gov.ly/",
    safety: "https://www.interior.gov.ly/"
  },
  
  "Angola": {
    immigration: "https://www.sme.ao/",
    visa: "https://www.mirex.gov.ao/",
    housing: "https://www.meucanto.ao/",
    banking: "https://www.bna.ao/",
    employment: "https://www.maptss.gov.ao/",
    safety: "https://www.minint.gov.ao/"
  },
  
  "Mozambique": {
    immigration: "https://www.mint.gov.mz/",
    visa: "https://www.evisa.gov.mz/",
    housing: "https://www.olx.co.mz/",
    banking: "https://www.bancomoc.mz/",
    employment: "https://www.mitrab.gov.mz/",
    safety: "https://www.mint.gov.mz/"
  },
  
  "Zimbabwe": {
    immigration: "https://www.zimimmigration.gov.zw/",
    visa: "https://www.evisa.gov.zw/",
    housing: "https://www.classifieds.co.zw/",
    banking: "https://www.rbz.co.zw/",
    employment: "https://www.labour.gov.zw/",
    safety: "https://www.zrp.gov.zw/"
  },
  
  "Zambia": {
    immigration: "https://www.zambiaimmigration.gov.zm/",
    visa: "https://www.evisa.gov.zm/",
    housing: "https://www.property24.co.zm/",
    banking: "https://www.boz.zm/",
    employment: "https://www.mlss.gov.zm/",
    safety: "https://www.zambiapolice.gov.zm/"
  },
  
  "Botswana": {
    immigration: "https://www.gov.bw/immigration-citizenship",
    visa: "https://www.gov.bw/travel-and-tourism",
    housing: "https://www.property24.co.bw/",
    banking: "https://www.bankofbotswana.bw/",
    employment: "https://www.gov.bw/employment-and-labour",
    safety: "https://www.gov.bw/botswana-police-service"
  },
  
  "Malawi": {
    immigration: "https://www.immigration.gov.mw/",
    visa: "https://www.evisa.gov.mw/",
    housing: "https://www.property.mw/",
    banking: "https://www.rbm.mw/",
    employment: "https://www.labour.gov.mw/",
    safety: "https://www.police.gov.mw/"
  },
  
  "Madagascar": {
    immigration: "https://www.immigration.gov.mg/",
    visa: "https://evisamada.gov.mg/",
    housing: "https://www.jumia-house.mg/",
    banking: "https://www.banky-foiben-madagasikara.mg/",
    employment: "https://www.emploi.gov.mg/",
    safety: "https://www.police.gov.mg/"
  },
  
  "Cameroon": {
    immigration: "https://www.dgsn.cm/",
    visa: "https://www.diplocam.cm/",
    housing: "https://www.jumia.cm/",
    banking: "https://www.beac.int/",
    employment: "https://www.minefop.gov.cm/",
    safety: "https://www.dgsn.cm/"
  },
  
  "Democratic Republic of the Congo": {
    immigration: "https://www.dgm.cd/",
    visa: "https://www.dgm.cd/",
    housing: "https://www.jumia.cd/",
    banking: "https://www.bcc.cd/",
    employment: "https://www.travail.gouv.cd/",
    safety: "https://www.police.gouv.cd/"
  },
  
  "Sudan": {
    immigration: "https://moi.gov.sd/",
    visa: "https://www.mofa.gov.sd/",
    banking: "https://cbos.gov.sd/",
    employment: "https://www.mol.gov.sd/",
    safety: "https://moi.gov.sd/"
  },
  
  "South Sudan": {
    immigration: "https://www.mofa.gov.ss/",
    visa: "https://www.mofa.gov.ss/",
    banking: "https://www.bankofss.org/",
    safety: "https://www.interior.gov.ss/"
  },
  
  "Somalia": {
    immigration: "https://www.mfa.gov.so/",
    visa: "https://www.mfa.gov.so/",
    banking: "https://centralbank.gov.so/",
    safety: "https://www.interior.gov.so/"
  },
  
  "Mali": {
    immigration: "https://www.dgpn.ml/",
    visa: "https://www.diplomatie.gouv.ml/",
    housing: "https://www.malipages.com/",
    banking: "https://www.bceao.int/",
    employment: "https://www.anpe-mali.org/",
    safety: "https://www.dgpn.ml/"
  },
  
  "Niger": {
    immigration: "https://www.dgpn.ne/",
    visa: "https://www.mae.ne/",
    banking: "https://www.bceao.int/",
    employment: "https://www.anpe.ne/",
    safety: "https://www.dgpn.ne/"
  },

  // =========================================================================
  // PHASE 6.4: EUROPE (5 additional countries) - Total: 49
  // =========================================================================
  
  "Monaco": {
    immigration: "https://service-public-particuliers.gouv.mc/",
    visa: "https://en.gouv.mc/Government-Institutions/The-Government/Ministry-of-State",
    housing: "https://www.montecarlorealestate.com/",
    banking: "https://www.gouv.mc/Government-Institutions/Directorate-of-Budget-and-Treasury",
    safety: "https://www.gouv.mc/Government-Institutions/The-Government/Department-of-the-Interior/Public-Security-Department"
  },
  
  "Andorra": {
    immigration: "https://www.immigracio.ad/",
    visa: "https://www.exteriors.ad/",
    housing: "https://www.habitaclia.ad/",
    banking: "https://www.inaf.ad/",
    employment: "https://www.treball.ad/",
    safety: "https://www.policia.ad/"
  },
  
  "Liechtenstein": {
    immigration: "https://www.llv.li/de/landesverwaltung/amt-fuer-justiz/auslaenderrechtliche-bewilligungen",
    visa: "https://www.llv.li/",
    housing: "https://www.immoscout24.li/",
    banking: "https://www.fma-li.li/",
    employment: "https://www.ams.li/",
    safety: "https://www.landespolizei.li/"
  },
  
  "San Marino": {
    immigration: "https://www.esteri.sm/",
    visa: "https://www.esteri.sm/",
    banking: "https://www.bcsm.sm/",
    safety: "https://www.gendarmeriarepubblicasanmarino.sm/"
  },
  
  "Russia": {
    immigration: "https://www.mvd.ru/",
    visa: "https://electronic-visa.kdmid.ru/",
    housing: "https://www.cian.ru/",
    banking: "https://www.cbr.ru/",
    employment: "https://www.rostrud.gov.ru/",
    safety: "https://www.mvd.ru/"
  },

  // =========================================================================
  // PHASE 6.4: ASIA (3 additional countries) - Total: 30
  // =========================================================================
  
  "North Korea": {
    immigration: "https://www.mfa.gov.kp/",
    visa: "https://www.mfa.gov.kp/",
    safety: "https://www.mps.gov.kp/"
  },
  
  "Bhutan": {
    immigration: "https://www.mfa.gov.bt/",
    visa: "https://www.tourism.gov.bt/",
    housing: "https://www.bhutanjobs.bt/",
    banking: "https://www.rma.org.bt/",
    employment: "https://www.molhr.gov.bt/",
    safety: "https://www.rbp.gov.bt/"
  },

  // =========================================================================
  // PHASE 6.4: AMERICAS (5 additional countries) - Total: 35
  // =========================================================================
  
  "Antigua and Barbuda": {
    immigration: "https://immigration.gov.ag/",
    visa: "https://www.foreignaffairs.gov.ag/",
    housing: "https://www.antiguarealestate.com/",
    banking: "https://www.eccb-centralbank.org/",
    safety: "https://www.antiguapolice.com/"
  },
  
  "Saint Kitts and Nevis": {
    immigration: "https://www.nia.gov.kn/",
    visa: "https://www.foreign.gov.kn/",
    housing: "https://www.stkittsrealestate.com/",
    banking: "https://www.eccb-centralbank.org/",
    safety: "https://www.rskpf.com/"
  },
  
  "Saint Vincent and the Grenadines": {
    immigration: "https://www.gov.vc/gov/index.php/immigration",
    visa: "https://www.foreign.gov.vc/",
    housing: "https://www.svgrealestate.com/",
    banking: "https://www.eccb-centralbank.org/",
    safety: "https://www.rsvgpf.org/"
  },
  
  "Dominica": {
    immigration: "https://www.dominica.gov.dm/",
    visa: "https://www.dominica.gov.dm/services/visa-and-immigration",
    housing: "https://www.dominicarealestate.dm/",
    banking: "https://www.eccb-centralbank.org/",
    safety: "https://www.dominicapolice.dm/"
  },
  
  "Venezuela": {
    immigration: "https://www.saime.gob.ve/",
    visa: "https://www.mppre.gob.ve/",
    housing: "https://www.tucasa.com.ve/",
    banking: "https://www.bcv.org.ve/",
    employment: "https://www.mpppst.gob.ve/",
    safety: "https://www.mpprij.gob.ve/"
  },

  // =========================================================================
  // PHASE 6.4: AFRICA (18 additional countries) - Total: 49
  // =========================================================================
  
  "Burkina Faso": {
    immigration: "https://www.police.gov.bf/",
    visa: "https://www.mae.gov.bf/",
    banking: "https://www.bceao.int/",
    employment: "https://www.anpe.bf/",
    safety: "https://www.police.gov.bf/"
  },
  
  "Benin": {
    immigration: "https://www.migration.gouv.bj/",
    visa: "https://www.gouv.bj/evisa/",
    housing: "https://www.expat.com/en/housing/africa/benin/",
    banking: "https://www.bceao.int/",
    employment: "https://www.anpe.bj/",
    safety: "https://www.police.gouv.bj/"
  },
  
  "Togo": {
    immigration: "https://www.migration.gouv.tg/",
    visa: "https://www.mae.gouv.tg/",
    banking: "https://www.bceao.int/",
    employment: "https://www.anpe.tg/",
    safety: "https://www.securite.gouv.tg/"
  },
  
  "Chad": {
    immigration: "https://www.securite-publique.gouv.td/",
    visa: "https://www.diplomatie.gouv.td/",
    banking: "https://www.beac.int/",
    safety: "https://www.securite-publique.gouv.td/"
  },
  
  "Central African Republic": {
    immigration: "https://www.mae.gouv.cf/",
    visa: "https://www.mae.gouv.cf/",
    banking: "https://www.beac.int/",
    safety: "https://www.minint.gouv.cf/"
  },
  
  "Equatorial Guinea": {
    immigration: "https://www.guineaecuatorialpress.com/",
    visa: "https://www.mae.gob.gq/",
    banking: "https://www.beac.int/",
    safety: "https://www.guineaecuatorialpress.com/"
  },
  
  "Gabon": {
    immigration: "https://www.dgdi.ga/",
    visa: "https://evisa.dgdi.ga/",
    housing: "https://www.gabonreview.com/",
    banking: "https://www.beac.int/",
    employment: "https://www.anpe.ga/",
    safety: "https://www.securite.gouv.ga/"
  },
  
  "Republic of the Congo": {
    immigration: "https://www.mae.gouv.cg/",
    visa: "https://www.mae.gouv.cg/",
    housing: "https://www.expat.com/en/housing/africa/congo/",
    banking: "https://www.beac.int/",
    safety: "https://www.interieur.gouv.cg/"
  },
  
  "Burundi": {
    immigration: "https://www.migration.gov.bi/",
    visa: "https://www.mae.gov.bi/",
    banking: "https://www.brb.bi/",
    safety: "https://www.police.gov.bi/"
  },
  
  "Eritrea": {
    immigration: "https://www.shabait.com/",
    visa: "https://www.shabait.com/",
    banking: "https://www.boe.gov.er/",
    safety: "https://www.shabait.com/"
  },
  
  "Djibouti": {
    immigration: "https://www.presidence.dj/",
    visa: "https://www.diplomatie.gouv.dj/",
    banking: "https://www.banque-centrale.dj/",
    safety: "https://www.police.gouv.dj/"
  },
  
  "Comoros": {
    immigration: "https://www.diplomatie.gouv.km/",
    visa: "https://www.diplomatie.gouv.km/",
    banking: "https://www.banque-comores.km/",
    safety: "https://www.gendarmerie.km/"
  },
  
  "Seychelles": {
    immigration: "https://www.ics.gov.sc/",
    visa: "https://www.ics.gov.sc/",
    housing: "https://www.seychellespropertyonline.com/",
    banking: "https://www.cbs.sc/",
    employment: "https://www.employment.gov.sc/",
    safety: "https://www.sps.gov.sc/"
  },
  
  "Cape Verde": {
    immigration: "https://www.pfrsmac.cv/",
    visa: "https://www.ease.gov.cv/",
    housing: "https://www.imobiliaria.cv/",
    banking: "https://www.bcv.cv/",
    employment: "https://www.emprego.cv/",
    safety: "https://www.pn.cv/"
  },
  
  "Guinea": {
    immigration: "https://www.mae.gov.gn/",
    visa: "https://www.mae.gov.gn/",
    banking: "https://www.bcrg-guinee.org/",
    safety: "https://www.securite.gov.gn/"
  },
  
  "Guinea-Bissau": {
    immigration: "https://www.mirex.gov.gw/",
    visa: "https://www.mirex.gov.gw/",
    banking: "https://www.bceao.int/",
    safety: "https://www.mai.gov.gw/"
  },
  
  "Sierra Leone": {
    immigration: "https://www.immigration.gov.sl/",
    visa: "https://www.foreign.gov.sl/",
    banking: "https://www.bsl.gov.sl/",
    employment: "https://www.labour.gov.sl/",
    safety: "https://www.police.gov.sl/"
  },
  
  "Liberia": {
    immigration: "https://www.lis.gov.lr/",
    visa: "https://www.mofa.gov.lr/",
    banking: "https://www.cbl.org.lr/",
    employment: "https://www.mol.gov.lr/",
    safety: "https://www.lnp.gov.lr/"
  },

  // =========================================================================
  // PHASE 6.4: AFRICA CONTINUED (6 more countries)
  // =========================================================================
  
  "Gambia": {
    immigration: "https://www.gid.gm/",
    visa: "https://www.mofa.gm/",
    housing: "https://www.gambiapropertylink.com/",
    banking: "https://www.cbg.gm/",
    employment: "https://www.mol.gm/",
    safety: "https://www.gpf.gm/"
  },
  
  "Mauritania": {
    immigration: "https://www.mae.gov.mr/",
    visa: "https://www.mae.gov.mr/",
    banking: "https://www.bcm.mr/",
    safety: "https://www.interieur.gov.mr/"
  },
  
  "Lesotho": {
    immigration: "https://www.homeaffairs.gov.ls/",
    visa: "https://www.gov.ls/",
    banking: "https://www.centralbank.org.ls/",
    employment: "https://www.labour.gov.ls/",
    safety: "https://www.lmps.org.ls/"
  },
  
  "Eswatini": {
    immigration: "https://www.gov.sz/",
    visa: "https://www.gov.sz/index.php/ministries-departments/immigration",
    banking: "https://www.centralbank.org.sz/",
    employment: "https://www.gov.sz/",
    safety: "https://www.royalswazilandpolice.org.sz/"
  },
  
  "Sao Tome and Principe": {
    immigration: "https://www.mirex.gov.st/",
    visa: "https://www.mirex.gov.st/",
    banking: "https://www.bcstp.st/",
    safety: "https://www.pn.gov.st/"
  },

  // =========================================================================
  // PHASE 6.4: OCEANIA (14 additional countries) - Total: 17
  // =========================================================================
  
  "Papua New Guinea": {
    immigration: "https://www.immigration.gov.pg/",
    visa: "https://evisa.ica.gov.pg/",
    housing: "https://www.hausples.com.pg/",
    banking: "https://www.bankpng.gov.pg/",
    employment: "https://www.labour.gov.pg/",
    safety: "https://www.police.gov.pg/"
  },
  
  "Samoa": {
    immigration: "https://www.samoaimmigration.gov.ws/",
    visa: "https://www.mfat.gov.ws/",
    banking: "https://www.cbs.gov.ws/",
    employment: "https://www.mcil.gov.ws/",
    safety: "https://www.police.gov.ws/"
  },
  
  "Tonga": {
    immigration: "https://www.immigration.gov.to/",
    visa: "https://www.gov.to/",
    banking: "https://www.reservebank.to/",
    safety: "https://www.police.gov.to/"
  },
  
  "Vanuatu": {
    immigration: "https://www.immigration.gov.vu/",
    visa: "https://www.immigration.gov.vu/",
    housing: "https://www.vanuatuproperty.com/",
    banking: "https://www.rbv.gov.vu/",
    employment: "https://www.dol.gov.vu/",
    safety: "https://www.police.gov.vu/"
  },
  
  "Solomon Islands": {
    immigration: "https://www.commerce.gov.sb/",
    visa: "https://evisa.gov.sb/",
    banking: "https://www.cbsi.com.sb/",
    safety: "https://www.rsipf.gov.sb/"
  },
  
  "Kiribati": {
    immigration: "https://www.mfed.gov.ki/",
    visa: "https://www.mfa.gov.ki/",
    banking: "https://www.mfed.gov.ki/",
    safety: "https://www.police.gov.ki/"
  },
  
  "Micronesia": {
    immigration: "https://www.fsmgov.org/",
    visa: "https://www.fsmgov.org/",
    banking: "https://www.fsmgov.org/",
    safety: "https://www.dps.fm/"
  },
  
  "Marshall Islands": {
    immigration: "https://www.rmigovernment.org/",
    visa: "https://www.rmiembassyus.org/",
    banking: "https://www.rmibmia.com/",
    safety: "https://www.rmigovernment.org/"
  },
  
  "Palau": {
    immigration: "https://www.palaugov.pw/",
    visa: "https://www.palauimmigration.pw/",
    banking: "https://www.palaugov.pw/",
    safety: "https://www.palaupolice.pw/"
  },
  
  "Nauru": {
    immigration: "https://www.naurugov.nr/",
    visa: "https://www.naurugov.nr/",
    banking: "https://www.naurugov.nr/",
    safety: "https://www.naurupolice.gov.nr/"
  },
  
  "Tuvalu": {
    immigration: "https://www.tuvalugov.tv/",
    visa: "https://www.tuvalugov.tv/",
    banking: "https://www.tuvalugov.tv/",
    safety: "https://www.police.gov.tv/"
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize country name for lookup (case-insensitive, handles common variations)
 */
function normalizeCountryName(country: string): string {
  const normalized = country.trim();
  const asciiNormalized = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  
  // Common variations mapping
  const variations: Record<string, string> = {
    "usa": "United States",
    "us": "United States",
    "america": "United States",
    "uk": "United Kingdom",
    "britain": "United Kingdom",
    "england": "United Kingdom",
    "korea": "South Korea",
    "republic of korea": "South Korea",
    "uae": "UAE",
    "united arab emirates": "UAE",
    "emirates": "UAE",
    "dubai": "UAE",
    "holland": "Netherlands",
    "czech": "Czech Republic",
    "czechia": "Czech Republic",
    "japao": "Japan",
    "nippon": "Japan",
    "deutschland": "Germany",
    "espana": "Spain",
    "italia": "Italy",
    "brasil": "Brazil",
    "mexico": "Mexico",
  };
  
  const lowerNormalized = asciiNormalized.toLowerCase();
  if (variations[lowerNormalized]) {
    return variations[lowerNormalized];
  }
  
  // Try to find exact match (case-insensitive)
  for (const key of Object.keys(OFFICIAL_SOURCES)) {
    const lowerKey = key
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (lowerKey === lowerNormalized) {
      return key;
    }
  }
  
  return normalized;
}

/**
 * Get URL for a specific category in a country
 */
export function getSourceUrl(country: string, category: keyof CountrySources): string | null {
  const normalized = normalizeCountryName(country);
  const sources = OFFICIAL_SOURCES[normalized];
  return sources?.[category] || null;
}

/**
 * Get all available sources for a country
 */
export function getAllSources(country: string): CountrySources | null {
  const normalized = normalizeCountryName(country);
  return OFFICIAL_SOURCES[normalized] || null;
}

/**
 * Check if a country has a specific category
 */
export function hasCategory(country: string, category: keyof CountrySources): boolean {
  const url = getSourceUrl(country, category);
  return url !== null;
}

/**
 * Get list of all supported countries
 */
export function getSupportedCountries(): string[] {
  return Object.keys(OFFICIAL_SOURCES).sort();
}

/**
 * Check if a country is in the registry
 */
export function hasOfficialSource(country: string): boolean {
  const normalized = normalizeCountryName(country);
  return normalized in OFFICIAL_SOURCES;
}

/**
 * Get embassy finder URL for a country
 */
export function getEmbassyFinderUrl(country: string): string | null {
  const normalized = normalizeCountryName(country);
  return EMBASSY_PATTERNS[normalized]?.finder || null;
}

/**
 * Get embassy info for a destination country
 */
export function getEmbassyInfo(destinationCountry: string): EmbassyPattern | null {
  const normalized = normalizeCountryName(destinationCountry);
  return EMBASSY_PATTERNS[normalized] || null;
}

/**
 * Detect which categories to scrape based on user message
 */
export function detectCategoriesToScrape(message: string): (keyof CountrySources)[] {
  const lowerMessage = message.toLowerCase();
  const categories: (keyof CountrySources)[] = [];
  
  // Visa/Immigration related
  if (/\b(visa|permit|immigration|migrate|residency|passport|entry|stay)\b/i.test(lowerMessage)) {
    categories.push('immigration');
    categories.push('visa');
  }
  
  // Housing related
  if (/\b(housing|apartment|rent|flat|accommodation|live|living|home|house)\b/i.test(lowerMessage)) {
    categories.push('housing');
  }
  
  // Banking related
  if (/\b(bank|banking|account|money|finance|currency|transfer|payment)\b/i.test(lowerMessage)) {
    categories.push('banking');
  }
  
  // Employment related
  if (/\b(job|work|employ|career|salary|wage|hire|profession|occupation)\b/i.test(lowerMessage)) {
    categories.push('employment');
  }
  
  // Safety related
  if (/\b(safe|safety|crime|police|emergency|security|danger)\b/i.test(lowerMessage)) {
    categories.push('safety');
  }
  
  // Default to immigration if no specific topic detected
  if (categories.length === 0) {
    categories.push('immigration');
  }
  
  return [...new Set(categories)]; // Remove duplicates
}

/**
 * Format sources for display (simplified)
 */
export function formatSourcesForDisplay(country: string): string {
  const sources = getAllSources(country);
  if (!sources) return '';
  
  const lines: string[] = [];
  
  if (sources.immigration) lines.push(`🛂 Immigration: ${sources.immigration}`);
  if (sources.visa) lines.push(`📋 Visa Portal: ${sources.visa}`);
  if (sources.housing) lines.push(`🏠 Housing: ${sources.housing}`);
  if (sources.banking) lines.push(`🏦 Banking: ${sources.banking}`);
  if (sources.employment) lines.push(`💼 Employment: ${sources.employment}`);
  if (sources.safety) lines.push(`🚔 Safety: ${sources.safety}`);
  
  return lines.join('\n');
}

// ============================================================================
// REGISTRY STATISTICS
// ============================================================================

/**
 * Get registry statistics for monitoring
 */
export function getRegistryStats(): { 
  totalCountries: number; 
  categoryCoverage: Record<keyof CountrySources, number>;
} {
  const countries = Object.keys(OFFICIAL_SOURCES);
  const coverage: Record<keyof CountrySources, number> = {
    immigration: 0,
    visa: 0,
    housing: 0,
    banking: 0,
    employment: 0,
    safety: 0
  };
  
  for (const sources of Object.values(OFFICIAL_SOURCES)) {
    if (sources.immigration) coverage.immigration++;
    if (sources.visa) coverage.visa++;
    if (sources.housing) coverage.housing++;
    if (sources.banking) coverage.banking++;
    if (sources.employment) coverage.employment++;
    if (sources.safety) coverage.safety++;
  }
  
  return {
    totalCountries: countries.length,
    categoryCoverage: coverage
  };
}

// ============================================================================
// COMPATIBILITY EXPORTS (for existing codebase)
// ============================================================================

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

/**
 * Get sources for a country (compatibility wrapper)
 */
export function getOfficialSources(country: string): CountryOfficialSources | null {
  const sources = getAllSources(country);
  if (!sources) return null;
  
  return {
    immigration: sources.immigration,
    visaPortal: sources.visa,
    housing: sources.housing,
    banking: sources.banking,
    employment: sources.employment,
    safety: sources.safety,
  };
}

/**
 * Get all sources as an array for display (compatibility wrapper)
 */
export function getOfficialSourcesArray(country: string): OfficialSource[] {
  const sources = getAllSources(country);
  if (!sources) return [];
  
  const categoryMap: Record<keyof CountrySources, OfficialSource["category"]> = {
    immigration: "immigration",
    visa: "visa",
    housing: "housing",
    banking: "banking",
    employment: "employment",
    safety: "safety",
  };
  
  const nameMap: Record<keyof CountrySources, string> = {
    immigration: "Immigration Authority",
    visa: "Visa Portal",
    housing: "Housing Portal",
    banking: "Banking Authority",
    employment: "Employment Services",
    safety: "Safety Information",
  };
  
  return (Object.entries(sources) as [keyof CountrySources, string | undefined][])
    .filter(([, url]) => url)
    .map(([key, url]) => ({
      name: nameMap[key] || key,
      url: url as string,
      category: categoryMap[key] || "general",
    }));
}
