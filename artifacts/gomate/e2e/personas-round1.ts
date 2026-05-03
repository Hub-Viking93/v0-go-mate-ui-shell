// Round-1 personas — same 10 personas the API harness drives, formatted for
// the Playwright frontend driver. The bundledMessage is the opening intro the
// user sends in the first turn; followUps regex-match the assistant's question
// text (FULL bubble text from `[data-testid="speech-bubble-text"]`) and
// produce the user's answer. defaultAnswer is a full recap that always
// contains substantive details for any unmatched question (NEVER a deflection
// — the app's deflection short-circuit would mark the field user_skipped).

export interface RoundOnePersona {
  slug: string;
  label: string;
  bundledMessage: string;
  followUps: { match: RegExp; answer: string }[];
  defaultAnswer: string;
  // Profile field keys that the dashboard ProfileDetailsCard MUST display
  // populated chips for after onboarding completes.
  expectedProfileChips: string[];
}

// Shared regex builders for fields that come up across personas. Order matters:
// more specific patterns must be listed before more general ones inside each
// persona's followUps array, because the matcher returns the first hit.
const COMMON_TIMELINE = /target.*date|arrival|when.*move|move.*date|when do you plan|timeline|how soon|when are you/i;
const COMMON_CITY = /target.*city|which city|where in|destination city/i;
const COMMON_SAVINGS = /savings|saved|funds|nest egg|money set aside|how much.*saved/i;
const COMMON_BUDGET = /monthly.*budget|monthly.*spend|budget.*month|living expenses|spending.*month/i;
const COMMON_INCOME = /monthly.*income|how much.*earn|salary|what do you earn|income|earnings|monthly.*pay/i;
const COMMON_ALONE = /alone|moving alone|travelling with|who.*joining|family.*join|coming with you/i;
const COMMON_PETS = /pet/i;
const COMMON_CITIZENSHIP = /citizen|nationality|passport/i;
const COMMON_EDUCATION = /education.*level|highest.*degree|qualification.*level|education background/i;
const COMMON_YEARS_EXP = /years.*experience|how long.*work|work experience|career.*length/i;
const COMMON_HOUSING = /housing|where.*live|accommodation|place to live/i;
const COMMON_HEALTHCARE = /health.*need|chronic|medical.*condition|healthcare.*requirement/i;
const COMMON_PURPOSE = /reason.*move|why.*moving|purpose.*move|main reason/i;
const COMMON_DURATION = /how long.*stay|duration|stay.*long|how many years|temporary or permanent/i;
const COMMON_VISA_ROLE = /visa role|primary applicant|principal applicant|dependent.*visa/i;

export const ROUND_ONE_PERSONAS: RoundOnePersona[] = [
  // ============================================================
  // 1. Sofia — Brazilian dev → Portugal (work primary, solo, dog)
  // ============================================================
  {
    slug: "sofia",
    label: "Sofia (BR → Portugal, work primary, solo, dog)",
    bundledMessage:
      "I'm Sofia Almeida, 32, Brazilian citizen living in São Paulo. I'm moving permanently to Lisbon, Portugal for a tech job — I already have an offer from a software company in Lisbon and they will sponsor my work visa. I'm moving alone with my medium-sized mixed Labrador dog (4 years old, ~18 kg, microchipped, vaccinations current). Planning to arrive in about 90 days.",
    followUps: [
      { match: /pet.*microchip|microchip/i, answer: "Yes, my dog is microchipped" },
      { match: /pet.*vacc|rabies|pet.*health/i, answer: "All vaccinations current including rabies, with boosters up to date" },
      { match: /pet.*size|pet.*weight|how big.*pet/i, answer: "Medium, about 18 kilograms" },
      { match: /pet.*breed|what kind.*dog|breed of/i, answer: "Mixed Labrador" },
      { match: /pet.*age|how old.*pet|how old.*dog/i, answer: "4 years old" },
      { match: /apostille|diploma.*authent|degree.*authent/i, answer: "Diploma apostille is in progress" },
      { match: /police.*clear|criminal.*record|background.*check/i, answer: "Police clearance certificate not started yet" },
      { match: /job.*offer|already.*offer|secured.*job/i, answer: "Yes I have a job offer" },
      { match: /job.*field|industry|sector|what.*field/i, answer: "Tech, software engineering" },
      { match: /sponsor|employer.*sponsor|company.*sponsor/i, answer: "Yes my employer will sponsor the work visa" },
      { match: /highly.*skilled|skilled.*worker|qualified.*professional/i, answer: "Yes I qualify as a highly skilled worker" },
      { match: /posting|secondment|intra.*company/i, answer: "No, this is a direct hire not a posting" },
      { match: COMMON_YEARS_EXP, answer: "9 years of professional experience" },
      { match: COMMON_EDUCATION, answer: "Bachelor degree in computer science" },
      { match: COMMON_PETS, answer: "One dog, mixed Labrador, 4 years old, ~18kg, microchipped, vaccinations including rabies are current" },
      { match: COMMON_TIMELINE, answer: "About 90 days from now" },
      { match: COMMON_CITY, answer: "Lisbon" },
      { match: COMMON_SAVINGS, answer: "About 45000 EUR in savings" },
      { match: COMMON_BUDGET, answer: "Around 2500 EUR per month" },
      { match: COMMON_INCOME, answer: "About 4500 EUR per month from the new Lisbon job" },
      { match: COMMON_ALONE, answer: "Yes, moving solo, just me and my dog" },
      { match: COMMON_HOUSING, answer: "Will rent an apartment in Lisbon, probably Alvalade or Arroios" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs" },
      { match: COMMON_DURATION, answer: "Permanent, planning to settle long term" },
      { match: COMMON_VISA_ROLE, answer: "I am the primary applicant" },
      { match: COMMON_PURPOSE, answer: "For work — I have a job offer in tech in Lisbon" },
      { match: COMMON_CITIZENSHIP, answer: "Brazilian citizen, Brazilian passport" },
    ],
    defaultAnswer:
      "Quick recap: I'm Sofia Almeida, 32, Brazilian citizen from São Paulo, moving permanently to Lisbon Portugal for a tech job — I have a job offer with employer sponsorship for the work visa, I qualify as highly skilled, 9 years of experience, bachelor in computer science, 45000 EUR savings, 2500 EUR monthly budget, arriving in 90 days, moving solo with my 4-year-old mixed Labrador (microchipped, vaccinations current, ~18kg). Diploma apostille in progress, police clearance not started.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "timeline", "savings_available"],
  },
  // ============================================================
  // 2. Hiroshi — Japanese student → Germany (study, solo)
  // ============================================================
  {
    slug: "hiroshi",
    label: "Hiroshi (JP → Germany, study, solo)",
    bundledMessage:
      "I'm Hiroshi Tanaka, Japanese citizen from Tokyo, moving to Munich, Germany to start a 3-year mechanical engineering masters program at a German university. Self-funded. Solo, no pets. Planning to arrive in about 120 days.",
    followUps: [
      { match: /study.*type|university.*program|program.*type/i, answer: "University program" },
      { match: /study.*field|field of study|what.*studying|major/i, answer: "Mechanical engineering" },
      { match: /study.*funding|how.*pay.*study|tuition.*fund|scholarship/i, answer: "Self-funded from family savings" },
      { match: /apostille|diploma.*authent/i, answer: "Bachelor diploma apostille is completed" },
      { match: /police.*clear|criminal.*record/i, answer: "Police clearance not started yet" },
      { match: COMMON_YEARS_EXP, answer: "0 years of professional work experience, fresh from undergraduate" },
      { match: COMMON_EDUCATION, answer: "Bachelor degree in mechanical engineering from Tokyo" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 120 days from now" },
      { match: COMMON_CITY, answer: "Munich" },
      { match: COMMON_SAVINGS, answer: "About 20000 EUR in savings" },
      { match: COMMON_BUDGET, answer: "Around 1200 EUR per month" },
      { match: COMMON_INCOME, answer: "No employment income, self-funded by family savings" },
      { match: COMMON_ALONE, answer: "Yes, moving alone" },
      { match: COMMON_HOUSING, answer: "Student dorm or shared WG apartment near the university" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs" },
      { match: COMMON_DURATION, answer: "3 years for the masters program" },
      { match: COMMON_VISA_ROLE, answer: "Primary applicant" },
      { match: COMMON_PURPOSE, answer: "For study — masters in mechanical engineering" },
      { match: COMMON_CITIZENSHIP, answer: "Japanese citizen, Japanese passport" },
    ],
    defaultAnswer:
      "Quick recap: I'm Hiroshi Tanaka, Japanese citizen from Tokyo, moving solo to Munich Germany for a 3-year university masters in mechanical engineering, self-funded with 20000 EUR savings and 1200 EUR monthly budget, arriving in 120 days, no pets, bachelor degree in mechanical engineering, diploma apostille completed, no work experience yet, will live in student housing near the university.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "timeline"],
  },
  // ============================================================
  // 3. Aisha — Nigerian nurse → Canada (work primary, family + 1 child)
  // ============================================================
  {
    slug: "aisha",
    label: "Aisha (NG → Canada, nurse, family + 1 child)",
    bundledMessage:
      "I'm Aisha Okafor, Nigerian citizen from Lagos. I'm a registered nurse with 7 years of experience and I have a job offer from a Toronto hospital that will sponsor my permanent work visa. My husband and our 6-year-old son are joining me. Planning to arrive in about 180 days.",
    followUps: [
      { match: /spouse.*join|wife.*join|partner.*join|husband.*join|family.*join/i, answer: "Yes, my husband and our 6-year-old son are joining me" },
      { match: /children.*count|how many.*kid|how many.*child/i, answer: "1 child" },
      { match: /children.*age|kids.*age|how old.*child|how old.*kid/i, answer: "6 years old" },
      { match: /spouse.*career|husband.*career|spouse.*field|husband.*work/i, answer: "My husband works in teaching" },
      { match: /spouse.*seek|wife.*work.*can|husband.*looking|spouse.*looking/i, answer: "Yes, he plans to look for teaching work in Toronto" },
      { match: /spouse.*language|husband.*english|spouse.*speak/i, answer: "Fluent English, both of us" },
      { match: /spouse.*visa|husband.*visa|dependent.*visa/i, answer: "Yes, his visa depends on mine as the primary applicant" },
      { match: /school.*type|public.*school|private.*school/i, answer: "Public school" },
      { match: /children.*language|kids.*english|children.*english/i, answer: "Fluent English, he attends English-language school in Lagos" },
      { match: /birth.*cert.*apost|child.*apostille/i, answer: "Birth certificate apostille is in progress" },
      { match: /family.*visa.*cascade|family.*depend.*visa.*aware/i, answer: "Yes, I understand the family visa cascade" },
      { match: /apostille|diploma.*authent/i, answer: "Diploma apostille is completed" },
      { match: /police.*clear|criminal.*record/i, answer: "Police clearance certificate is completed" },
      { match: /job.*offer/i, answer: "Yes, I have a job offer from a Toronto hospital" },
      { match: /job.*field|industry|sector/i, answer: "Healthcare, registered nursing" },
      { match: /sponsor|employer.*sponsor/i, answer: "Yes, the hospital will sponsor my permanent work visa" },
      { match: /highly.*skilled|skilled.*worker/i, answer: "Yes I qualify as a skilled worker" },
      { match: /posting|secondment/i, answer: "No, this is a direct hire" },
      { match: COMMON_YEARS_EXP, answer: "7 years of nursing experience" },
      { match: COMMON_EDUCATION, answer: "Bachelor degree in nursing" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 180 days from now" },
      { match: COMMON_CITY, answer: "Toronto" },
      { match: COMMON_SAVINGS, answer: "About 30000 CAD in savings" },
      { match: COMMON_BUDGET, answer: "Around 4500 CAD per month for the family" },
      { match: COMMON_INCOME, answer: "About 7000 CAD per month from the new nursing job" },
      { match: COMMON_ALONE, answer: "No, my husband and 6-year-old son are joining me" },
      { match: COMMON_HOUSING, answer: "Will rent a 2-bedroom apartment in Toronto, near the hospital" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs" },
      { match: COMMON_DURATION, answer: "Permanent, planning to settle long term in Canada" },
      { match: COMMON_VISA_ROLE, answer: "I am the primary applicant" },
      { match: COMMON_PURPOSE, answer: "For work — I have a sponsored nursing job in Toronto" },
      { match: COMMON_CITIZENSHIP, answer: "Nigerian citizen, Nigerian passport" },
    ],
    defaultAnswer:
      "Quick recap: I'm Aisha Okafor, Nigerian registered nurse from Lagos with 7 years experience, moving permanently to Toronto Canada for a sponsored hospital nursing job, with my husband (teacher, fluent English, will look for work) and our 6-year-old son (will attend public school, fluent English). 30000 CAD savings, 4500 CAD monthly budget, arriving in 180 days. Bachelor in nursing, diploma and police clearance completed, child birth certificate apostille in progress. No pets.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "spouse_joining", "children_count"],
  },
  // ============================================================
  // 4. Liam — Irish (EU) engineer → Netherlands (work, no visa needed)
  // ============================================================
  {
    slug: "liam",
    label: "Liam (Irish EU → Netherlands, work, cat)",
    bundledMessage:
      "I'm Liam O'Sullivan, Irish citizen from Dublin, moving to Amsterdam, Netherlands for a 5-year engineering job. Because I'm an EU citizen I don't need visa sponsorship. Bringing my 3-year-old British Shorthair cat (~5kg, microchipped, all vaccinations current including rabies). Solo otherwise. Planning to arrive in about 45 days.",
    followUps: [
      { match: /pet.*microchip|microchip/i, answer: "Yes, my cat is microchipped" },
      { match: /pet.*vacc|rabies|pet.*health/i, answer: "All current including rabies" },
      { match: /pet.*size|pet.*weight|how big.*pet/i, answer: "Small, about 5 kilograms" },
      { match: /pet.*breed|what kind.*cat/i, answer: "British Shorthair" },
      { match: /pet.*age|how old.*pet|how old.*cat/i, answer: "3 years old" },
      { match: /job.*offer/i, answer: "Yes I have a job offer" },
      { match: /job.*field|industry|sector/i, answer: "Engineering" },
      { match: /sponsor|employer.*sponsor/i, answer: "No sponsorship needed, I'm an EU citizen" },
      { match: /highly.*skilled|skilled.*worker|30%.*ruling/i, answer: "Yes, qualifying for the 30% ruling as a highly skilled migrant" },
      { match: /posting|secondment/i, answer: "No, direct hire" },
      { match: COMMON_YEARS_EXP, answer: "11 years of engineering experience" },
      { match: COMMON_EDUCATION, answer: "Masters degree in engineering" },
      { match: COMMON_PETS, answer: "One British Shorthair cat, 3 years old, ~5kg, microchipped, vaccinations including rabies are all current" },
      { match: COMMON_TIMELINE, answer: "About 45 days from now" },
      { match: COMMON_CITY, answer: "Amsterdam" },
      { match: COMMON_SAVINGS, answer: "About 35000 EUR in savings" },
      { match: COMMON_BUDGET, answer: "Around 3000 EUR per month" },
      { match: COMMON_INCOME, answer: "About 6500 EUR per month from the new Amsterdam job" },
      { match: COMMON_ALONE, answer: "Yes, just me and the cat" },
      { match: COMMON_HOUSING, answer: "Will rent an apartment in Amsterdam, ideally Oost or De Pijp" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs" },
      { match: COMMON_DURATION, answer: "5 years initially, possibly longer" },
      { match: COMMON_VISA_ROLE, answer: "Primary applicant — but as EU citizen I have free movement" },
      { match: COMMON_PURPOSE, answer: "For work — I have an engineering job offer in Amsterdam" },
      { match: COMMON_CITIZENSHIP, answer: "Irish citizen, Irish passport (EU)" },
    ],
    defaultAnswer:
      "Quick recap: I'm Liam O'Sullivan, Irish (EU) citizen from Dublin, moving to Amsterdam Netherlands for a 5-year engineering job — no sponsorship needed thanks to EU free movement, qualifying for the 30% ruling as highly skilled, 11 years experience, masters in engineering. 35000 EUR savings, 3000 EUR monthly budget, arriving in 45 days. Bringing one 3-year-old British Shorthair cat (~5kg, microchipped, vaccinations current).",
    expectedProfileChips: ["destination", "purpose", "citizenship", "timeline"],
  },
  // ============================================================
  // 5. Maria — Mexican → Australia (working holiday, solo)
  // ============================================================
  {
    slug: "maria",
    label: "Maria (MX → Australia, working holiday, solo)",
    bundledMessage:
      "I'm Maria Hernández, born in 1998, Mexican citizen from Guadalajara, moving to Sydney, Australia on a 12-month working holiday visa. Solo, no pets, no job offer yet — I'll work in hospitality once I'm there. Arriving in about 60 days.",
    followUps: [
      { match: /birth.*year|year of birth|when.*born/i, answer: "1998" },
      { match: /age|how old/i, answer: "I'm 27 years old" },
      { match: /job.*offer/i, answer: "No job offer yet, I'll find hospitality work after I arrive" },
      { match: /job.*field|industry|sector|what.*work/i, answer: "Hospitality — bars, cafes, restaurants" },
      { match: /sponsor|employer.*sponsor/i, answer: "No sponsorship — working holiday visa doesn't need it" },
      { match: /highly.*skilled|skilled.*worker/i, answer: "No, not applying as skilled worker, just working holiday" },
      { match: /posting|secondment/i, answer: "No" },
      { match: /working holiday|417|417 visa|visa type/i, answer: "Subclass 417 working holiday visa" },
      { match: COMMON_YEARS_EXP, answer: "About 4 years of hospitality work experience" },
      { match: COMMON_EDUCATION, answer: "Bachelor degree in hospitality management" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 60 days from now" },
      { match: COMMON_CITY, answer: "Sydney" },
      { match: COMMON_SAVINGS, answer: "About 8000 AUD in savings" },
      { match: COMMON_BUDGET, answer: "Around 2200 AUD per month" },
      { match: COMMON_INCOME, answer: "No income yet, will earn ~3000 AUD/month once I find hospitality work" },
      { match: COMMON_ALONE, answer: "Yes, moving solo" },
      { match: COMMON_HOUSING, answer: "Hostel first, then a shared house in inner Sydney" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs" },
      { match: COMMON_DURATION, answer: "12 months on the working holiday visa" },
      { match: COMMON_VISA_ROLE, answer: "Primary applicant, solo" },
      { match: COMMON_PURPOSE, answer: "Working holiday — travel and earn" },
      { match: COMMON_CITIZENSHIP, answer: "Mexican citizen, Mexican passport" },
    ],
    defaultAnswer:
      "Quick recap: I'm Maria Hernández, born 1998 (27), Mexican citizen from Guadalajara, moving solo to Sydney Australia on a 12-month subclass 417 working holiday visa. 4 years hospitality experience, bachelor in hospitality management. No job offer yet, will find bar/cafe work after arrival. 8000 AUD savings, 2200 AUD monthly budget, arriving in 60 days. No pets, hostel first then shared house.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "timeline"],
  },
  // ============================================================
  // 6. Chen — Chinese PhD → UK (study, scholarship, solo, chronic)
  // ============================================================
  {
    slug: "chen",
    label: "Chen (CN → UK, PhD scholarship, asthma)",
    bundledMessage:
      "I'm Chen Wei, Chinese citizen from Shanghai, moving to Cambridge UK for a 4-year PhD in computational biology on a full scholarship. Solo, no pets. I have well-managed asthma and use a Ventolin (salbutamol) inhaler daily. Arriving in about 150 days.",
    followUps: [
      { match: /study.*type|university.*program|program.*type/i, answer: "University PhD program" },
      { match: /study.*field|field of study|what.*studying|major/i, answer: "Computational biology" },
      { match: /study.*funding|scholarship|tuition.*fund/i, answer: "Full scholarship covering tuition and stipend" },
      { match: /chronic.*condit|describe.*condit|what.*condit|asthma/i, answer: "Well-managed asthma, controlled with daily inhaler" },
      { match: /prescription.*list|medication.*list|what.*medication|inhaler/i, answer: "Ventolin (salbutamol) 100mcg inhaler" },
      { match: /english.*speak.*doctor|english.*doctor/i, answer: "Yes, I'd prefer an English-speaking doctor" },
      { match: /pre.*existing|disclosure.*concern/i, answer: "No concern about disclosing the pre-existing condition" },
      { match: /apostille|diploma.*authent/i, answer: "Diploma apostille is completed" },
      { match: /police.*clear|criminal.*record/i, answer: "Police clearance is completed" },
      { match: COMMON_YEARS_EXP, answer: "About 2 years of research experience" },
      { match: COMMON_EDUCATION, answer: "Masters degree in biology" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 150 days from now" },
      { match: COMMON_CITY, answer: "Cambridge" },
      { match: COMMON_SAVINGS, answer: "About 10000 GBP in savings, plus the scholarship stipend" },
      { match: COMMON_BUDGET, answer: "Around 1500 GBP per month" },
      { match: COMMON_INCOME, answer: "Scholarship stipend of about 1800 GBP per month" },
      { match: COMMON_ALONE, answer: "Yes, moving solo" },
      { match: COMMON_HOUSING, answer: "College accommodation at Cambridge" },
      { match: COMMON_HEALTHCARE, answer: "I have well-managed asthma, need access to inhaler prescriptions" },
      { match: COMMON_DURATION, answer: "4 years for the PhD" },
      { match: COMMON_VISA_ROLE, answer: "Primary applicant" },
      { match: COMMON_PURPOSE, answer: "For study — PhD in computational biology at Cambridge" },
      { match: COMMON_CITIZENSHIP, answer: "Chinese citizen, Chinese passport" },
    ],
    defaultAnswer:
      "Quick recap: I'm Chen Wei, Chinese citizen from Shanghai, moving solo to Cambridge UK for a 4-year fully-funded PhD in computational biology, masters in biology, 2 years research experience. 10000 GBP savings + scholarship stipend, 1500 GBP monthly budget, arriving in 150 days. Well-managed asthma on daily Ventolin (salbutamol) inhaler, prefer English-speaking doctor, no disclosure concern, diploma and police clearance both completed. No pets.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "healthcare_needs"],
  },
  // ============================================================
  // 7. Olga — Russian designer → Cyprus (digital nomad, solo, cat)
  // ============================================================
  {
    slug: "olga",
    label: "Olga (RU → Cyprus, digital nomad, cat)",
    bundledMessage:
      "I'm Olga Petrova, Russian citizen currently in Belgrade Serbia, moving to Limassol Cyprus on the digital nomad visa for an initial 12 months. I freelance as a designer earning ~5500 EUR/month with stable income for 30 months. Bringing my 6-year-old domestic shorthair cat (~4kg, microchipped, rabies + boosters current). Solo otherwise. Arriving in about 60 days.",
    followUps: [
      { match: /pet.*microchip|microchip/i, answer: "Yes, my cat is microchipped" },
      { match: /pet.*vacc|rabies|pet.*health/i, answer: "All vaccinations current including rabies" },
      { match: /pet.*size|pet.*weight|how big.*pet/i, answer: "Small, about 4 kilograms" },
      { match: /pet.*breed|what kind.*cat/i, answer: "Domestic shorthair" },
      { match: /pet.*age|how old.*pet|how old.*cat/i, answer: "6 years old" },
      { match: /remote.*income|remote.*work|work.*remote/i, answer: "Yes, fully remote freelance work" },
      { match: /income.*source|source.*income/i, answer: "Freelance design clients, mostly EU and US" },
      { match: /income.*consist|stable.*income|consistent.*income/i, answer: "Stable, very consistent" },
      { match: /income.*history|how long.*income|income.*months/i, answer: "30 months of consistent income history" },
      { match: COMMON_YEARS_EXP, answer: "8 years of design experience" },
      { match: COMMON_EDUCATION, answer: "Bachelor degree in design" },
      { match: COMMON_PETS, answer: "One domestic shorthair cat, 6 years old, ~4kg, microchipped, vaccinations including rabies all current" },
      { match: COMMON_TIMELINE, answer: "About 60 days from now" },
      { match: COMMON_CITY, answer: "Limassol" },
      { match: COMMON_SAVINGS, answer: "About 25000 EUR in savings" },
      { match: COMMON_BUDGET, answer: "Around 2800 EUR per month" },
      { match: COMMON_INCOME, answer: "About 5500 EUR per month from freelance design clients, stable for 30 months" },
      { match: COMMON_ALONE, answer: "Yes, solo with my cat" },
      { match: COMMON_HOUSING, answer: "Will rent an apartment in Limassol near the seafront" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs" },
      { match: COMMON_DURATION, answer: "12 months initially on the digital nomad visa" },
      { match: COMMON_VISA_ROLE, answer: "Primary applicant" },
      { match: COMMON_PURPOSE, answer: "Digital nomad visa — remote freelance designer" },
      { match: COMMON_CITIZENSHIP, answer: "Russian citizen, Russian passport (currently residing in Serbia)" },
    ],
    defaultAnswer:
      "Quick recap: I'm Olga Petrova, Russian citizen currently in Belgrade Serbia, moving to Limassol Cyprus on the digital nomad visa for 12 months initially. Freelance designer, 8 years experience, bachelor in design, ~5500 EUR/month stable freelance income for 30 months, 25000 EUR savings, 2800 EUR monthly budget, arriving in 60 days. Bringing 6-year-old domestic shorthair cat (~4kg, microchipped, rabies current). Solo otherwise.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "timeline"],
  },
  // ============================================================
  // 8. Tom — American retiree → Thailand (settle, with spouse, chronic)
  // ============================================================
  {
    slug: "tom",
    label: "Tom (US → Thailand, retirement, spouse, diabetes)",
    bundledMessage:
      "I'm Tom Mitchell, born 1958 (American citizen, Phoenix AZ), retiring permanently to Chiang Mai Thailand with my wife (also retired, former librarian, English only). I have type 2 diabetes and controlled hypertension — daily metformin 1000mg and lisinopril 10mg. No kids joining. Arriving in about 120 days.",
    followUps: [
      { match: /settle.*reason|why.*settle|reason.*settle|retirement/i, answer: "Retirement — we want a slower-paced life and lower cost of living" },
      { match: /family.*ties|family.*destination|ties.*country/i, answer: "No family ties in Thailand" },
      { match: /spouse.*join|wife.*join|partner.*join/i, answer: "Yes, my wife is joining me" },
      { match: /children.*count|how many.*kid|how many.*child/i, answer: "0 children joining" },
      { match: /spouse.*career|wife.*career|spouse.*field|wife.*work/i, answer: "Retired, formerly a librarian" },
      { match: /spouse.*seek|wife.*work.*thai|spouse.*looking|wife.*looking/i, answer: "No, she's retired and not looking for work" },
      { match: /spouse.*language|wife.*english|spouse.*speak/i, answer: "English only" },
      { match: /spouse.*visa|wife.*visa|dependent.*visa/i, answer: "Yes, her visa depends on mine as the primary applicant" },
      { match: /chronic.*condit|describe.*condit|what.*condit|diabetes/i, answer: "Type 2 diabetes and controlled hypertension, both managed with daily medication" },
      { match: /prescription.*list|medication.*list|what.*medication/i, answer: "Metformin 1000mg twice daily and Lisinopril 10mg once daily" },
      { match: /english.*speak.*doctor|english.*doctor/i, answer: "Yes, English-speaking doctor required" },
      { match: /pre.*existing|disclosure.*concern/i, answer: "Yes, I'm concerned about insurance disclosure of pre-existing conditions" },
      { match: /birth.*year|year of birth|when.*born/i, answer: "1958" },
      { match: /age|how old/i, answer: "I'm 67 years old" },
      { match: COMMON_YEARS_EXP, answer: "35 years of work experience, now retired" },
      { match: COMMON_EDUCATION, answer: "Bachelor degree" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 120 days from now" },
      { match: COMMON_CITY, answer: "Chiang Mai" },
      { match: COMMON_SAVINGS, answer: "About 350000 USD in retirement savings" },
      { match: COMMON_BUDGET, answer: "Around 2500 USD per month for both of us" },
      { match: COMMON_INCOME, answer: "Pension and social security, about 4500 USD per month combined" },
      { match: COMMON_ALONE, answer: "No, my wife is joining me" },
      { match: COMMON_HOUSING, answer: "Will rent a 2-bedroom condo in Chiang Mai, near Nimman" },
      { match: COMMON_HEALTHCARE, answer: "Yes — type 2 diabetes and controlled hypertension, ongoing prescriptions" },
      { match: COMMON_DURATION, answer: "Permanent, planning to retire there" },
      { match: COMMON_VISA_ROLE, answer: "I am the primary applicant" },
      { match: COMMON_PURPOSE, answer: "Retirement — settling permanently with my wife" },
      { match: COMMON_CITIZENSHIP, answer: "American citizen, US passport" },
    ],
    defaultAnswer:
      "Quick recap: I'm Tom Mitchell, born 1958 (67), American citizen from Phoenix, retiring permanently to Chiang Mai Thailand with my wife (retired former librarian, English only, dependent visa). 350000 USD retirement savings, 2500 USD monthly budget, ~4500 USD combined pension+social security, arriving in 120 days. Type 2 diabetes and hypertension on daily metformin 1000mg + lisinopril 10mg, English-speaking doctor required, concerned about insurance disclosure of pre-existing conditions. No kids, no pets.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "spouse_joining"],
  },
  // ============================================================
  // 9. Fatima — Moroccan → France (family reunion, dependent visa)
  // ============================================================
  {
    slug: "fatima",
    label: "Fatima (MA → France, family reunion, dependent)",
    bundledMessage:
      "I'm Fatima El-Amrani, Moroccan citizen from Casablanca, moving permanently to Lyon France for family reunion — my husband is a French citizen (born in France, software engineer, already working in Lyon). We've been married 5 years, our 3-year-old daughter is moving with us. I'm applying as a dependent on my husband's status. Arriving in about 90 days.",
    followUps: [
      { match: /partner.*citizen|husband.*citizen|partner.*nationality/i, answer: "French citizen, born in France" },
      { match: /partner.*visa.*status|husband.*visa.*status|partner.*status/i, answer: "Citizen, lifelong" },
      { match: /relationship.*type|spouse.*or|married|relationship type/i, answer: "Spouse — we're married" },
      { match: /partner.*resid|husband.*resid|partner.*lived/i, answer: "Lifelong, born in France" },
      { match: /relationship.*duration|how long.*together|how long.*married/i, answer: "Married 5 years" },
      { match: /settle.*reason|why.*settle|reason.*settle|family.*reunion/i, answer: "Family reunion — joining my French husband" },
      { match: /family.*ties/i, answer: "Yes, my husband is French and lives there" },
      { match: /spouse.*join|husband.*join|partner.*join/i, answer: "He's already there — I'm joining him" },
      { match: /children.*count|how many.*kid|how many.*child/i, answer: "1 child" },
      { match: /children.*age|kids.*age|how old.*child/i, answer: "3 years old" },
      { match: /marriage.*cert.*apost|marriage.*apostille/i, answer: "Marriage certificate apostille is completed" },
      { match: /birth.*cert.*apost|birth.*apostille/i, answer: "Birth certificate apostille completed for both me and my daughter" },
      { match: /school.*type|public.*school|private.*school/i, answer: "Public school" },
      { match: /children.*language|kids.*french|children.*french/i, answer: "Basic French — we speak some French at home" },
      { match: /spouse.*career|husband.*career|spouse.*field|husband.*work/i, answer: "Software engineering, already employed in Lyon" },
      { match: /spouse.*seek|husband.*looking|spouse.*looking/i, answer: "No, he's already employed" },
      { match: /spouse.*language|husband.*french|spouse.*speak/i, answer: "Native French, fluent English" },
      { match: /spouse.*visa|husband.*visa|dependent.*visa/i, answer: "No — he's a French citizen, no visa needed for him" },
      { match: COMMON_YEARS_EXP, answer: "About 6 years of experience as a teacher" },
      { match: COMMON_EDUCATION, answer: "Bachelor degree in education" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 90 days from now" },
      { match: COMMON_CITY, answer: "Lyon" },
      { match: COMMON_SAVINGS, answer: "About 12000 EUR in savings" },
      { match: COMMON_BUDGET, answer: "Around 2200 EUR per month for the family" },
      { match: COMMON_INCOME, answer: "Currently no income, husband earns ~5000 EUR/month in Lyon" },
      { match: COMMON_ALONE, answer: "No, my 3-year-old daughter is moving with me to join my husband" },
      { match: COMMON_HOUSING, answer: "We'll live in my husband's apartment in Lyon, possibly upsize later" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs" },
      { match: COMMON_DURATION, answer: "Permanent, settling in France long term" },
      { match: COMMON_VISA_ROLE, answer: "Dependent visa on my French citizen husband" },
      { match: COMMON_PURPOSE, answer: "Family reunion — joining my French husband and settling permanently" },
      { match: COMMON_CITIZENSHIP, answer: "Moroccan citizen, Moroccan passport" },
    ],
    defaultAnswer:
      "Quick recap: I'm Fatima El-Amrani, Moroccan citizen from Casablanca, moving permanently to Lyon France for family reunion as a dependent on my French citizen husband (born in France, software engineer in Lyon, native French + fluent English). Married 5 years, our 3-year-old daughter joining us. 12000 EUR savings, 2200 EUR monthly budget, arriving in 90 days. Bachelor in education, ~6 years teaching experience. Marriage and birth certificate apostilles all completed. Daughter to public school, basic French at home. No pets.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "spouse_joining", "children_count"],
  },
  // ============================================================
  // 10. Erik — Swedish engineer → USA (work primary, H-1B, family)
  // ============================================================
  {
    slug: "erik",
    label: "Erik (SE → USA, H-1B, family + 2 kids)",
    bundledMessage:
      "I'm Erik Lindström, Swedish citizen from Gothenburg, moving to Seattle USA on H-1B for a tech job (employer-sponsored, 3 years initial, 13 years experience, masters). My wife (marketing, fluent English, will need EAD on H-4) and our two kids (ages 4 and 8, fluent English) are joining me. Arriving in about 150 days.",
    followUps: [
      { match: /spouse.*join|wife.*join|partner.*join|family.*join/i, answer: "Yes, my wife and our two kids (ages 4 and 8) are joining me" },
      { match: /children.*count|how many.*kid|how many.*child/i, answer: "2 children" },
      { match: /children.*age|kids.*age|how old.*child|how old.*kid/i, answer: "4 and 8 years old" },
      { match: /spouse.*career|wife.*career|spouse.*field|wife.*work/i, answer: "Marketing" },
      { match: /spouse.*seek|wife.*work.*us|wife.*looking|spouse.*looking|EAD/i, answer: "Yes — she'll need EAD on H-4 to work" },
      { match: /spouse.*language|wife.*english|spouse.*speak/i, answer: "Fluent English" },
      { match: /spouse.*visa|wife.*visa|dependent.*visa|H-4|H4/i, answer: "Yes — H-4 dependent on my H-1B" },
      { match: /school.*type|public.*school|private.*school/i, answer: "Public school" },
      { match: /children.*language|kids.*english|children.*english/i, answer: "Fluent English, both kids" },
      { match: /birth.*cert.*apost|child.*apostille/i, answer: "Birth certificate apostilles completed for both kids" },
      { match: /family.*visa.*cascade|family.*depend.*visa.*aware/i, answer: "Yes, I understand the H-1B → H-4 cascade and EAD requirements" },
      { match: /apostille|diploma.*authent/i, answer: "Diploma apostille is completed" },
      { match: /police.*clear|criminal.*record/i, answer: "Police clearance not required for H-1B" },
      { match: /job.*offer/i, answer: "Yes, I have an H-1B sponsored job offer in Seattle" },
      { match: /job.*field|industry|sector/i, answer: "Tech, software engineering" },
      { match: /sponsor|employer.*sponsor|H-1B|H1B|H 1 B/i, answer: "Yes, employer-sponsored H-1B" },
      { match: /highly.*skilled|skilled.*worker/i, answer: "Yes, highly skilled / specialty occupation" },
      { match: /posting|secondment/i, answer: "No, this is a direct H-1B hire not an L-1 transfer" },
      { match: COMMON_YEARS_EXP, answer: "13 years of software engineering experience" },
      { match: COMMON_EDUCATION, answer: "Masters degree in computer science" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 150 days from now" },
      { match: COMMON_CITY, answer: "Seattle" },
      { match: COMMON_SAVINGS, answer: "About 75000 USD in savings" },
      { match: COMMON_BUDGET, answer: "Around 7500 USD per month for the family" },
      { match: COMMON_INCOME, answer: "About 16000 USD per month from the H-1B sponsored tech role" },
      { match: COMMON_ALONE, answer: "No, my wife and two kids (4 and 8) are joining me" },
      { match: COMMON_HOUSING, answer: "Will rent a 3-bedroom house in Seattle, possibly Eastside near the office" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs" },
      { match: COMMON_DURATION, answer: "3 years initially on H-1B, possibly extending to permanent" },
      { match: COMMON_VISA_ROLE, answer: "I am the primary H-1B applicant; family on H-4" },
      { match: COMMON_PURPOSE, answer: "For work — H-1B sponsored tech role in Seattle" },
      { match: COMMON_CITIZENSHIP, answer: "Swedish citizen, Swedish passport (EU)" },
    ],
    defaultAnswer:
      "Quick recap: I'm Erik Lindström, Swedish citizen from Gothenburg, moving to Seattle USA on H-1B (employer-sponsored, 3 years initial, tech, 13 years experience, masters in CS). Wife in marketing (fluent English, needs EAD on H-4) and our two kids ages 4 and 8 (fluent English, public school) are joining. 75000 USD savings, 7500 USD monthly budget, ~16000 USD monthly income, arriving in 150 days. Diploma apostille completed, child birth certificates apostilled. Aware of H-1B → H-4 cascade. No pets.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "spouse_joining", "children_count"],
  },
  // ============================================================
  // 11. Roselle — Filipina → Sweden (sambo reunification + work, solo)
  // ============================================================
  {
    slug: "roselle",
    label: "Roselle (PH → Sweden, sambo reunification + work, solo)",
    bundledMessage:
      "I'm Roselle Santos, 29, Filipino citizen currently in Manila, Philippines. I'm moving permanently to Stockholm, Sweden to live with my Swedish sambo (cohabiting partner) — we've been together for 3 years and lived together in Manila for the last 18 months. I'll apply for the Swedish sambo residence permit (uppehållstillstånd för sambo) at the Swedish embassy. I plan to work in Sweden once I have the residence permit — I'm a registered nurse with 6 years of hospital experience. Moving alone (no kids, no pets). Planning to arrive in about 180 days once the residence permit is approved.",
    followUps: [
      { match: /sambo|cohabit|partner.*together|relationship.*length|how long.*relationship|how long.*together/i, answer: "Together 3 years, lived together 18 months in Manila" },
      { match: /partner.*citizen|partner.*nationality|partner.*swedish/i, answer: "Yes, my partner is a Swedish citizen" },
      { match: /partner.*income|partner.*support|partner.*employed|partner.*work/i, answer: "Yes, my partner works full-time in Stockholm with stable income" },
      { match: /maintenance.*requirement|försörjningskrav|income.*requirement|sponsor.*income/i, answer: "My partner meets the Swedish maintenance requirement (försörjningskrav)" },
      { match: /housing.*sweden|housing.*sufficient|partner.*apartment|apartment.*size/i, answer: "My partner has a 2-room apartment in Stockholm that meets Migrationsverket housing requirements" },
      { match: /marriage|married|civil.*union|äktenskap/i, answer: "Not married, we are sambo (cohabiting partners)" },
      { match: /apostille|diploma.*authent|degree.*authent|nursing.*license/i, answer: "Nursing diploma authenticated by DFA Manila, will need Socialstyrelsen evaluation in Sweden" },
      { match: /police.*clear|criminal.*record|background.*check|nbi/i, answer: "NBI clearance from Philippines is current" },
      { match: /job.*offer|already.*offer|secured.*job/i, answer: "No job offer yet — will look for nursing work after arriving on the sambo permit" },
      { match: /job.*field|industry|sector|what.*field|profession/i, answer: "Healthcare / nursing — registered nurse" },
      { match: /sponsor|employer.*sponsor|company.*sponsor/i, answer: "No employer sponsor — moving on the sambo (partner) residence permit, not a work permit" },
      { match: /highly.*skilled|skilled.*worker|qualified.*professional/i, answer: "Registered nurse with 6 years hospital experience — qualified healthcare professional" },
      { match: /swedish.*language|svenska|language.*level|sfi/i, answer: "Beginner Swedish, will join SFI (Swedish for immigrants) after arriving" },
      { match: /personnummer|coordination.*number|samordningsnummer/i, answer: "Will apply for personnummer at Skatteverket after arriving with the residence permit" },
      { match: COMMON_YEARS_EXP, answer: "6 years of professional nursing experience in hospitals in Manila" },
      { match: COMMON_EDUCATION, answer: "Bachelor of Science in Nursing (BSN) from University of Santo Tomas, Manila" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 180 days from now, once the residence permit is approved" },
      { match: COMMON_CITY, answer: "Stockholm" },
      { match: COMMON_SAVINGS, answer: "About 8000 EUR in personal savings" },
      { match: COMMON_BUDGET, answer: "Around 1500 EUR per month for personal spending — sharing housing costs with my partner" },
      { match: COMMON_INCOME, answer: "No Swedish income yet — currently earning ~700 EUR/month as a nurse in Manila, will look for nursing work in Stockholm after arriving" },
      { match: COMMON_ALONE, answer: "Yes, moving alone — joining my Swedish sambo who already lives in Stockholm" },
      { match: COMMON_HOUSING, answer: "Will live with my Swedish sambo in his 2-room apartment in Stockholm" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs, generally healthy" },
      { match: COMMON_DURATION, answer: "Permanent — planning to settle long term in Sweden with my partner" },
      { match: COMMON_VISA_ROLE, answer: "Primary applicant for the sambo (cohabiting partner) residence permit" },
      { match: COMMON_PURPOSE, answer: "Family reunification — moving to live with my Swedish sambo in Stockholm — and I will work as a nurse once I have the residence permit" },
      { match: COMMON_CITIZENSHIP, answer: "Filipino citizen, Philippine passport" },
    ],
    defaultAnswer:
      "Quick recap: I'm Roselle Santos, 29, Filipino citizen from Manila, moving permanently to Stockholm Sweden to live with my Swedish sambo (cohabiting partner of 3 years, lived together 18 months in Manila) on the Swedish sambo residence permit. Plan to work as a registered nurse (BSN, 6 years hospital experience) after arriving. Solo move (no kids, no pets), 8000 EUR savings, 1500 EUR monthly personal budget, partner has a 2-room Stockholm apartment and meets the maintenance requirement. Arriving in 180 days. Beginner Swedish — will join SFI. NBI clearance current, nursing diploma authenticated by DFA, will need Socialstyrelsen evaluation.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "timeline", "moving_alone"],
  },
  // ============================================================
  // 12. Axel — Swedish entrepreneur → Philippines (work + lifestyle, solo)
  // ============================================================
  {
    slug: "axel",
    label: "Axel (SE → Philippines, remote work + lifestyle, solo)",
    bundledMessage:
      "I'm Axel Bergström, 34, Swedish citizen currently in Stockholm. I'm moving to Cebu City, Philippines on the SRRV (Special Resident Retiree's Visa) Smile category as a remote-working software entrepreneur. I run my own SaaS company registered in Sweden — I'll continue working remotely earning around 6000 EUR/month after Swedish taxes. Moving solo, no pets, no kids. Planning to arrive in about 120 days. Have ~50000 EUR savings plus the SRRV deposit (~10000 USD).",
    followUps: [
      { match: /srrv|special.*resident|retiree.*visa|smile.*category/i, answer: "SRRV Smile category — 10000 USD time deposit at an authorized Philippine bank" },
      { match: /remote.*income|remote.*work|work.*remote/i, answer: "Yes, fully remote — I run my own SaaS company registered in Sweden" },
      { match: /income.*source|source.*income/i, answer: "My own Swedish-registered SaaS company, paying myself a salary" },
      { match: /income.*consist|stable.*income|consistent.*income/i, answer: "Stable, consistent for the last 4 years" },
      { match: /income.*history|how long.*income|income.*months/i, answer: "48 months of consistent income from the SaaS business" },
      { match: /tax.*residency|tax.*resident|skatteverket|where.*tax/i, answer: "Will become Philippines tax resident after 183 days; will deregister from Swedish tax with Skatteverket flyttningsanmälan" },
      { match: /company.*register|business.*register|ab.*sweden/i, answer: "Swedish AB (aktiebolag) registered in Stockholm, will keep it registered in Sweden" },
      { match: /apostille|diploma.*authent|degree.*authent/i, answer: "Bachelor diploma already apostilled by Swedish UD (Utrikesdepartementet)" },
      { match: /police.*clear|criminal.*record|background.*check/i, answer: "Belastningsregister (Swedish criminal record extract) ordered, will apostille for Philippines submission" },
      { match: /job.*offer|already.*offer|secured.*job/i, answer: "No external job offer — I am self-employed running my own SaaS company" },
      { match: /job.*field|industry|sector|what.*field|profession/i, answer: "Tech / SaaS — software entrepreneur" },
      { match: /sponsor|employer.*sponsor|company.*sponsor/i, answer: "No sponsor — moving on the SRRV Smile retiree-style visa, not a work permit" },
      { match: /highly.*skilled|skilled.*worker|qualified.*professional/i, answer: "Yes, qualified tech professional with 11 years experience" },
      { match: /tagalog|filipino.*language|cebuano|local.*language/i, answer: "Beginner Tagalog, conversational English — most business in Cebu is in English" },
      { match: /housing.*philippines|condo|cebu.*housing|where.*live.*cebu/i, answer: "Will rent a serviced condo in Cebu IT Park area for the first 6 months, then look at long-term rental" },
      { match: /healthcare.*philippines|insurance|philhealth|private.*insurance/i, answer: "Will get private international health insurance (Cigna or similar) before arrival" },
      { match: COMMON_YEARS_EXP, answer: "11 years of professional software/tech experience" },
      { match: COMMON_EDUCATION, answer: "Bachelor degree in computer science from KTH Stockholm" },
      { match: COMMON_PETS, answer: "No pets" },
      { match: COMMON_TIMELINE, answer: "About 120 days from now" },
      { match: COMMON_CITY, answer: "Cebu City" },
      { match: COMMON_SAVINGS, answer: "About 50000 EUR in savings, plus 10000 USD set aside for the SRRV time deposit" },
      { match: COMMON_BUDGET, answer: "Around 1800 EUR per month for cost of living in Cebu" },
      { match: COMMON_INCOME, answer: "About 6000 EUR per month from my Swedish SaaS company, paid as salary, stable for 48 months" },
      { match: COMMON_ALONE, answer: "Yes, moving solo — no spouse, no kids, no pets" },
      { match: COMMON_HOUSING, answer: "Serviced condo in Cebu IT Park initially, then long-term rental" },
      { match: COMMON_HEALTHCARE, answer: "No special healthcare needs, will carry private international health insurance" },
      { match: COMMON_DURATION, answer: "Permanent — SRRV is indefinite, planning to settle long term in Cebu" },
      { match: COMMON_VISA_ROLE, answer: "Primary applicant on the SRRV Smile" },
      { match: COMMON_PURPOSE, answer: "Lifestyle and remote work — I want to live in Cebu while continuing to run my Swedish SaaS company remotely on the SRRV Smile retiree-style visa" },
      { match: COMMON_CITIZENSHIP, answer: "Swedish citizen, Swedish passport (EU)" },
    ],
    defaultAnswer:
      "Quick recap: I'm Axel Bergström, 34, Swedish citizen from Stockholm, moving permanently to Cebu City Philippines on the SRRV Smile retiree visa (10000 USD time deposit). Remote-working software entrepreneur running my own Swedish AB SaaS company, ~6000 EUR/month salary, stable for 48 months. Moving solo, no pets, no kids. 50000 EUR savings + SRRV deposit, 1800 EUR monthly Cebu budget, arriving in 120 days. Bachelor in CS from KTH, 11 years tech experience, diploma apostilled, criminal record extract being apostilled. Will carry private international health insurance.",
    expectedProfileChips: ["destination", "purpose", "citizenship", "timeline", "moving_alone"],
  },
];
