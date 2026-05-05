# GoMate Pocket Consultant — Gap Analysis

Det här dokumentet sammanfattar vad som fattas för att GoMate ska gå
från "info-app + dashboard" till en faktisk pocket consultant för
gemene man (B2C, individer som flyttar utomlands).

Källan är `consult.md` (vad riktiga relocationkonsulter faktiskt
gör) korsläst med GoMates nuvarande tillstånd (efter onboarding-
wizardens lansering, work/study/settle/digital-nomad-grenarna,
review-sidan och dashboarden).

Scope:

- B2C only — ingen utstationering, B2B, enterprise mobility, payroll,
  benchmarking, policy consulting
- Vad vi kan bygga **utan** myndighetsintegrationer eller partnerships
- Vad som måste vänta tills vi har avtal med banker, försäkringsbolag,
  flytt-firmor, listings-sajter osv.

## Vad "pocket consultant" betyder

En riktig relocationkonsult gör tre saker en B2C-app sällan gör:

1. **Koordinerar handling** — bokar möten, fyller blanketter med dig,
   knackar på myndigheter när det stockar sig
2. **Är tid-medveten** — "du landar 1 juni, du måste registrera dig
   hos folkbokföringen senast 8 juni eller du tappar X"
3. **Hanterar dokumentationen** — har dina papper, vet vad som krävs,
   ser till att du har rätt format/apostille/översättning

GoMate idag är en **informationsmaskin**: plan, checklist, guides,
AI som svarar på frågor. Det är en bra hälft. Den andra hälften — den
som gör det till en *konsult* — saknas mestadels.

## Vad GoMate har idag

- Onboarding-wizard (4 purpose-grenar) ✓
- Visa-rekommendationer från specialist ✓
- Country guides (statiska / AI-genererade) ✓
- Cost-of-living + budget-card ✓
- Checklist-sida (pre-move + post-move tabs) ✓
- AI-chat för fri Q&A ✓
- Dashboard-tabs: Overview / Profile / Visa & Legal / Money / Settling ✓

Detta är information + översikt. Bra fundament. Men mer "wikipedia +
dashboard" än "konsult".

---

## Tier 1 — Kritiskt och buildbart NU

Det som måste finnas för att överhuvudtaget kalla sig pocket consultant.
Allt under denna rubrik kräver inga externa partnerships eller
myndighetsintegrationer.

### 1. Tid-medveten personlig checklist med deadlines

**Varför:** En konsult säger "du har 7 dagar kvar för folkbokföring".
GoMate säger "registrera dig hos folkbokföringen". Skillnaden är hela
poängen.

**Buildbart nu:** Varje task får en deadline beräknad från
`profile.timeline` (move date) + landets regler (data vi ändå har via
country specialist). T.ex. för Sverige: folkbokföring inom 7 dagar
efter ankomst, BankID inom 4 veckor efter folkbokföring, etc.

**Datalager:** Behöver en `task_rules`-tabell eller hardcoded JSON
per land med fält som `relative_to: "arrival" | "visa_grant" | "lease_start"`,
`days_offset`, `severity: critical | recommended`.

**UI-arbetet:** Befintlig checklist-sida visar redan tasks. Lägg till
deadline-badge per task ("⏰ 7 dagar kvar"), sortera efter urgency,
och visa "this week" / "next 30 days"-grupper.

### 2. Document vault

**Varför:** En konsult har dina handlingar — pass, jobberbjudande,
hyreskontrakt, vigselbevis, betyg. Idag laddar användaren upp
ingenting.

**Buildbart nu:** Supabase storage existerar redan. Behöver:

- En upload-yta per task ("ladda upp passkopia") **eller** en central
  document vault med kategorier
- Versionering (om man måste revidera)
- "What's missing"-vy som korsreferar mot vad task/visa kräver
- Format-validering (t.ex. PDF för vissa officiella, JPG för foto)

**Skala:** Backend ~1 dag (Supabase storage policies + upload-endpoint
+ list-endpoint). Frontend ~2 dagar (uppladdningskomponent + vault-vy
+ task-koppling).

### 3. Stegvis walkthrough per land + stad per task

**Varför:** "Registrera dig hos befolkningsmyndigheten" är inte
konsult-nivå. Konsulten säger: *"Gå till Skatteverket på Solna
strandväg, ta nummerlapp K, ha dessa 4 papper med dig, frågar de om
X säg Y."*

**Buildbart nu:** Country-specialist + cultural-specialist kan redan
generera detta innehåll. Idag spottar de ut text-blobs. Behov: en
strukturerad output-form `{ steps: [{title, body, link, location}], common_pitfalls: [...] }`
som UI kan rendera som en stepwise walkthrough med checkboxes per
steg.

**Skala:** Specialist-prompt ändring + nytt task-detail-view.

### 4. Bokningslänkar för faktiska appointments

**Varför:** Ambassad-möte, BankID-besök, läkartid, lägenhetsvisning.

**Buildbart nu utan partnership:** Vi *bokar inte* — men vi har en
direkt deep-link till bokningssidan + förklaring av vilken slot man
ska välja. Per land + task.

T.ex. för Spanien: "Boka NIE-tid hos Polisen via [direkt-länk till
sede.administracionespublica.gob.es], välj 'Asignación de NIE',
välj din region X, välj första lediga slot inom Y veckor från ditt
ankomstdatum."

**Skala:** Innehållsarbete — country-specialist måste producera URL +
slot-strategi per task, inte bara "boka ett möte".

### 5. Departure / repatriation-flöde

**Varför:** Helt obyggt idag. Konsult-rapporten är extremt tydlig att
detta är **standard core**: avregistreringar, deposit-retur, sluta
abonnemang, household goods retur, skatte-utresa.

**Buildbart nu:** Ren copy-paste-arkitektur av onboarding-wizarden vi
redan byggt — bara med andra fält och frågor. `/onboarding/departure`
i stil med `/onboarding`. Wizard som fångar:

- När åker du
- Vart åker du (samma land igen / nytt land)
- Säga upp lägenhet?
- Avregistrera myndigheter?
- Möbler med eller försälja?
- Husdjur med?

Sedan en parallell departure-checklist på dashboarden.

**Skala:** ~1-2 dagars arbete om onboarding-mönstret återanvänds.

---

## Tier 2 — Viktigt och buildbart NU

### 6. Family / dependents-grenen tillbaka

**Varför:** `consult.md` är väldigt tydlig att school search + partner
support är en separat tjänstekategori hos nästan alla bolag. För
"gemene man" = ofta familjefar/-mor som flyttar med partner + 1-2
barn → måste komma med innan vi är komplett.

**Buildbart nu:** Schema är 80% redo (partner_*-fält + children_*-
fält finns). Behöver:

- Ny `with_family`-fråga på destination-sidan (eller ett separat
  step 2.5)
- Dynamiskt visa partner_* / children_* som extra sektioner per
  step 3 där relevant
- School-search content per destination + ålder
- Partner-stöd-content (jobbsökstöd-länkar, communities)

**Skala:** ~1 vecka för full implementation, eller ~2 dagar för en
"thin slice" som åtminstone fångar familjedata och visar relevant
school/partner-content statiskt.

### 7. Banking + healthcare som aktiva flöden

**Varför:** Banking-helper-specialisten finns redan; healthcare-
navigatorn finns. Men de producerar text-blobs. För konsult-känsla
krävs konkret walkthrough.

**Buildbart nu utan partnership:** Vi behöver inte öppna konton åt
användaren via API. Vi pekar:

- "För Tyskland: öppna N26 online (5 min, helt digitalt) → fungerar
  med Anmeldebescheinigung från Bürgeramt → kontoutdrag krävs senare
  för work permit"
- "För svensk sjukvård: registrera dig på 1177.se efter du fått
  personnummer → här är formuläret för att flytta över din journal
  från [hemland]"

**Skala:** Innehållsarbete + ny dashboard-yta. Specialisterna ger
redan rätt typ av output, det är UI och strukturen som saknas.

### 8. Housing-stöd, även lättviktigt

**Varför:** Bostad är en av de största delarna enligt `consult.md`.
GoMate har cost-of-living-card men ingen yta som hanterar bostadssök
överhuvudtaget.

**Buildbart nu utan listings-API:** En housing-sida per destination
med:

- "De 3 största sajterna för hyresrätt i Berlin (Immowelt,
  ImmoScout24, WG-Gesucht)" med deep-links
- Typiska markhyror per stadsdel (cost-specialist har detta data
  redan, bara surfaca det)
- "Vad SCHUFA är och varför du behöver den först" (per-land guide)
- Realistic timing: "räkna med 4-6 veckor i Berlin innan du har
  kontrakt"
- En "scam warning"-blurb (förskottsbetalningar, fake ads, etc.)

**Skala:** Innehåll + ny housing-vy på dashboarden. Inga
integrationer. ~3-5 dagar.

### 9. Driver's license conversion

**Varför:** Underskattad men nästan alltid relevant. Schema har
`driver_license_origin` redan. Många länder har 6-månaders fönster
där hemkort gäller, sedan måste konvertera eller ta om.

**Buildbart nu:** Country-specifik content + walkthrough. Per land:
"Sverige: ditt EU-kort är giltigt om du flyttar permanent. Icke-EU
kort byts ut inom 12 månader på Transportstyrelsen, formulär TSTRK1018."

**Skala:** Innehållsarbete + ett task per användare där relevant.
~2-3 dagar.

### 10. Cultural / "Day 1"-orientering

**Varför:** Inte språkkurs, men en kort *"Detta är hur Sverige funkar
i vardagen"*: Swish, vintertider, jantelagen, hur man hyr förstahand,
hur man ringer 1177, vad pension/skatt-systemet egentligen är.

**Buildbart nu:** Cultural-specialist producerar redan denna typ av
output. Behöver bara en **dedikerad yta** på dashboarden — t.ex. en
"First weeks"-tab eller integrerat i Settling. Inte begravd i en
guide-PDF.

**Skala:** UI-arbete, ingen ny pipeline. ~2 dagar.

---

## Tier 3 — Buildbart med småinvestering i infrastruktur

Saker som inte kräver externa partnerships, men där pipelinen är lite
tyngre att sätta upp.

### 11. Push-notiser / email-påminnelser

**Varför:** "Visumansökan måste in om 14 dagar". Idag pingar systemet
aldrig användaren. Det här är vad som gör en konsult till en
*konsult* — proaktivitet.

**Vad behövs:** En email-leverantör (Postmark, Resend, SendGrid — alla
har gratis tier). Server-side cron som dagligen kollar tasks med
`due_at` < 14 dagar och inte är klara → skicka email med deeplink
till respektive task.

**PWA push-notifier:** Möjligt utan native app, men kräver service
worker + permission-flow. Email räcker för v1.

**Skala:** ~3-4 dagar inkl. email-template + cron + opt-in.

### 12. Real-time visa-/skatteregels-monitoring

**Varför:** En riktig konsult vet när Tyskland höjer Blue Card-
tröskeln, när Portugal stänger Golden Visa, när Sverige ändrar
sambo-reglerna.

**Vad behövs:** Officiell-källor-pipeline som kontinuerligt scrapar
specifika myndighetssidor (firecrawl finns redan). Diff-detektor +
flagga som triggar specialist re-run för berörda användare.

**Inte partnerships:** Detta är ren engineering. Men det är en stor
ongoing pipeline att underhålla.

**Skala:** ~1-2 veckors initial bygge + ongoing monitoring/curation.

### 13. Insurance walkthrough

**Varför:** Sjukvård, hemförsäkring, ansvarsförsäkring, internationell
hälsa — alltid relevant.

**Buildbart utan partnership:** Bara informationslager. "I Tyskland
krävs Krankenversicherung från dag 1 → här är publika alternativ
(TK, AOK) och privata (Allianz, AXA), här är skillnader, här är
tröskelvärden". Vi *köper inte* försäkringar åt användaren — vi
guidar.

**Skala:** Innehållsarbete per topp-10 destinationer + en insurance-
sektion på Settling-tab eller dedikerad sida. ~3-5 dagar.

### 14. Pet relocation-flöde

**Varför:** Schema har `pets`-fält men ingen yta använder det.

**Buildbart nu:** Om `pets ≠ none`:

- Generera vaccinationsschema (rabies-tider, mikrochip-krav per land)
- Pet passport-länkar (EU-länder)
- Flygbolag-policies (de stora carriers har det publikt)
- Karantän-regler per destination

**Skala:** Innehållsarbete + ny pet-checklist-sektion. ~2-3 dagar.

### 15. Tax overview för enkla fall

**Varför:** Double-taxation 101, var jag deklarerar år 1, "byt
skatteresidens"-checklist (inte räkna åt dig, bara peka på rätt
blanketter).

**Buildbart nu utan partnership:** Tax-specialist finns redan i
research-pipelinen. Det som saknas är en **dedikerad tax-walkthrough-
yta** på Money-tab som:

- Säger var man blir skatteresident year 1 baserat på purpose +
  duration
- Pekar på blankett i hemland (Skatteverket SKV 2300, IRS form 8854,
  HMRC P85, etc.) för utresa
- Pekar på destinations-blankett för anmälan
- Flaggar när dubbelbeskattningsavtal kan vara relevant

**INTE räkna ut skatt åt användaren.** Bara peka på rätt blanketter.

**Skala:** Innehållsarbete + ny tax-guide-vy. ~3-4 dagar.

---

## Tier 4 — Kräver externa partnerships / integrationer

Listas för att vi vet att de finns där, men de byggs inte i nuläget.

- **Faktisk bokning av embassy / myndighetsmöten via API** — kräver
  myndighetsintegration som ofta inte är öppen
- **Banking onboarding via API** — kräver partnership med Wise / N26 /
  Revolut / lokala banker
- **Insurance-marknadsplats med köp i appen** — kräver licens +
  försäkringsbolagspartnerships
- **Bostadsannonser i appen** — kräver listings API från Immowelt /
  Zillow / Hemnet motsvarigheter
- **Flytt-firma-bokning** — kräver partnership med internationella
  movers
- **Officiella myndighetsregistreringar via API** — sällsynt öppet,
  oftast manuell
- **Skattedeklaration i appen** — kräver licens + lokala revisor-
  partnerships

Allt på Tier 4 kan **ersättas med Tier 1-3-versioner** (deeplinks +
walkthroughs) i v1. Partnerships är något att tänka på efter
product-market-fit, inte före.

---

## Rekommenderad ordning

Om jag fick välja en sak att bygga härnäst som ger mest "pocket
consultant"-känsla för pengarna:

**1. Tid-medveten checklist med deadlines + walkthroughs per task
(Tier 1, items #1 + #3 ihop).**

För att med dagens product har ni allt informationsmaterial men
användaren får läsa själv och fatta vad som ska göras NÄR. Det enda
som skiljer dagens app från en wikipedia är planen, och planen är
statisk text.

Om varje task får:

- en faktisk deadline (`due_at: arrival_date + 7d` för folkbokföring)
- en stepwise walkthrough ("öppna skatteverket.se", "ta nummerlapp K",
  "lämna in form 7665")
- en länk eller bokningssida
- en checkbox "klart" som användaren kan markera
- en uppladdningsyta för relaterade dokument

…så har ni gjort 70% av språnget från "info-app" till "konsult-app".
Och den infrastruktur som behövs — checklist-sidan, guide-pipelinen,
dashboard-tabs — finns redan. Det är data + walkthrough-content +
upload-yta som fattas, inte ett nytt arkitektur-lager.

**2. Departure-flow (Tier 1 #5).**

Livscykeln är ofullständig utan det. Och det är ren copy-paste-
arkitektur av onboarding ni redan byggt — ~1-2 dagars jobb när
onboarding-mönstret är så solitt.

**3. Family / dependents tillbaka (Tier 2 #6).**

När ni känner att solo-flödet är stabilt och #1-2 skeppat. Schema är
i princip redo, det är UI + content som ska tillbaka.

**4. Document vault (Tier 1 #2).**

Kommer naturligt när checklist-walkthroughs efterfrågar uppladdningar.
Bygg det när första task som behöver det landar.

Allt däröver kan göras parallellt eller i den ordning som känns rätt
beroende på vad användarna ber om.
