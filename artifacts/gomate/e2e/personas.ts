export interface Persona {
  slug: string;
  label: string;
  bundledMessage: string;
  /** Profile field keys that the extractor MUST populate after the bundled message. */
  expectedFields: string[];
  /** Free-form scripted answers to follow-up questions, keyed by lowercase substring of the question. */
  followUps: { match: RegExp; answer: string }[];
  /**
   * Default substantive answer when no follow-up regex matches the question.
   * Phase 4 fix #1 — must NOT be a deflection (no "skip"/"later"/"not sure"),
   * because those now trigger the application's deflection short-circuit and
   * mark the field as user_skipped. We want real answers so the extractor
   * actually populates fields and onboarding reaches `complete`.
   */
  defaultAnswer: string;
  /** Card data-specialist-card titles (or substrings) that MUST appear on dashboard. */
  mustVisibleCards: string[];
  /** Card titles that MUST NOT appear on dashboard. */
  mustHiddenCards: string[];
  /** Hostnames considered legitimate official sources for citations. */
  citationWhitelist: string[];
}

export const PERSONAS: Persona[] = [
  {
    slug: "roselle",
    label: "Roselle (Filipino → Sweden sambo)",
    bundledMessage:
      "I'm Roselle, 28, Filipino citizen, moving to Sweden to be with my Swedish partner Anders. We've been together for 4 years, planning to apply for sambo visa next month.",
    expectedFields: ["name", "destination"],
    followUps: [
      { match: /target.*city|where in.*sweden|which city|destination city|stockholm|gothenburg/i, answer: "Stockholm" },
      { match: /monthly.*income|how much.*earn|salary|what do you earn|income|monthly.*earnings/i, answer: "About 3500 USD per month as a freelance designer" },
      { match: /savings|saved|funds|nest egg|money set aside/i, answer: "Around 15000 USD in savings" },
      { match: /target.*date|when.*move|arrival|move.*date|when are you|when do you plan|timeline/i, answer: "About 30 days from now" },
      { match: /language|swedish|speak|do you speak/i, answer: "I know basic Swedish and I am taking lessons" },
      { match: /relationship|how long.*together|how long.*partner/i, answer: "We have been together for 4 years" },
      { match: /budget|monthly.*budget|spending/i, answer: "Around 2000 USD per month for living expenses" },
      { match: /partner.*work|anders.*job|partner.*employ|what does.*partner do/i, answer: "Anders is a software engineer at Spotify in Stockholm" },
      { match: /alone|family|kids|children|travelling with|who.*joining/i, answer: "Just me, no kids" },
      { match: /pet/i, answer: "No pets" },
      { match: /employ|your job|your work|profession|occupation/i, answer: "Freelance designer working remotely" },
      { match: /citizen|nationality|passport/i, answer: "Filipino citizen, Philippine passport" },
      { match: /education|degree|qualification/i, answer: "Bachelor degree in graphic design" },
      { match: /health.*insurance|insurance/i, answer: "I will get private health insurance for arrival" },
      { match: /housing|where.*live|accommodation/i, answer: "I will live with Anders in his apartment in Stockholm" },
      { match: /reason.*move|why.*moving|purpose/i, answer: "To live together with my partner Anders under the sambo visa" },
    ],
    defaultAnswer:
      "To recap my situation: I'm Roselle, 28, Filipino citizen, moving to Stockholm Sweden on the sambo visa to live with my Swedish partner Anders, planning to arrive in about 30 days, I work as a freelance designer making 3500 USD per month with about 15000 USD in savings, I speak basic Swedish, no pets, no kids, will live with Anders in his apartment.",
    mustVisibleCards: ["Visa", "Documents", "Cost of Living", "Cultural", "Housing"],
    mustHiddenCards: ["Schools", "Pet"],
    citationWhitelist: ["migrationsverket.se", "skatteverket.se", "europa.eu", "government.se"],
  },
  {
    slug: "axel",
    label: "Axel (German posting → Sweden)",
    bundledMessage:
      "My name is Axel, I'm 30, moving from Germany to Sweden for a 14-month work posting with my wife and two kids.",
    expectedFields: ["name", "destination"],
    followUps: [
      { match: /target.*city|where in.*sweden|which city|destination city/i, answer: "Stockholm" },
      { match: /employ|company|work for|employer|who.*work for/i, answer: "Siemens AG, posting to the Stockholm office" },
      { match: /children.*age|kids.*age|how old.*children|how old.*kids/i, answer: "Five and eight years old" },
      { match: /spouse.*career|wife.*work|partner.*career|wife.*profession|wife.*job/i, answer: "My wife works in marketing" },
      { match: /spouse.*join|wife.*join|partner.*join|family.*join/i, answer: "Yes, my wife and both kids are joining me" },
      { match: /spouse.*seek|wife.*work.*sweden|wife.*plan|wife.*looking/i, answer: "Yes, she plans to look for marketing work in Stockholm" },
      { match: /monthly.*income|salary|how much.*earn|income|earnings/i, answer: "About 8500 EUR per month" },
      { match: /pet/i, answer: "No pets" },
      { match: /posting|secondment|temporary assignment|type of move/i, answer: "Yes it is a temporary work posting for 14 months" },
      { match: /target.*date|arrival|when.*move|move.*date|when do you plan|timeline/i, answer: "In about 2 months" },
      { match: /a1|certificate|social security/i, answer: "Yes, my employer is handling the A1 certificate" },
      { match: /citizen|nationality|passport/i, answer: "German citizen, German passport" },
      { match: /savings|saved|funds/i, answer: "Around 50000 EUR in savings" },
      { match: /language|swedish|speak/i, answer: "I speak English fluently and basic Swedish" },
      { match: /housing|where.*live|accommodation/i, answer: "Company will arrange a furnished apartment near the office" },
      { match: /school|education.*kids|where.*kids.*school/i, answer: "International school for both kids" },
    ],
    defaultAnswer:
      "To recap: I'm Axel, 30, German citizen, moving to Stockholm Sweden on a 14-month work posting with Siemens, my wife Emma works in marketing and our two kids are 5 and 8 years old, my salary is 8500 EUR per month, planning to arrive in 2 months, no pets, kids will go to international school, company arranges housing.",
    mustVisibleCards: ["Visa", "Documents", "Cost of Living", "Schools"],
    mustHiddenCards: ["Pet"],
    citationWhitelist: [
      "migrationsverket.se",
      "skatteverket.se",
      "arbetsmiljoverket.se",
      "forsakringskassan.se",
      "europa.eu",
      "government.se",
    ],
  },
  {
    slug: "priya",
    label: "Priya (US DN → Spain)",
    bundledMessage:
      "Hi, I'm Priya, US citizen, software engineer making 14000 USD per month remote, want to move to Spain for the digital nomad visa. Solo, no family, no pets.",
    expectedFields: ["name", "destination"],
    followUps: [
      { match: /target.*city|which city.*spain|where in.*spain|destination city|barcelona|madrid/i, answer: "Barcelona" },
      { match: /savings|saved|funds|nest egg/i, answer: "About 80000 USD in savings" },
      { match: /language|spanish|speak/i, answer: "Beginner Spanish and fluent English" },
      { match: /target.*date|arrival|when.*move|move.*date|timeline/i, answer: "In about 3 months" },
      { match: /employ|company|work for|employer|who.*work for/i, answer: "I work remotely for a US tech company called Stripe" },
      { match: /pet/i, answer: "No pets" },
      { match: /spouse|partner|alone|family.*join|travelling with/i, answer: "Solo, no family joining me" },
      { match: /monthly.*income|salary|how much.*earn|income|earnings/i, answer: "14000 USD per month from my US employer" },
      { match: /citizen|nationality|passport/i, answer: "US citizen, US passport" },
      { match: /digital nomad|nomad visa|type of visa|visa type|which visa/i, answer: "The Spanish digital nomad visa, the new DN visa" },
      { match: /tax|tax residence|fiscal/i, answer: "I plan to apply for the Beckham law special tax regime" },
      { match: /housing|where.*live|accommodation/i, answer: "I will rent an apartment in Eixample, Barcelona" },
      { match: /health.*insurance|insurance/i, answer: "I will buy private Spanish health insurance from Sanitas" },
      { match: /education|degree|qualification/i, answer: "Bachelor degree in computer science from MIT" },
      { match: /age|how old/i, answer: "I am 32 years old" },
      { match: /reason.*move|why.*moving|purpose/i, answer: "Better quality of life and the digital nomad visa program" },
    ],
    defaultAnswer:
      "To recap: I'm Priya, 32, US citizen, software engineer at Stripe earning 14000 USD per month remote, moving to Barcelona Spain on the digital nomad visa, solo with no family or pets, planning to arrive in 3 months, 80000 USD in savings, beginner Spanish and fluent English, will rent in Eixample, private health insurance through Sanitas.",
    mustVisibleCards: ["Visa", "Tax", "Cost of Living", "Cultural"],
    mustHiddenCards: ["Schools", "Pet"],
    citationWhitelist: [
      "exteriores.gob.es",
      "agenciatributaria.gob.es",
      "boe.es",
      "lamoncloa.gob.es",
      "europa.eu",
      "inclusion.gob.es",
    ],
  },
  {
    slug: "stevenson",
    label: "Stevenson (UK → Australia w/ kids + dog)",
    bundledMessage:
      "We're the Stevensons — me James, 38, British, my wife Emma, our two kids ages 7 and 10, and our 5-year-old Border Collie. Moving to Melbourne, Australia for my new job at Atlassian. They're sponsoring my 482 visa.",
    expectedFields: ["name", "destination"],
    followUps: [
      { match: /monthly.*income|salary|how much.*earn|income|earnings/i, answer: "180000 AUD per year base salary at Atlassian" },
      { match: /spouse.*career|wife.*work|partner.*career|wife.*profession|wife.*job/i, answer: "My wife Emma is a registered nurse" },
      { match: /pet.*vacc|pet.*health|pet.*record/i, answer: "All vaccinations and rabies titer are current and up to date" },
      { match: /school.*type|public.*school|private.*school|state.*school/i, answer: "Public state school in Melbourne" },
      { match: /target.*city|where in.*australia|which city|destination city/i, answer: "Melbourne, Victoria" },
      { match: /spouse.*join|wife.*join|partner.*join|family.*join/i, answer: "Yes, my wife Emma and both children are joining me" },
      { match: /spouse.*seek|wife.*work.*aus|wife.*plan|wife.*looking/i, answer: "Yes, she will look for nursing work in Melbourne" },
      { match: /target.*date|arrival|when.*move|move.*date|timeline/i, answer: "In about 4 months" },
      { match: /pet.*type|what kind.*pet|species|breed/i, answer: "One Border Collie dog, 5 years old" },
      { match: /employ|company|work for|employer|who.*work for/i, answer: "Atlassian, sponsoring my 482 work visa" },
      { match: /citizen|nationality|passport/i, answer: "British citizens, UK passports for the whole family" },
      { match: /savings|saved|funds/i, answer: "About 120000 GBP in savings" },
      { match: /language|english|speak/i, answer: "All native English speakers" },
      { match: /housing|where.*live|accommodation/i, answer: "We will rent a 4 bedroom house in the inner suburbs" },
      { match: /children.*age|kids.*age|how old.*children|how old.*kids/i, answer: "Seven and ten years old" },
      { match: /visa type|which visa|482/i, answer: "Subclass 482 employer-sponsored work visa" },
      { match: /education|degree|qualification/i, answer: "I have a Masters in computer science, Emma has a nursing degree" },
      { match: /age|how old.*you/i, answer: "I am 38 years old" },
    ],
    defaultAnswer:
      "To recap: I'm James Stevenson, 38, British citizen, moving to Melbourne Australia on a subclass 482 work visa sponsored by Atlassian at 180000 AUD per year, with my wife Emma a registered nurse and our two kids ages 7 and 10, plus our 5-year-old Border Collie dog with all vaccinations current, planning to arrive in 4 months, 120000 GBP savings, all native English speakers, kids in public state school.",
    mustVisibleCards: ["Visa", "Schools", "Pet", "Documents", "Cost of Living"],
    mustHiddenCards: [],
    citationWhitelist: [
      "agriculture.gov.au",
      "homeaffairs.gov.au",
      "immi.homeaffairs.gov.au",
      "ato.gov.au",
      "education.vic.gov.au",
      "australia.gov.au",
    ],
  },
];
