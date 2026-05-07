# Verification Plan

Det här dokumentet används för att verifiera varje subphase innan vi går
vidare.

Regel:

- Ingen ny subphase räknas som klar bara för att implementationen
  "låter rätt".
- Varje subphase måste bevisas med riktiga tester.
- UI verifieras primärt med Playwright.
- Där UI inte räcker ska verifiering kompletteras med API- eller
  DB-kontroll.
- Om något fallerar ska det fixas innan nästa subphase.

För varje subphase ska Claude Code leverera:

1. vad som verifierades
2. hur det verifierades
3. resultat: `PASS` eller `FAIL`
4. vad som inte gick att verifiera
5. om något måste fixas innan nästa steg

## Generella verifieringsprinciper

### UI

Verifiera med Playwright:

- som en riktig användare i den riktiga appen
- att användaren faktiskt kan utföra flödet
- att state ändras i UI
- att state överlever reload där relevant
- att edge cases beter sig rimligt

Playwright-verifiering ska uttryckligen inkludera:

- screenshots före och efter viktiga actions
- screenshots av slutresultatet
- visuell granskning av badges, sortering, states, sektioner, CTA:er
- verifiering av det användaren faktiskt ser, inte bara DOM-existens

Minimikrav för varje frontend-verifiering:

- öppna riktig route
- utför verklig user action
- verifiera synligt resultat
- ta screenshot som stöd för bedömningen

Om Playwright-scriptet bara:

- hittar element
- klickar runt
- eller läser text utan att bedöma helheten

så räknas det inte som full frontend-verifiering.

### API

Verifiera via API när UI inte räcker:

- payload shape
- sortering
- calculated fields
- linkage
- signed URLs
- state transitions

### DB / Storage

Verifiera när det är viktigt att säkerställa persistence:

- migration applicerad
- kolumner används på riktigt
- RLS fungerar
- storage path och metadata stämmer

### Viktig princip

För dessa subphases är verifieringen i första hand **frontend-verifiering**.

Det betyder:

- Playwright + visuell kontroll är huvudbeviset
- API/DB/Storage används som kompletterande verifiering
- backend-kontroller ersätter inte en riktig användarverifiering i UI

Undantag:

- rena persistens- eller säkerhetsfrågor som inte går att bevisa fullt i UI
- t.ex. RLS, signed URLs, metadata-persistence, linkage-persistence

---

## Phase 1A — Deadline model + urgency

### Vad som ska bevisas

- `dueAt` räknas ut på riktigt
- `deadlineType`, `urgency` och `dueAt` är separerade
- urgency-buckets fungerar korrekt
- sortering sker via riktig logik, inte bara visuellt i frontend
- både settling-in och pre-departure använder modellen
- migrationen är applicerad och används
- UI visar badges som faktiskt matchar logiken

### Hur det ska verifieras

#### Playwright

- öppna `/checklist?tab=post-move`
- verifiera att tasks med högre urgency hamnar överst
- verifiera badge-texter:
  - `Overdue`
  - `Due today`
  - `Due tomorrow`
  - `Due in X days`
  - `Due this week`
- öppna `/checklist?tab=pre-move`
- verifiera samma beteende där

#### API

- kalla checklist/pre-departure-endpoints direkt
- kontrollera att payload innehåller:
  - `dueAt`
  - `deadlineType`
  - `urgency`
  - `daysUntilDeadline`
- kontrollera att sorteringsordningen i payload matchar UI

#### DB

- verifiera att migrationen är applicerad
- verifiera att `deadline_type` eller motsvarande kolumn faktiskt finns
- verifiera att data inte bara härleds transient om kolumnen ska vara persistent

### Extra saker att kontrollera

- att heuristisk klassning av `deadlineType` inte ger uppenbart fel
- att tasks utan bra datumkälla inte får nonsens-deadlines

---

## Phase 1B — Task detail view + walkthroughs

### Vad som ska bevisas

- task detail-vyn öppnas från riktiga tasks
- authored walkthroughs renderas i strukturerade sektioner
- fallback för tasks utan authored walkthrough är ärlig
- statusändring i sheet och listvy är synkad
- walkthrough-data persisteras där den förväntas persisteras

### Hur det ska verifieras

#### Playwright

- öppna en task från settling-in
- verifiera att sheet/modal/detail-vy öppnas
- verifiera sektioner:
  - What this is
  - Why it matters
  - Before you start
  - Steps
  - Common mistakes
  - What happens next
- öppna en task utan walkthrough
- verifiera att UI visar tydligt att walkthrough inte är authored
- ändra status i detail-vyn
- verifiera att listvyn uppdateras direkt

#### API / DB

- verifiera att walkthrough-data faktiskt finns i payload eller DB för tasks som ska ha det
- verifiera att tasks utan walkthrough inte får fake-content från backend

### Extra saker att kontrollera

- att detail-vyn känns snabb och inte renderar halvtrasiga sektioner
- att authored walkthroughs inte är ojämna eller uppenbart ofullständiga

---

## Phase 1C — Action links + booking guidance

### Vad som ska bevisas

- olika länktyper renderas olika
- primär CTA är rätt nästa klick
- official info / booking / form / portal skiljs åt tydligt
- appointment hints visas där de ska
- tasks utan action links beter sig rimligt
- modellen är generisk, inte Sverige-hårdkodad i UI-logiken

### Hur det ska verifieras

#### Playwright

- öppna task med booking-länk
- verifiera att `Take action`-sektion finns
- verifiera att primär CTA visas
- verifiera badge/ikon per link type
- verifiera att appointment hint syns
- klicka länkar och verifiera att ny flik öppnas
- öppna task med endast official links
- verifiera att ingen falsk booking-CTA visas
- öppna task utan länkar
- verifiera att `Take action` inte visas

#### API / Data

- verifiera att walkthrough-linkmodellen innehåller:
  - `url`
  - `label`
  - `linkType`
  - `description?`
  - `appointmentHint?`
  - `primary?`

### Extra saker att kontrollera

- att primärlänken verkligen känns som rätt nästa steg
- att officiell info och faktisk bokning aldrig förväxlas

---

## Phase 2A — Basic document vault

### Vad som ska bevisas

- riktig upload fungerar
- riktig persistence fungerar
- riktig download via signed URL fungerar
- riktig delete fungerar
- kategorisering fungerar
- ownership/RLS fungerar
- vaulten är en riktig produktyta

### Hur det ska verifieras

#### Playwright

- öppna `/vault`
- verifiera empty state
- ladda upp dokument
- verifiera att dokumentet syns i rätt kategori
- refresh
- verifiera att dokumentet finns kvar
- öppna/download
- verifiera att filen går att läsa
- delete
- verifiera att dokumentet försvinner

#### API

- kalla list-endpointen
- verifiera metadata:
  - id
  - category
  - file name
  - uploaded at
  - linked task keys

#### DB / Storage

- verifiera att metadata-raden skapas
- verifiera att storage path faktiskt finns
- verifiera att signed URL fungerar
- verifiera RLS mellan olika users om möjligt

### Extra saker att kontrollera

- att orphan-scenarier är tydligt förstådda
- att flera filer i samma kategori fungerar

---

## Phase 2B — Task/document linkage

### Vad som ska bevisas

- tasks deklarerar required document categories
- upload från task-vyn auto-länkar korrekt
- `link existing` fungerar
- `unlink` fungerar
- `missing` / `covered` härleds korrekt
- explicit länkning prioriteras över category-only match

### Hur det ska verifieras

#### Playwright

- öppna task med dokumentkrav
- verifiera required categories
- upload dokument från task-vyn
- verifiera att tasken uppdateras till covered
- ladda upp dokument i `/vault`
- gå tillbaka till task
- verifiera att `Link existing` visas
- länka dokument
- verifiera att covered uppdateras
- unlink
- verifiera att state faller tillbaka korrekt

#### API

- verifiera att dokumentets `linked_task_keys` uppdateras
- verifiera att GET `/vault` returnerar rätt linkage

#### DB

- verifiera att `linked_task_keys` persisteras korrekt
- verifiera att canonical task refs är stabila och rimliga

### Extra saker att kontrollera

- att category-match inte misstolkas som kvalitet
- att task keys är stabila över regeneration

---

## Phase 2C — Proof-of-eligibility coach + prep guidance

### Vad som ska bevisas

- proof goals renderas korrekt
- `Covered` / `Still uncertain` reagerar på verkliga dokument
- prep guidance renderas per kategori
- common mistakes fungerar
- disclaimers finns
- inga falska claims om approval/eligibility finns

### Hur det ska verifieras

#### Playwright

- öppna task med proof guidance
- verifiera sektioner:
  - What you're proving
  - How to prepare
  - Disclaimer
- upload/länka dokument
- verifiera att relevant proof-goal blir `Covered`
- verifiera att andra goals fortfarande kan vara `Still uncertain`
- expandera common mistakes
- verifiera att innehållet visas

#### API / Data

- verifiera att walkthrough/proofGuidance innehåller strukturerade goals
- verifiera att prep-guidance finns för de kategorier som visas

#### Textgranskning

- sök efter förbjudna ord/claims i UI där relevant:
  - `approved`
  - `verified`
  - `guaranteed`
  - `compliant`

### Extra saker att kontrollera

- att `Covered` inte kan misstolkas som myndighetsgodkännande
- att category-match inte skapar falsk trygghet

---

## Phase 3A — Readiness model

### Vad som ska bevisas

- readiness sektionen renderas på dashboarden
- fyra domäner finns:
  - visa
  - money
  - document
  - move
- levels ändras när state ändras
- reasons / blockers / nextStep matchar faktisk state
- top priority känns rimlig
- inga procentsiffror eller överclaims finns

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard`
- verifiera readiness-sektion
- verifiera fyra domänkort
- verifiera sortering lågnivå först
- ändra state:
  - ladda upp dokument
  - ändra savings
  - generera tasks
  - ändra citizenship/destination till free-movement-fall
- verifiera att rätt readiness-domän ändras

#### API

- kalla `/api/readiness`
- verifiera struktur:
  - domains
  - level
  - reasons
  - blockers
  - nextStep
  - topPriority

#### Logikgranskning

- kontrollera att stage-mappningar är riktiga
- kontrollera att money-readiness inte jämför äpplen och päron om valutor skiljer sig
- kontrollera att pathway/application-state faktiskt är populated där de används

### Extra saker att kontrollera

- inga `78% ready`-liknande mönster
- inga `approved`, `eligible`, `guaranteed`-claims
- top-priority-ordering måste kännas försvarbar

---

## Phase 3B — Risks + blockers + explanations

### Vad som ska bevisas

- systemet surfacar riktiga risker, inte bara readiness-nivåer
- risker är strukturerade och förklarade
- blockers skiljs från risks och från next steps
- riskerna drivs av faktisk state, inte generisk copy
- användaren kan förstå:
  - vad som är ett faktiskt problem nu
  - varför det är ett problem
  - vad konsekvensen är
- inga alternativa pathways eller plan-B-flöden har smugit in ännu

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard`
- verifiera att risk-/blocker-ytan syns där den ska
- verifiera att minst några olika scenarier ger olika riskbilder
- ändra state och verifiera att riskerna uppdateras:
  - sakna savings
  - sakna kritiska dokument
  - ha overdue tasks
  - ha visa_rejections / criminal_record / healthcare_needs där relevant
- verifiera att förklaringar och konsekvenser faktiskt ändras med state
- verifiera att UI:t inte bara återanvänder readiness-korten med annan titel

#### API

- kalla relevant readiness/risk-endpoint om sådan byggs
- verifiera att payload skiljer på:
  - risks
  - blockers
  - explanations / consequences
- verifiera att varje risk har tillräcklig struktur för att renderas stabilt

#### Logikgranskning

- kontrollera att samma input alltid ger samma risksvar
- kontrollera att riskerna är state-bundna, inte allmänt pathway-bundna
- kontrollera att verkliga blockers inte göms som "tips"
- kontrollera att 3B inte smugit in plan-B-logik från 3C
- kontrollera att `money`-blockers och `document`-blockers inte dubbelrapporterar samma underliggande problem
- kontrollera att `free movement` bara tar bort visa-specifika risker och inte gömmer andra relevanta blockers
- kontrollera att varje `blockedTaskRef` pekar på en verklig task och rätt checklist-tab
- kontrollera att savings-trösklar inte skapar uppenbart orimliga riskhopp runt gränsvärden
- kontrollera att `currency mismatch` inte triggas för aggressivt eller på nonsens-state
- kontrollera att `vault empty + arrival near` inte blir en överdriven default-varning i fel stage

### Extra saker att kontrollera

- att "risk" inte betyder "allt som saknas"
- att blockers är de saker som faktiskt stoppar framdrift
- att soft warnings inte presenteras som hard blockers
- att copy inte överdriver juridisk säkerhet
- att filter/sortering beter sig rätt i den faktiska UI:n, inte bara i API-payloaden

---

## Phase 3C — Plan B + denied/delayed handling

### Vad som ska bevisas

- systemet kan surfaca ett realistiskt `Plan B` när huvudspåret är svagt
- alternativa vägar skiljs tydligt från den primära vägen
- denied/delayed-scenarier ger konkret förändrad guidance
- användaren kan förstå:
  - vad som är primär väg
  - varför den är skör eller blockerad
  - vad nästa bästa alternativ är
  - vad som ändras i planen när något försenas eller faller bort
- alternatives är state-drivna, inte generiska fallback-texter

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard`
- verifiera att plan-B / alternatives-sektionen syns där den ska
- skapa scenarier där huvudspåret blir svagt:
  - saknad sponsor i work-flöde
  - saknad admission / finansiellt underlag i study-flöde
  - otillräcklig income i digital-nomad-flöde
- verifiera att alternativ eller fallback guidance då visas
- verifiera att scenarier för denied/delayed ger annan UI än normalläget
- verifiera att användaren inte ser både “allt ser bra ut” och “byt pathway” samtidigt

#### API

- kalla relevant alternatives / fallback-endpoint om sådan byggs
- verifiera att payload skiljer på:
  - primary pathway
  - alternative pathways
  - denied/delayed scenario guidance
  - change summary / what changes now

#### Logikgranskning

- kontrollera att alternatives bara visas när de verkligen är relevanta
- kontrollera att denied/delayed-grenar inte triggas i normalläge
- kontrollera att fallback guidance är bunden till faktisk profile/task/vault-state
- kontrollera att 3C inte glider in i enterprise/B2B eller generisk visa-encyklopedi
- kontrollera att `free movement` inte presenteras som ett "alternativ" när det i praktiken är den faktiska legala huvudvägen
- kontrollera att primary path inte samtidigt säger "fragile work permit" medan state egentligen borde göra visumspåret irrelevant
- kontrollera att alternatives inte visas i friskt normalläge bara för att det råkar finnas relaterade dokument i vaulten
- kontrollera att `whatChangesNow` faktiskt ändras per alternativ och inte återanvänder generisk text
- kontrollera att scenario-banner och primary-path-kort inte motsäger varandra

### Extra saker att kontrollera

- att `Plan B` inte bara är “läs mer om andra visum”
- att denied/delayed-guidance innehåller konkret förändring i nästa steg
- att alternativvägar inte presenteras som säkra när de bara är plausibla
- att UI:t tydligt skiljer mellan:
  - current path
  - alternative path
  - delayed/denied response
- att denied, delayed och stalled är ömsesidigt rimliga och inte visas samtidigt i motstridiga kombinationer
- att delayed-scenarier inte triggas för användare som inte ens behöver visum eller inte har någon verklig application status

---

## Phase 4A — First 72 hours / First 30 days

### Vad som ska bevisas

- systemet visar en riktig ankomstorienterad handlingsplan, inte bara återanvänd checklist-data
- `First 72 hours` och `First 30 days` skiljs tydligt åt
- innehållet är ordnat i rimlig sekvens
- planen påverkas av faktisk state:
  - destination
  - stage / arrival
  - tasks
  - profile
- användaren kan förstå vad som ska göras direkt efter ankomst kontra senare under första månaden

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` och/eller relevant checklist-/overview-yta
- verifiera att `First 72 hours` och `First 30 days` finns som två tydliga block eller motsvarande
- verifiera att innehållet inte bara är en kopia av vanliga checklistan
- verifiera att ordningen känns praktisk:
  - direktkritiska saker först
  - senare etableringssteg senare
- ändra state:
  - arrival saknas
  - arrival satt
  - några tasks completed
  - destination ändrad
- verifiera att playbooks ändras rimligt

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload skiljer på:
  - `first72Hours`
  - `first30Days`
- verifiera att varje item har tillräcklig struktur för stabil rendering

#### Logikgranskning

- kontrollera att `First 72 hours` inte innehåller saker som logiskt hör hemma veckor senare
- kontrollera att `First 30 days` inte duplicerar allt från `First 72 hours`
- kontrollera att state efter completion faktiskt påverkar vad som fortfarande visas som relevant
- kontrollera att 4A inte glider in i 4B/4C/4D med för mycket banking/insurance/cultural djup redan nu

### Extra saker att kontrollera

- att sektionen känns som ankomstplaybook, inte bara “top tasks”
- att copy och struktur är konkreta nog för att kännas konsultmässiga
- att användaren inte får både pre-arrival och post-arrival råd blandade i samma block

---

## Phase 4B — Banking + healthcare flows

### Vad som ska bevisas

- systemet ger riktiga aktiva banking- och healthcare-flöden, inte bara mer guide-text
- användaren får tydliga nästa steg för bankkonto och vårdregistrering
- flödena är state-drivna:
  - destination
  - arrival/stage
  - relaterade tasks
  - dokumentstatus där relevant
- banking och healthcare är separata men sammanhängande vardagsflöden
- UI:t hjälper användaren förstå:
  - vad som ska göras först
  - vad som krävs innan nästa steg
  - vad som blockerar framdrift

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` och relevant checklist/overview-yta
- verifiera att banking- och healthcare-flödena syns som egna aktiva sektioner eller motsvarande
- verifiera att användaren inte bara får blobtext utan:
  - steg
  - krav före start
  - tydlig next action
- ändra state:
  - bankrelaterade tasks completed / pending
  - healthcare-relaterade tasks completed / pending
  - arrival satt / inte satt
  - dokument uppladdade / saknade
- verifiera att guidance ändras rimligt

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload skiljer på:
  - banking flow
  - healthcare flow
- verifiera att varje flow-item har tillräcklig struktur för stabil rendering

#### Logikgranskning

- kontrollera att banking-flow inte antar att alla länder fungerar som Sverige
- kontrollera att healthcare-flow inte blandar ihop generell vårdinfo med första registreringssteg
- kontrollera att blockerande krav faktiskt visas före senare steg
- kontrollera att 4B inte glider in i 4C insurance eller 4D cultural deep-dive
- kontrollera att vault-coverage inte markerar steg som "completed" för lätt bara för att en kategori råkar finnas
- kontrollera att prerequisite-gating inte skapar omöjliga eller cirkulära stegkedjor
- kontrollera att `passport + permit + proof`-steget inte blir fel för free-movement-användare eller andra som inte behöver permit
- kontrollera att healthcare-steget inte antar "health card" eller motsvarande i länder där första vårdsteget ser annorlunda ut
- kontrollera att manual-only-steg inte blockerar flow-rollup på ett orimligt sätt

### Extra saker att kontrollera

- att banking-flow inte bara säger “öppna bankkonto” utan guidar användaren till första rimliga väg
- att healthcare-flow inte bara säger “registrera vård” utan förklarar vad som ska göras först
- att tasks, walkthroughs och action links kopplas in där de finns
- att UI:t känns som ett aktivt setup-flöde, inte en artikel
- att "Current step" verkligen flyttar fram när föregående steg blir completed
- att conditional healthcare-steg dyker upp och försvinner korrekt när profilfält ändras

---

## Phase 4C — Driver's license + insurance

### Vad som ska bevisas

- systemet ger riktiga aktiva guidance-flöden för körkort och försäkring, inte bara nya info-kort
- driver's-license-guidance är state-driven och skiljer på:
  - redan giltigt
  - behöver exchange/convert
  - inte relevant
- insurance-guidance hjälper användaren förstå vad som behövs först, inte bara listar försäkringstyper
- körkort och försäkring hålls separata från 4B banking/healthcare och 4D cultural

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` och relevant overview-yta
- verifiera att driver's license och insurance syns som egna guidance-block eller motsvarande
- ändra state:
  - driver_license_origin ja/nej
  - destination / citizenship kombinationer
  - arrival/stage
  - insurance-relevanta profilfält om sådana används
- verifiera att guidance ändras rimligt
- verifiera att användaren får tydlig next action där relevant

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload skiljer på:
  - driver’s license guidance
  - insurance guidance
- verifiera att varje del har tillräcklig struktur för stabil rendering

#### Logikgranskning

- kontrollera att körkortsguidance inte antar samma regler för alla länder
- kontrollera att free-movement/förarlicens-regler inte förenklas på ett felaktigt sätt
- kontrollera att insurance-guidance inte glider in i full marketplace-/comparison-logik
- kontrollera att 4C inte börjar göra 4D:s kulturella jobb
- kontrollera att `driver_license_origin = no` verkligen leder till `not_required` och inte lämnar kvar någon task-länk eller action-copy
- kontrollera att `transit-license task completed` inte maskerar andra fall där användaren fortfarande borde få guidance
- kontrollera att `likely_carries_over` inte används för aggressivt i free-movement-fall där lokal notification/exchange ändå kan krävas
- kontrollera att insurance-top-priority verkligen är första relevanta item och inte bara första i listan
- kontrollera att `travel/bridge health insurance` försvinner eller nedprioriteras när health-card/coverage faktiskt är på plats
- kontrollera att `home / contents` inte blir default-råd för användare där housing-state egentligen gör det irrelevant eller oklart

### Extra saker att kontrollera

- att körkortssektionen faktiskt hjälper användaren förstå om de behöver agera eller inte
- att insurance-delen prioriterar vad som behövs först, inte bara vad som existerar
- att tasks, walkthroughs och action links återanvänds där det är relevant
- att UI:t känns som ett setup-stöd, inte en artikel
- att `not_required`-items inte visuellt konkurrerar med `act now`-items
- att inga konkreta leverantörer/produkter smugit in på ett sätt som börjar likna marketplace

---

## Phase 4D — Cultural orientation layer

### Vad som ska bevisas

- systemet ger en riktig cultural/day-1-orientation-yta, inte bara en artikel eller FAQ
- guidance är praktisk och operativ:
  - hur systemet funkar
  - vilka vardagsappar eller verktyg som är relevanta
  - adress- och boendelogik
  - vårdsystemets vardagslogik
  - hyrmarknadens kultur eller motsvarande vardagsnormer
- innehållet känns efter-landning-relevant och inte som generisk destination-content
- ytan hålls tydligt skild från 4A/4B/4C:
  - inte bara arrival-checklista
  - inte banking/healthcare-flow
  - inte insurance/körkortsguidance

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` och relevant overview-yta
- verifiera att cultural orientation syns som en egen sektion eller motsvarande
- verifiera att användaren får:
  - tydliga ämnesblock eller cards
  - konkret day-1/day-to-day guidance
  - synliga nästa steg eller praktiska takeaways där det är relevant
- ändra state:
  - destination
  - arrival/stage
  - housing-status eller liknande om sådant används
  - family/children/pets där relevant
- verifiera att innehållet ändras rimligt när state ändras
- verifiera visuellt att sektionen inte bara är en lång textblob

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload är strukturerad nog för stabil rendering
- verifiera att modellen skiljer mellan olika orientation-ämnen i stället för att bara ge fri text

#### Logikgranskning

- kontrollera att cultural-layern inte bara återanvänder checklist/tasks med ny rubrik
- kontrollera att den inte degenererar till landsguide/encyklopedi utan praktisk användning
- kontrollera att rekommendationer om appar/tjänster inte blir hårdkodade på ett sätt som känns reklamlikt eller för svenskt
- kontrollera att healthcare-relaterad cultural guidance inte duplicerar 4B:s operativa flow
- kontrollera att housing-culture guidance inte börjar göra 5A:s jobb
- kontrollera att day-1-guidance faktiskt känns relevant direkt efter ankomst och inte lika gärna hade kunnat ligga pre-arrival
- kontrollera att innehållet inte blir för generellt när destination eller stage saknas

### Extra saker att kontrollera

- att sektionen faktiskt hjälper användaren förstå hur vardagen fungerar i nya landet
- att guidance känns praktisk snarare än “content richness”
- att UI:t är lätt att skanna och inte bara en artikelvy
- att olika ämnesblock känns distinkta och inte upprepar samma budskap
- att det finns tydliga takeaways även när det inte finns en direkt task-länk

---

## Phase 5A — Housing support

### Vad som ska bevisas

- systemet ger en riktig housing-support-yta, inte bara housing-culture-copy från 4D
- guidance hjälper användaren förstå:
  - var man realistiskt bör leta
  - ungefärliga hyresnivåer eller budgetförväntningar
  - scam-varningar
  - hur processen brukar gå till
  - timing expectations
- housing-support känns praktisk och beslutsstödjande, inte som en listningsmarknadsplats
- housing-support hålls skild från:
  - 4D cultural orientation
  - generisk checklist-copy
  - extern partner-/affiliate-logik

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` eller den housing-yta som byggs
- verifiera att housing support syns som en egen sektion eller motsvarande
- verifiera att användaren får tydliga block för minst:
  - where to search
  - price/timing expectations
  - scam/risk warnings
  - process guidance
- ändra state:
  - destination
  - arrival/stage
  - budget om sådant används
  - family/housing-relaterade profilfält om sådana används
- verifiera uttryckligen både känd destination och okänd destination/fallback
- verifiera att innehållet ändras rimligt när state ändras
- verifiera visuellt att detta inte bara är en artikel eller en tasklista

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload är strukturerad nog för stabil rendering
- verifiera att modellen skiljer på housing-dimensioner i stället för att bara ge ett långt textblock
- verifiera budget-/price-fälten särskilt om parser eller valutaheuristik används

#### Logikgranskning

- kontrollera att sektionen inte blir en fake marketplace med leverantörer/listings som ser klickbara ut men inte är en riktig housingmotor
- kontrollera att “bästa sajterna per stad/land” inte presenteras reklamlikt eller med för mycket falsk precision
- kontrollera att price guidance inte ser mer exakt ut än datan tillåter
- kontrollera att budget-parsern beter sig rimligt för vanliga format som `2500`, `2500 EUR`, `€2500`
- kontrollera att okända destinationer faller tillbaka till generisk men fortfarande användbar guidance
- kontrollera att scam-varningar känns konkreta och användbara, inte generiska
- kontrollera att timing expectations faktiskt hjälper användaren förstå när de ska börja leta eller signera
- kontrollera att timing-boundaries beter sig rimligt nära trösklarna, t.ex. runt 2/4/8/10/12 veckor före ankomst
- kontrollera att housing-support inte bara återberättar 4D housing-culture med ny rubrik
- kontrollera att den inte glider in i full 5B/5C eller andra sidospår

### Extra saker att kontrollera

- att sektionen faktiskt hjälper användaren ta bättre housing-beslut
- att search/process/scam/timing känns som separata värdefulla delar
- att UI:t är lätt att skanna och inte en lång article wall
- att det finns tydliga takeaways även utan listings-API
- att inga partner-/affiliate-mönster smugit in
- att eventuella exempel på sajter/källor inte renderas som pseudo-listings eller köpbara rekommendationer

---

## Phase 5B — Departure / repatriation flow

### Vad som ska bevisas

- systemet ger en riktig departure/repatriation-yta, inte bara en omvänd inflyttningschecklista
- guidance hjälper användaren förstå:
  - när de åker
  - vad som måste sägas upp
  - vad som måste avregistreras
  - vad som ska tas med / säljas / lagras
- departure-flödet känns livscykel-specifikt och state-driven, inte som generisk task-copy
- departure-support hålls skild från:
  - Phase 4 arrival guidance
  - housing support
  - pet relocation

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` eller den departure-yta som byggs
- verifiera att departure/repatriation syns som en egen sektion eller motsvarande
- verifiera att användaren får tydliga block för minst:
  - timing / departure date
  - cancel / terminate
  - deregister / notify authorities
  - keep / sell / store / move belongings
- ändra state:
  - departure date eller motsvarande
  - stage / relocation status
  - housing / employment / utility-relaterade profilfält om sådana används
  - om användaren har familj / fordon / lagrade saker om sådant används
- verifiera uttryckligen hur UI:t beter sig när exakt departure-datum saknas och appen använder surrogate-datum
- verifiera att innehållet ändras rimligt när state ändras
- verifiera visuellt att detta inte bara är en artikel eller en vanlig tasklista

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload är strukturerad nog för stabil rendering
- verifiera att modellen skiljer på uppsägning, avregistrering och belongings/logistics i stället för att bara ge en lång text
- verifiera särskilt hur timing-fälten härleds om `arrival_date` eller annat proxy-fält används som departure-signal

#### Logikgranskning

- kontrollera att departure-flödet inte bara återanvänder onboarding- eller arrival-content med nya rubriker
- kontrollera att “cancel” och “deregister” hålls isär så att användaren inte blandar privata uppsägningar med myndighetssteg
- kontrollera att notification-/forwarding-steg inte presenteras som om de vore riktiga deregistreringar
- kontrollera att timing-guidance faktiskt hjälper användaren förstå vad som måste göras tidigt vs sent
- kontrollera att milestone-gränserna beter sig rimligt runt t.ex. T-8, T-4, T-2, T-1, T-0
- kontrollera att användning av `arrival_date` som departure-proxy inte skapar uppenbart fel guidance i vanliga fall
- kontrollera att housing-relaterade departure-råd inte börjar göra 5A:s jobb
- kontrollera att pet-relaterade departure-råd inte börjar göra 5C:s jobb
- kontrollera att modellen inte antar att alla användare har samma avregistreringskrav
- kontrollera att sektionen inte ger falsk säkerhet kring “allt är stängt” bara för att några tasks är klara

### Extra saker att kontrollera

- att sektionen faktiskt hjälper användaren lämna landet/orten mer ordnat
- att cancel / deregister / belongings känns som separata värdefulla delar
- att UI:t är lätt att skanna och inte en article wall
- att det finns tydliga takeaways även när användaren ännu inte satt ett exakt departure-datum
- att inga partner-/marketplace-mönster smugit in här heller
- att v1-låset till `leaving_origin` inte gör copy eller rubriker missvisande för användare som egentligen tänker repatriation

---

## Phase 5C — Pet relocation

### Vad som ska bevisas

- systemet ger en riktig pet-relocation-yta när `pets != none`, inte bara några extra taskrader
- guidance hjälper användaren förstå:
  - mikrochip
  - vaccinationer
  - importregler
  - tidslinje
  - flyg-/transportkrav
- pet-support känns tydligt pet-specifik och state-driven, inte som generisk travel advice
- sektionen hålls skild från:
  - 4A/4D allmän arrival/orientation
  - 5B belongings/departure
  - tidigare enstaka pet-tasks

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` eller den pet-yta som byggs
- verifiera att pet relocation syns som egen sektion eller motsvarande när `pets != none`
- verifiera att sektionen inte visas, eller visar ett rimligt tomt state, när `pets == none`
- verifiera att användaren får tydliga block för minst:
  - microchip
  - vaccinations / health prep
  - import / entry rules
  - travel timing / airline constraints
- ändra state:
  - pets none / cat / dog / flera djur om stödet finns
  - destination
  - arrival/timeline
  - pet-relaterade dokument eller tasks om sådana används
- verifiera uttryckligen både känd destinationsprofil och okänd/generisk fallback
- verifiera att innehållet ändras rimligt när state ändras
- verifiera visuellt att detta inte bara är en artikel eller en tasklista

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload är strukturerad nog för stabil rendering
- verifiera att modellen skiljer på olika delar av pet relocation i stället för att bara ge fri text
- verifiera särskilt hur destinationsprofil och timeline-faser härleds om substring-match eller andra heuristiker används

#### Logikgranskning

- kontrollera att sektionen inte bara återanvänder redan byggda pet-task-texter med ny rubrik
- kontrollera att timeline/tidslinje faktiskt hjälper användaren förstå ordningen mellan microchip, vaccination och resa
- kontrollera att ordningsregeln “microchip före rabies” visas tydligt och inte bara finns i data
- kontrollera att importregler inte uttrycks med falsk precision när destination-data är tunn eller generell
- kontrollera att destinationsprofil-matchning inte blir fel för vanliga namnvarianter eller sammansatta destinationsnamn
- kontrollera att airline/travel guidance inte låter som bokningsintegration eller partnerlogik
- kontrollera att vikt-/storleksheuristik för cabin vs cargo inte ger uppenbart fel output för gränsfall eller fria textformat
- kontrollera att snub-nosed-detektion inte ger trasig copy när rasfält är tomt, generiskt eller blandras
- kontrollera att sektionen inte glider in i bred departure-logistics eller generic pet-care content
- kontrollera att destination-fallback för okända länder fortfarande känns användbar och ärlig
- kontrollera att flera djur eller olika pet-typer inte ger uppenbart trasig copy om sådant state stöds

### Extra saker att kontrollera

- att sektionen faktiskt hjälper användaren förstå vad som måste ske först för djuret
- att microchip / vaccination / import / travel känns som separata värdefulla delar
- att UI:t är lätt att skanna och inte en article wall
- att det finns tydliga takeaways även när landet inte har djup destination-specifik coverage
- att inga marketplace-/partner-mönster smugit in för carriers, vets eller pet movers
- att one-pet-at-a-time-begränsningen inte döljs om användaren i praktiken har flera djur

---

## Phase 6A — Notifications

### Vad som ska bevisas

- systemet skickar eller förbereder riktiga proaktiva notifications, inte bara visar fler badges i UI
- notifications hjälper användaren med verklig timing:
  - deadlines
  - urgency
  - missing documents
  - risks/blockers när det är rimligt
- första versionen håller sig till enkel och pålitlig kanal, typ email först, i linje med planen
- notifications känns kopplade till faktisk state, inte generiska blast-meddelanden

### Hur det ska verifieras

#### Playwright

- öppna relevanta settings-/preferences-ytor om användaren kan slå av/på notifications
- verifiera att användaren tydligt kan förstå notification-status eller senaste reminder där det visas i UI
- ändra state så att en notification borde triggas:
  - task blir overdue
  - deadline närmar sig
  - viktigt dokument saknas
  - risk/blocker blir aktiv om det ingår i scope
- verifiera att UI inte bara uppdaterar lokalt utan att notification-systemet faktiskt registrerar eller skickar något

#### API

- kalla relevanta endpoints eller jobb om sådana byggs
- verifiera att payload eller jobbdata innehåller:
  - mottagare
  - notification type
  - trigger reason
  - länk eller referens till relevant arbetsyta om det ingår
- verifiera att samma state inte skapar duplicerade notifications på ett orimligt sätt

#### DB / Delivery

- verifiera persistence om notifications köas eller loggas i DB
- verifiera att preferences respekteras om sådana finns
- verifiera att email-kanalen verkligen används om det är v1-kanalen
- verifiera att ingen notification skickas till fel användare

#### Logikgranskning

- kontrollera att notifications inte bara återberättar dashboarden utan tillför verklig proaktivitet
- kontrollera att triggers är försvarbara och inte för spammy
- kontrollera att deadline-reminders använder riktig deadline/urgency-logik från tidigare faser
- kontrollera att doc-/risk-notifications inte utlovar mer säkerhet än systemet faktiskt har
- kontrollera att notifications länkar till rätt arbetsyta: visa, pre-move, post-move, documents eller guidance
- kontrollera att systemet inte antar family/dependents-logik nu när v1 är single applicant

### Extra saker att kontrollera

- att notifications faktiskt känns värdefulla och handlingsinriktade
- att användaren förstår varför meddelandet kom just nu
- att frekvensen känns rimlig och inte bullrig
- att copy inte blir generisk eller alarmistisk
- att v1 håller sig till enkel kanal och inte halvbygger push om det inte stöds ordentligt

---

## Phase 6C — Tax overview

### Vad som ska bevisas

- systemet ger en riktig year-1-tax-overview-yta, inte en full tax engine och inte bara allmän tax-copy
- guidance hjälper användaren förstå minst:
  - vad som sannolikt händer första skatteåret
  - vilka skatterelaterade steg eller kontroller som är relevanta
  - vad som kan bli lätt att missa
  - vad nästa rimliga steg är
- tax overview känns rådgivande och översiktlig, inte juridiskt definitiv
- sektionen hålls skild från:
  - readiness/risk
  - departure tax details
  - full tax filing engine

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` eller den tax-yta som byggs
- verifiera att tax overview syns som en egen sektion eller motsvarande
- verifiera att användaren får tydliga block för minst:
  - year-1 overview
  - likely obligations / checkpoints
  - common pitfalls / what to watch
  - next step
- ändra state:
  - destination
  - arrival date / stage
  - employment / self-employed / purpose där sådant används
  - tax-residency-relaterade profilfält om sådana används
- verifiera att innehållet ändras rimligt när state ändras
- verifiera visuellt att detta inte bara är en artikel eller en fejkad kalkylator

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload är strukturerad nog för stabil rendering
- verifiera att modellen skiljer på overview, watchouts och next steps i stället för att bara ge fri text

#### Logikgranskning

- kontrollera att sektionen inte framstår som ett fullständigt skatteråd eller bindande beslut
- kontrollera att year-1-overview inte glider in i full deklarationsmotor eller beräkningsmotor
- kontrollera att destination- eller purpose-variation faktiskt påverkar guidance där det är rimligt
- kontrollera att timing kring första skatteåret känns begriplig och inte godtycklig
- kontrollera att sektionen inte bara återanvänder befintlig tax-residency-task-copy med ny rubrik
- kontrollera att departure-tax eller cross-border edge cases inte presenteras som lösta om de inte verkligen modelleras
- kontrollera att single-applicant-scope hålls och att family/dependents inte smugit in

### Extra saker att kontrollera

- att sektionen faktiskt hjälper användaren förstå “vad händer skattemässigt första året?”
- att copy är försiktig och rådgivande, inte juridiskt tvärsäker
- att UI:t är lätt att skanna och inte en article wall
- att det finns tydliga takeaways även när destinationens tax coverage är begränsad
- att inga pseudo-exakta skattebelopp eller uträkningar visas om systemet inte verkligen kan stå för dem

---

## Phase 6D — Rule-change monitoring

### Vad som ska bevisas

- systemet kan upptäcka eller representera riktiga regeländringar, inte bara visa en nyhetsfeed
- regeländringar kopplas till:
  - berörda användare eller planer
  - relevant domän eller pathway
  - tydlig påverkan
  - nästa steg eller omresearch-behov
- sektionen känns som ett konsultmässigt “detta har ändrats och påverkar dig”, inte som allmän omvärldsbevakning
- v1 håller sig försiktigt till monitorering/diff/flaggning, inte full policy engine

### Hur det ska verifieras

#### Playwright

- öppna `/dashboard` eller den rule-change-yta som byggs
- verifiera att användaren tydligt kan se:
  - att en regeländring finns
  - varför den är relevant
  - vad som påverkas
  - vad nästa steg är
- ändra state eller injicera testdata så att:
  - en irrelevant regeländring inte visas för användaren
  - en relevant regeländring visas tydligt
  - olika severities eller impact-nivåer beter sig rimligt om sådana finns
- verifiera visuellt att detta inte bara är en content feed eller changelog

#### API

- kalla relevant endpoint om sådan byggs
- verifiera att payload är strukturerad nog för stabil rendering
- verifiera att modellen skiljer på:
  - själva ändringen
  - impacted scope / affected users
  - recommended action / omresearch trigger
- verifiera att diff- eller changed-since-logiken är begriplig om sådan används

#### DB / Monitoring

- verifiera persistence om regeländringar eller user-impact lagras
- verifiera att samma ändring inte dupliceras orimligt många gånger
- verifiera att impacted-plan/user-koppling sparas eller går att härleda om det ingår i modellen

#### Logikgranskning

- kontrollera att systemet inte presenterar generella regeländringar som personligt relevanta utan faktisk koppling
- kontrollera att “affected users” eller motsvarande inte blir för grovt eller slumpmässigt
- kontrollera att omresearch-trigger bara används när det faktiskt finns skäl
- kontrollera att copy inte låter mer säker än källunderlaget tillåter
- kontrollera att detta inte glider in i full legal/policy advisory engine
- kontrollera att notifications och rule-change-monitoring hålls isär: 6D är källförändring + impact, inte bara reminder
- kontrollera att single-applicant-scope hålls och att family/dependents inte smugit in

### Extra saker att kontrollera

- att sektionen faktiskt hjälper användaren förstå “något har ändrats som påverkar min plan”
- att relevansfiltreringen känns trovärdig
- att UI:t är lätt att skanna och inte en article wall
- att rekommenderad nästa handling känns tydlig och proportionerlig
- att v1 inte låtsas vara real-time bevakning om det bara är manuell/testad ingest eller simulerad data

---

---

## Resultatmall

För varje subphase ska Claude Code rapportera:

### Subphase

`Phase XA`

### Verifierat

- punkt för punkt

### Metod

- Playwright
- API
- DB / Storage

### Resultat

- `PASS`
- eller `FAIL`

### Kvarvarande gap

- vad som inte kunde verifieras
- vad som måste fixas innan nästa steg
