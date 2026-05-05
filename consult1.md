# GoMate Pocket Consultant — Execution Plan

Det här dokumentet sammanfattar vad som fattas för att GoMate ska gå
från "info-app + dashboard" till en faktisk pocket consultant för
gemene man (B2C, individer som flyttar utomlands).

Källan är `consult.md` (vad riktiga relocationkonsulter faktiskt gör)
korsläst med GoMates nuvarande tillstånd.

Scope:

- B2C only
- Ingen utstationering, B2B, enterprise mobility, payroll,
  benchmarking eller policy consulting
- Fokus på vad vi kan bygga utan myndighetsintegrationer eller
  partnerships

## Vad "pocket consultant" betyder

En riktig relocationkonsult gör fyra saker en vanlig app sällan gör:

1. **Koordinerar handling** — säger vad du ska göra nu, i vilken
   ordning, och varför
2. **Är tid-medveten** — vet vilka deadlines som gäller och när något
   måste ske
3. **Hanterar dokumentationen** — vet vilka papper som behövs och hur
   de ska förberedas
4. **Utövar omdöme** — säger vad som är realistiskt, vad som är risk,
   vad som blockerar, och vad plan B är

GoMate idag är en stark informationsmaskin. För att bli konsult måste
produkten få fler motorer, inte bara mer content.

## Vad GoMate har idag

- Onboarding-wizard ✓
- Purpose-grenar ✓
- Visa-rekommendationer ✓
- Cost-of-living + budget-card ✓
- Checklist-sida ✓
- AI-chat ✓
- Dashboard-tabs ✓

Detta är ett bra fundament, men det känns ännu mer som "översikt +
guides" än "personlig konsult".

---

## Varför vi inte ska bygga en punkt i taget

Vi ska inte köra:

- en hel tier åt gången
- eller en ensam feature åt gången

Det som makes mest sense är att bygga i **faser/bundles** där flera
delar delar samma underliggande motor.

Annars får vi:

- massa UI utan verklig konsultlogik
- eller infrastruktur utan tydligt användarvärde

Så nedan är planen omstrukturerad till 6 faser.

---

## Phase 1 — Action Core

Det här är första riktiga språnget från info-app till konsult.

### 1.1 Deadline engine

**Varför:** En konsult säger "du har 7 dagar kvar". Inte bara "gör
detta någon gång".

**Buildbart nu:** Deadline-regler per task utifrån:

- move date
- arrival date
- lease start
- visa issue date

Varje task får:

- `due_at`
- deadline-typ: legal / practical / recommended
- urgency

### 1.2 Task walkthroughs

**Varför:** "Registrera dig hos myndigheten" räcker inte. Konsulten
översätter krav till steg.

**Buildbart nu:** Varje task får strukturerad output:

- vad detta är
- varför det spelar roll
- vad du behöver innan du börjar
- steg-för-steg
- vanliga misstag
- vad som händer efteråt

### 1.3 Booking links

**Varför:** Många tasks kräver ett faktiskt nästa klick.

**Buildbart nu utan integrationer:** Vi bokar inget åt användaren, men
vi länkar direkt till rätt bokningssida och förklarar vilken appointment
de ska välja.

### Varför dessa tre hör ihop

Alla tre bygger på samma kärna:

- task
- deadline
- officiell länk
- handlingsinstruktion

Det är därför de ska byggas tillsammans.

---

## Phase 2 — Evidence Core

Det här är dokument- och bevislagret.

### 2.1 Document vault

**Varför:** Konsultrollen kräver att systemet vet vilka dokument
användaren faktiskt har.

**Buildbart nu:** Central document vault eller upload-yta per task,
med:

- kategorier
- listning
- koppling till tasks
- grundläggande versionshantering

### 2.2 Proof-of-eligibility coach

**Varför:** Privatpersoner fastnar ofta inte på att visumet finns, utan
på att de inte vet hur de bevisar att de kvalar in.

**Buildbart nu:** Visa tydligt:

- vad myndigheten vill se
- vilken typ av underlag som normalt accepteras
- vad som saknas
- vad som är svagt

### 2.3 Document preparation guidance

**Varför:** Vault utan prep-guidance är bara filförvaring.

**Buildbart nu:** Varje dokumenttyp får prep-regler:

- original eller kopia
- översättning krävs eller ej
- notarization / apostille / certifiering
- giltighetstid
- vanliga misstag

### Varför dessa tre hör ihop

- vault utan prep-guide blir tunn
- proof-coach utan dokumentkoppling blir bara text
- prep-guidance utan vault saknar arbetsyta

---

## Phase 3 — Judgment Core

Det här är det som gör produkten konsultmässig i stället för bara
checklistig.

### 3.1 Readiness engine

**Varför:** En konsult säger inte bara "här är dina steg", utan också
"du är inte redo än".

**Buildbart nu:** Minst fyra readiness-lager:

- visa readiness
- money readiness
- document readiness
- move readiness

Varje readiness måste vara förklarbar med blockers och risks.

### 3.2 Plan B / alternative paths

**Varför:** Om huvudspåret är svagt måste systemet kunna säga vad nästa
bästa väg är.

**Buildbart nu:** Surfaca:

- alternativ visa-väg
- alternativ purpose
- alternativ destination

När primär väg ser svag ut.

### 3.3 Denied / delayed handling

**Varför:** Verkligheten går inte linjärt. Visum drar ut på tiden,
hyresvärdar backar ur, antagningar blir sena.

**Buildbart nu:** Modellera states som:

- visa delayed
- visa denied
- admission delayed
- sponsorship fell through
- move date changed

Och berätta vad som ändras i planen.

### Varför dessa tre hör ihop

- readiness utan plan B blir bara en score
- plan B utan denied/delayed blir för teoretiskt
- denied/delayed kräver ett omdömeslager

---

## Phase 4 — Arrival Core

Det här gör att GoMate hjälper efter landning, inte bara innan.

### 4.1 First 72 hours / First 30 days

**Varför:** Det här är peak pocket-consultant för B2C.

**Buildbart nu:** Två playbooks:

- First 72 hours
- First 30 days

I rätt ordning, inte bara som lista.

### 4.2 Banking + healthcare flows

**Varför:** Banking-helper och healthcare-support måste bli aktiva
flöden, inte bara text.

**Buildbart nu:** Walkthroughs för:

- vilket konto som är rimligast först
- vad som krävs för att öppna konto
- hur vårdregistrering går till
- vilka första vård-/försäkringssteg som är viktigast

### 4.3 Driver’s license conversion

**Varför:** Väldigt ofta relevant och ofta missat.

**Buildbart nu:** Landsspecifik guidance om:

- om befintligt körkort gäller
- när det måste bytas
- hur konvertering går till

### 4.4 Cultural / Day 1 orientation

**Varför:** Inte fluff, utan praktisk vardagsförståelse.

**Buildbart nu:** En dedikerad yta för:

- hur systemet funkar i landet
- vardagsappar
- adresslogik
- vårdsystem
- hyrmarknadens kultur

### 4.5 Insurance walkthrough

**Varför:** Försäkring är nästan alltid relevant men ofta diffus.

**Buildbart nu:** Förklara:

- vad som är lagkrav
- vad som är stark rekommendation
- vilka kategorier som finns
- vad användaren sannolikt behöver först

### Varför dessa fem hör ihop

Allt här handlar om:

- "jag är här nu"
- "hur blir jag operativ snabbt"

Det är samma kontext och därför samma fas.

---

## Phase 5 — Lifecycle Extensions

Det här är stora, viktiga ytor som är starka men lite mer fristående
från kärnmotorn.

### 5.1 Housing support

**Varför:** En av de största verkliga relocationkategorierna.

**Buildbart nu utan listings-API:**

- bästa sajterna per stad/land
- realistiska hyrnivåer
- scam-varningar
- processförklaring
- timing expectation

### 5.2 Departure / repatriation flow

**Varför:** Livscykeln är inte komplett utan utflytt.

**Buildbart nu:** Återanvänd onboarding-arkitekturen för:

- när du åker
- vad som måste sägas upp
- vad som måste avregistreras
- vad som ska tas med / säljas / lagras

### 5.3 Pet relocation

**Varför:** Viktigt för en tydlig undergrupp användare och redan delvis
förberett i schemat.

**Buildbart nu:** Om `pets != none`, surfaca:

- mikrochip
- vaccinationer
- importregler
- tidslinje
- flygrelaterade krav

### Varför dessa tre hör ihop

Det här är tre stora livscykelvertikaler:

- bo
- lämna
- flytta saker / djur

De är viktiga, men kan komma efter kärnan.

---

## Phase 6 — Scale-Up

Det här byggs när solo-kärnan känns stabil.

### 6.1 Family / dependents

**Varför:** Enormt viktigt i verkligheten, men ökar komplexiteten
rejält.

**Buildbart nu-ish:** Schemat är redan långt framme. Behöver UI,
school-content, partner-stöd och mer grenlogik.

### 6.2 Notifications

**Varför:** En riktig konsult är proaktiv.

**Buildbart nu:** Email först, push senare.

### 6.3 Rule-change monitoring

**Varför:** Regler ändras. En konsultprodukt måste kunna reagera.

**Buildbart senare:** Monitorera officiella källor, diffa ändringar,
flagga drabbade användare och trigga omresearch.

### 6.4 Tax overview

**Varför:** Viktigt, men inte det första som skapar pocket-consultant-
känsla för de flesta B2C-användare.

**Buildbart nu:** Enkel year-1-tax walkthrough, inte full tax engine.

### Varför dessa fyra hör ihop

Detta är skala- och mognadslager, inte första konsultkärnan.

---

## Kräver externa partnerships / integrationer

Listas för att de är verkliga expansionsvägar, men de ingår inte i
planen nu:

- faktisk myndighetsbokning via API
- bankonboarding via API
- försäkringsköp i appen
- bostadsannonser i appen via listings API
- flytt-firma-bokning
- myndighetsregistreringar via API
- skattedeklaration i appen

Allt detta kan ersättas med:

- deeplinks
- walkthroughs
- dokumentstöd
- deadlines

i v1.

---

## Rekommenderad byggordning

Om målet är maximal pocket-consultant-känsla så fort som möjligt:

### Först

**Phase 1 — Action Core**

Det här ger störst känslomässig produktlyft snabbast.

### Sedan

**Phase 2 — Evidence Core**

Nu blir systemet inte bara handlingsdrivet, utan också dokumentmedvetet.

### Därefter

**Phase 3 — Judgment Core**

Det här är punkten där appen börjar kännas som rådgivare, inte bara
workflow.

### Efter det

**Phase 4 — Arrival Core**

Nu känns GoMate användbar även efter ankomst.

### Sedan

**Phase 5 — Lifecycle Extensions**

Housing, departure och pets gör produkten bredare och mer komplett.

### Sist

**Phase 6 — Scale-Up**

Family, notifications, rule monitoring och tax.

---

## Meta-observation

Det viktigaste skiftet i hela planen är detta:

- inte bara **task support**
- utan **judgment support**

Det betyder att GoMate inte bara ska säga:

- här är dina uppgifter

utan också:

- är detta realistiskt för dig?
- vad är största risken just nu?
- vad bör du göra först?
- vad bör du inte lägga tid på ännu?
- vad är plan B om detta spår faller?

Det är där produkten faktiskt börjar kännas som en pocket consultant
för vanliga människor.
