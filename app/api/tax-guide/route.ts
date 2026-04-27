import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"
import { getAllSources } from "@/lib/gomate/official-sources"

interface TaxRegistrationFallback {
  idName: string
  officeName: string
  steps: string[]
  documents: string[]
  estimatedTime: string
  cost: string
  tips: string[]
}

const TAX_REGISTRATION_MAP: Record<string, TaxRegistrationFallback> = {
  GERMANY: {
    idName: "Steueridentifikationsnummer (Tax ID)",
    officeName: "Finanzamt (Tax Office)",
    steps: [
      "Register your residence (Anmeldung) at your local Bürgeramt within 14 days of arriving — this is what triggers issuance of your tax ID",
      "Wait 2–6 weeks for your Steueridentifikationsnummer to arrive by post at your registered address",
      "If you don't receive it, request a copy from the Bundeszentralamt für Steuern via their online form",
      "Provide your tax ID to your employer so they can run payroll correctly",
      "Open a German bank account using your Anmeldebestätigung — many employers require a German IBAN to pay you",
    ],
    documents: ["Passport", "Anmeldebestätigung (residence registration confirmation)", "Rental agreement", "Employment contract (for payroll setup)"],
    estimatedTime: "Tax ID arrives 2–6 weeks after Anmeldung",
    cost: "Free",
    tips: [
      "The Steueridentifikationsnummer is automatic — there is no separate application form. The Anmeldung is the trigger.",
      "Self-employed and freelancers also need a Steuernummer (different number) from the Finanzamt — request via the 'Fragebogen zur steuerlichen Erfassung' form within 4 weeks of starting freelance work.",
    ],
  },
  NETHERLANDS: {
    idName: "BSN (Burgerservicenummer)",
    officeName: "Gemeente (Municipality)",
    steps: [
      "Book an appointment at the gemeente in your municipality of residence — many require this within 5 days of arrival",
      "Bring all required documents and attend the in-person appointment",
      "The gemeente will issue your BSN immediately or by post within ~1 week",
      "Provide the BSN to your employer for payroll, and to your Dutch bank for account setup",
      "Apply for the 30% ruling (if eligible as a highly-skilled migrant) within 4 months of starting work — this is a substantial tax benefit",
    ],
    documents: ["Passport", "Birth certificate (apostilled and translated)", "Rental contract / proof of address", "Employment contract", "Marriage certificate (if applicable)"],
    estimatedTime: "Same-day at appointment or up to 1 week",
    cost: "Free",
    tips: [
      "Without a BSN you cannot work, open a bank account, or register for Dutch healthcare insurance — this is the most urgent post-arrival step.",
      "If you arrive with a long-stay visa (MVV), you must register within 5 working days; tourist arrivals have up to 4 months.",
    ],
  },
  SPAIN: {
    idName: "NIE (Número de Identidad de Extranjero) and NIF",
    officeName: "Oficina de Extranjería or local police station",
    steps: [
      "Book an appointment ('cita previa') online via the sede.administracionespublicas.gob.es portal",
      "Complete form EX-15 (NIE application) in advance",
      "Pay the modelo 790 código 012 fee at a Spanish bank or online",
      "Attend the appointment with your documents — appointments fill quickly in major cities",
      "Receive your NIE certificate (often same-day, sometimes by post)",
      "Register for the empadronamiento (padrón) at your town hall — many subsequent processes require this",
    ],
    documents: ["Passport (original + copy)", "Form EX-15 completed", "Modelo 790-012 paid receipt", "Justification for needing the NIE (job offer / property purchase / study admission / visa)", "2 passport-size photos"],
    estimatedTime: "Appointment slot may take 2–6 weeks; NIE issued at appointment",
    cost: "≈ EUR 12 (modelo 790-012)",
    tips: [
      "In Madrid and Barcelona the cita previa can take 4–8 weeks to secure — book the moment you have a confirmed move date.",
      "Your NIE is permanent — you keep the same number for life even if you leave and return to Spain.",
    ],
  },
  PORTUGAL: {
    idName: "NIF (Número de Identificação Fiscal)",
    officeName: "Finanças (Tax Office)",
    steps: [
      "Visit a local Finanças office (Repartição de Finanças) — no appointment needed in most cities",
      "Bring your passport and proof of address",
      "If you are non-EU and not yet a resident, you need a fiscal representative (a Portuguese resident who acts as your tax contact); some banks and lawyers offer this for ~EUR 100/year",
      "Complete the application form on the spot — staff will help with the Portuguese fields",
      "Receive your NIF immediately, printed on a slip of paper",
      "Register for an account on the Portal das Finanças so you can manage tax filings online",
    ],
    documents: ["Passport", "Proof of address (rental contract, utility bill)", "Fiscal representative letter (if non-resident)", "EU citizens: just passport + address"],
    estimatedTime: "Same-day, typically under 1 hour at the office",
    cost: "Free for the NIF itself; fiscal representation is paid privately",
    tips: [
      "You can also obtain a NIF remotely through a Portuguese lawyer or service like Bordr / e-Residency before arriving.",
      "Without a NIF you cannot rent long-term, open a bank account, or sign a phone contract — get this on day 1 if possible.",
    ],
  },
  SWEDEN: {
    idName: "Personnummer",
    officeName: "Skatteverket (Swedish Tax Agency)",
    steps: [
      "Visit a Skatteverket service office (Servicekontor) in person — non-EU citizens must show their residence permit card",
      "Submit the SKV 7665 form (registration of move to Sweden)",
      "Bring passport, residence permit, and proof of stay ≥ 1 year",
      "Skatteverket forwards your application to Migrationsverket if needed and issues your personnummer in 4–8 weeks",
      "Once issued, register an ID-kort at Skatteverket — this is your everyday Swedish ID",
      "Use your personnummer to open a bank account, register for healthcare (Vårdguiden 1177), and any utility contract",
    ],
    documents: ["Passport", "Residence permit card or EU passport", "Employment contract or proof of intended stay > 12 months", "Marriage certificate (if applicable)", "Rental contract"],
    estimatedTime: "4–8 weeks for personnummer issuance",
    cost: "Free for the personnummer; ≈ SEK 400 for the optional ID-kort",
    tips: [
      "Without a personnummer you cannot get a real Swedish bank account or BankID — both essential for daily life. This is the single most important post-arrival step.",
      "If your stay is < 1 year, you receive a 'samordningsnummer' (coordination number) instead, which has limited functionality.",
    ],
  },
  JAPAN: {
    idName: "My Number (マイナンバー)",
    officeName: "Ward Office (区役所 / 市役所)",
    steps: [
      "Within 14 days of moving in, visit your local ward office (Kuyakusho) with your residence card (Zairyu Card) and rental contract",
      "Submit your move-in notification (Tenny? todoke / Tenshutsu todoke)",
      "Your My Number notification card is mailed to your registered address within 2–3 weeks",
      "Optionally apply for the My Number Card (plastic ID with chip) at the ward office — better for online tax filings",
      "Register for National Health Insurance (Kokumin Kenko Hoken) at the same office if you're not on employer insurance",
      "Provide your My Number to your employer and bank",
    ],
    documents: ["Residence Card (Zairyu Card)", "Passport", "Lease contract / rental agreement", "Hanko/Inkan seal (some offices accept signature instead, but a hanko is widely expected)"],
    estimatedTime: "My Number notification card arrives 2–3 weeks after move-in registration",
    cost: "Free for the notification card; ≈ JPY 1,000 for the plastic My Number Card",
    tips: [
      "Your My Number is permanent — you keep the same number for life, even after leaving and re-entering Japan.",
      "Many landlords and employers also expect a hanko (personal seal). Get one made early — custom seals take a few days.",
    ],
  },
  CANADA: {
    idName: "SIN (Social Insurance Number)",
    officeName: "Service Canada",
    steps: [
      "Apply in person at a Service Canada centre — no appointment needed in most provinces",
      "Bring your passport, work permit / study permit / PR card, and proof of address",
      "Receive your SIN immediately at the appointment, printed on a confirmation letter",
      "Provide your SIN to your employer — they cannot pay you without it",
      "Register with Canada Revenue Agency (CRA) online via My Account once you have your SIN",
      "If your SIN starts with '9', it is a temporary SIN tied to your work permit and will need renewal when your permit is renewed",
    ],
    documents: ["Passport", "Work permit / Study permit / PR card / COPR", "Proof of address (lease, utility bill)"],
    estimatedTime: "Same-day at the in-person appointment",
    cost: "Free",
    tips: [
      "In high-demand cities (Toronto, Vancouver, Montreal) the wait at Service Canada can be 1–3 hours — go early.",
      "You can apply for SIN online if you cannot visit in person — receive the SIN by mail in 4 weeks.",
    ],
  },
  AUSTRALIA: {
    idName: "TFN (Tax File Number)",
    officeName: "Australian Taxation Office (ATO)",
    steps: [
      "Apply online via the ATO website using your visa details (apply only after arriving in Australia)",
      "Provide your passport details and Australian address",
      "Receive your TFN by post at your Australian address within 28 days",
      "Provide your TFN to your employer when you start work — without it, your tax rate defaults to the highest bracket",
      "Open an Australian bank account — many offer 6 weeks of fee-free banking before you need to provide proof of address",
      "Register for myGov and link the ATO to manage your tax online",
    ],
    documents: ["Passport (with valid Australian visa)", "Australian residential address", "Australian phone number (for verification)"],
    estimatedTime: "TFN arrives by post within 28 days of online application",
    cost: "Free",
    tips: [
      "Working without a TFN means PAYG tax is withheld at 47% — apply on day 1.",
      "If you have a Working Holiday Visa, your tax rate is different — make sure your employer knows your visa subclass.",
    ],
  },
  UNITED_KINGDOM: {
    idName: "National Insurance Number (NINo)",
    officeName: "HMRC / DWP",
    steps: [
      "Apply for a NINo online via gov.uk after arriving in the UK and securing accommodation",
      "Complete the identity-verification process (uses your BRP/passport + facial recognition)",
      "If online verification fails, you may be invited to a phone or in-person interview",
      "Receive your NINo by post within 4–8 weeks of approval",
      "Register for HMRC's Personal Tax Account online to view your tax code and NI contributions",
      "Register with a GP using your address — this is separate from tax but uses similar documentation",
    ],
    documents: ["Passport / BRP (Biometric Residence Permit)", "Proof of address (tenancy agreement, council tax bill, utility bill)", "Visa documentation"],
    estimatedTime: "4–8 weeks from application to NINo letter",
    cost: "Free",
    tips: [
      "You can start working before your NINo arrives — give your employer your application reference and they will use an 'emergency tax code' until the real one is assigned.",
      "Make sure HMRC has your correct address — the NINo letter is sent by Royal Mail and is not re-sent if lost in transit.",
    ],
  },
  ITALY: {
    idName: "Codice Fiscale (Tax Code)",
    officeName: "Agenzia delle Entrate",
    steps: [
      "Apply for a Codice Fiscale at any Agenzia delle Entrate office — bring your passport and a completed AA4/8 form",
      "EU citizens can get it the same day; non-EU citizens may need to first obtain a residence permit (Permesso di soggiorno) from the Questura",
      "Receive your Codice Fiscale on a tessera sanitaria card by post within 4–8 weeks (paper certificate available immediately)",
      "Provide your Codice Fiscale to your employer for payroll (modello CU) and to your bank for any account opening",
      "Register with the Servizio Sanitario Nazionale (SSN) at your local ASL — required for all residents and tied to the Codice Fiscale",
      "File your annual tax return (modello 730 or modello Redditi) by the September deadline if you have Italian income or deductible expenses",
    ],
    documents: [
      "Passport",
      "Completed AA4/8 form (downloadable from agenziaentrate.gov.it)",
      "Visa or permesso di soggiorno (non-EU)",
      "Italian address (rental contract or hosting declaration)",
      "Birth certificate (apostilled and translated, in some cases)",
    ],
    estimatedTime: "Same-day for the paper certificate; tessera sanitaria card arrives in 4–8 weeks",
    cost: "Free for the Codice Fiscale itself; permesso di soggiorno fees vary",
    tips: [
      "Without a Codice Fiscale you can't sign a rental contract, open a bank account, or receive a salary in Italy — get this on day 1.",
      "If you qualify under the Jure Sanguinis citizenship process (Italian descent), you can apply for the Codice Fiscale at the consulate before arriving.",
    ],
  },
  FRANCE: {
    idName: "Numéro fiscal (Tax Number) and INSEE / NIR (Social Security Number)",
    officeName: "Service des Impôts des Particuliers (SIP) / CPAM",
    steps: [
      "Validate your VLS-TS visa online via the OFII portal within 3 months of arrival — this confirms your residence status",
      "Apply for a numéro fiscal at your local Service des Impôts des Particuliers (SIP) — bring passport, visa, and proof of address",
      "Apply for social security (sécurité sociale) at your local CPAM — receive a temporary attestation immediately, full carte Vitale within 3–6 months",
      "Provide your social security number to your employer for payroll deductions",
      "Register on impots.gouv.fr to file your annual tax declaration (deadline: typically May/June)",
      "Apply for the carte Vitale (health card) once your social security number is finalised",
    ],
    documents: ["Passport with valid VLS-TS visa", "OFII confirmation", "Proof of address (rental contract, EDF bill)", "Birth certificate (apostilled and translated)", "Marriage certificate (if applicable)"],
    estimatedTime: "Numéro fiscal: 4–8 weeks. Carte Vitale: 3–6 months.",
    cost: "Free",
    tips: [
      "France's tax year is the calendar year. Your first French tax declaration is due the May after your first full year of residence.",
      "Without the carte Vitale you can still see doctors, but you'll pay upfront and claim reimbursement later via the temporary attestation.",
    ],
  },
}

function lookupTaxRegistration(destination: string): TaxRegistrationFallback | null {
  const key = destination.toUpperCase().replace(/\s+/g, "_")
  return TAX_REGISTRATION_MAP[key] || null
}

function lookupTaxId(destination: string): { idName: string; officeName: string } | null {
  const fb = lookupTaxRegistration(destination)
  return fb ? { idName: fb.idName, officeName: fb.officeName } : null
}

// GET: Assemble tax registration guide data
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "post_arrival_assistant")) {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 })
  }

  const { data: plan, error } = await supabase
    .from("relocation_plans")
    .select("id, profile_data, local_requirements_research")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (error || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  const profile = plan.profile_data as { destination?: string } | null
  const destination = profile?.destination || ""

  const taxRegistrationFallback = lookupTaxRegistration(destination)
  const taxIdInfo = taxRegistrationFallback
    ? { idName: taxRegistrationFallback.idName, officeName: taxRegistrationFallback.officeName }
    : null

  // Find tax + registration categories in local_requirements_research
  const localReq = plan.local_requirements_research as {
    categories?: Array<{
      category: string
      items?: Array<{
        title: string
        steps?: string[]
        documents?: string[]
        estimatedTime?: string
        cost?: string
        officialLink?: string
        tips?: string[]
      }>
    }>
  } | null

  const matchingCategories = (localReq?.categories || []).filter(
    (c) => {
      const cat = c.category?.toLowerCase() || ""
      return cat.includes("tax") || cat.includes("registration")
    }
  )

  const registrationSteps: string[] = []
  const documentsNeeded = new Set<string>()
  const tips: string[] = []
  let estimatedTime: string | null = null
  let cost: string | null = null
  const relatedOfficialLinks: Array<{ name: string; url: string }> = []

  for (const cat of matchingCategories) {
    for (const item of cat.items || []) {
      if (item.steps) registrationSteps.push(...item.steps)
      if (item.documents) {
        for (const d of item.documents) documentsNeeded.add(d)
      }
      if (item.tips) tips.push(...item.tips)
      if (item.estimatedTime && !estimatedTime) estimatedTime = item.estimatedTime
      if (item.cost && !cost) cost = item.cost
      if (item.officialLink) {
        relatedOfficialLinks.push({ name: item.title, url: item.officialLink })
      }
    }
  }

  // Official links from OFFICIAL_SOURCES
  const sources = getAllSources(destination)
  const officialLink = sources?.tax || sources?.immigration || null

  // If live research returned thin steps, fold in the hand-curated fallback
  // so the user-facing page is always actionable. We additively merge — live
  // research wins when present, fallback fills the gaps.
  let usedFallback = false
  if (taxRegistrationFallback && registrationSteps.length < 2) {
    usedFallback = true
    for (const step of taxRegistrationFallback.steps) {
      if (!registrationSteps.includes(step)) registrationSteps.push(step)
    }
    for (const doc of taxRegistrationFallback.documents) {
      documentsNeeded.add(doc)
    }
    for (const tip of taxRegistrationFallback.tips) {
      if (!tips.includes(tip)) tips.push(tip)
    }
    if (!estimatedTime) estimatedTime = taxRegistrationFallback.estimatedTime
    if (!cost) cost = taxRegistrationFallback.cost
  }

  const fallbackToOfficialLink = registrationSteps.length < 2

  return NextResponse.json({
    planId: plan.id,
    destination,
    taxIdName: taxIdInfo?.idName || "Tax ID",
    officeName: taxIdInfo?.officeName || "Local Tax Office",
    registrationSteps,
    documentsNeeded: Array.from(documentsNeeded),
    officialLink,
    relatedOfficialLinks,
    estimatedTime,
    cost,
    tips,
    fallbackToOfficialLink,
    usedFallback,
  })
}
