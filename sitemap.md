# Sitemap

Detta dokument låser den nya informationsarkitekturen för v1.

Mål:

- mindre scroll
- tydligare navigering
- högre informationsdensitet
- mindre "dashboard som dump-yta"
- mer app-känsla, mindre stora cards staplade på varandra

V1-scope gäller fortfarande:

- single applicant first
- ingen full family/dependents-modell

## Kärnprinciper

1. `Dashboard` är bara överblick.
2. Varje top-level-sida ska ha ett tydligt jobb.
3. Arbetsytor ska vara kompakta och lätta att skanna.
4. Inget viktigt system ska "bo lite överallt".
5. Samma information ska inte presenteras i full form på flera sidor.

## Sidebar

Top-level navigation för v1:

- `Dashboard`
- `Immigration`
- `Pre-move`
- `Post-move`
- `Documents`
- `Plan & Guidance`
- `Settings`

Notering:

- använd `Immigration` i stället för `Visa`
- det är bredare och funkar bättre för free movement, permit, pathway och plan B

---

## Dashboard

### Syfte

Snabb överblick.

Detta är användarens "vad kräver min uppmärksamhet just nu?"-yta.

### Ska innehålla

- top priority
- readiness snapshot
- top 3 risks / blockers
- kort statusrad:
  - immigration
  - documents
  - pre-move
  - post-move
- notifications summary
- ev. senaste relevanta rule change om den är viktig

### Ska inte innehålla

- full readiness-sektion
- full risks-sektion
- full pathway/plan-B-sektion
- full arrival playbook
- full banking/healthcare
- full housing
- full departure
- full pet relocation
- full tax overview

### Presentationsprincip

- kompakt
- 1 skärmyta först
- små kort eller listmoduler
- inga långa sektioner

---

## Immigration

### Syfte

Allt som rör entry path, legal path och immigrationsstatus.

### Ska innehålla

- primary path
- alternatives / plan B
- denied / delayed handling
- visa/immigration readiness
- visa/immigration risks
- relevanta immigration-tasks
- rule changes som påverkar immigration

### Ska inte innehålla

- document vault som helhet
- allmän pre-move-checklist
- post-move operational setup
- housing support
- departure support

### Presentationsprincip

- vänsterkolumn:
  - current path
  - readiness
  - blockers
- högerkolumn:
  - plan B
  - denied/delayed
  - related changes
- längre task-lista eller task-tab under detta

---

## Pre-move

### Syfte

Den operativa arbetsytan före flytt.

### Ska innehålla

- pre-departure checklist
- deadlines
- urgency
- task detail view
- action links
- pre-move missing documents summary
- kort "what matters now" högst upp

### Ska inte innehålla

- full immigration reasoning
- full document vault
- full post-move setup
- housing deep support i full längd
- departure/repatriation

### Presentationsprincip

- huvudlista/tabell först
- filter:
  - urgent
  - this week
  - blocked
  - completed
- task detail i side sheet
- kompakt top summary, inte stora hero-kort

---

## Post-move

### Syfte

Den operativa arbetsytan efter ankomst.

### Ska innehålla

- settling-in checklist
- first 72 hours
- first 30 days
- banking flow
- healthcare flow
- driver's license guidance
- insurance guidance
- cultural orientation

### Ska inte innehålla

- full immigration path analysis
- full document vault
- housing support i full längd
- departure/repatriation
- tax overview i full längd

### Presentationsprincip

- överst:
  - arrival phase
  - what matters now
- under:
  - checklist som huvudarbetsyta
- sedan tabs eller subnav för:
  - playbook
  - setup
  - orientation

Viktigt:

- Post-move får inte vara en lång vertikal dump av alla Phase 4-moduler

---

## Documents

### Syfte

Tvärgående dokumentarbetsyta.

### Ska innehålla

- vault
- categories
- uploaded docs
- linked docs
- missing docs
- proof guidance
- prep guidance
- upload / view / delete

### Ska inte innehålla

- full checklist
- immigration reasoning i full längd
- housing/departure/pet som egna sektioner

### Presentationsprincip

- vänster:
  - document categories
  - counts
- huvudpanel:
  - list/grid över dokument
- sekundärpanel eller tabs:
  - linked to tasks
  - missing
  - prep/proof guidance

Detta ska kännas som ett riktigt arbetsverktyg, inte som en bilaga.

---

## Plan & Guidance

### Syfte

Rådgivningslager som inte är den primära dagliga task-listan.

### Ska innehålla

- housing support
- departure / repatriation flow
- pet relocation
- tax overview
- rule-change monitoring

### Ska inte innehålla

- full pre-move-checklist
- full post-move-checklist
- document vault
- readiness/risk som huvudsystem

### Presentationsprincip

- egen subnav eller tabs:
  - Housing
  - Departure
  - Pets
  - Tax
  - Rule changes

Viktigt:

- detta ska inte bli ännu en dashboard
- en guidance-yta i taget

---

## Settings

### Syfte

All styrdata och användarinställningar.

### Ska innehålla

- destination
- citizenship
- current location
- purpose
- arrival date
- budget
- pets
- profile fields som påverkar recommendations
- notification preferences

### Ska inte innehålla

- guidance
- long-form recommendations
- checklist data

---

## Vad som flyttas bort från nuvarande dashboard

Följande ska bort från fullängds-scrollen på `Dashboard`:

- full `ReadinessSection`
- full `RisksSection`
- full `PathwaysSection`
- full `ArrivalPlaybookSection`
- full `SetupFlowsSection`
- full `LicenseInsuranceSection`
- full `OrientationSection`
- full `HousingSupportSection`
- full `DepartureFlowSection`
- full `PetRelocationSection`
- full `TaxOverviewSection`
- full `RuleChangesSection`

Dashboard får i stället länka in till rätt arbetsyta eller guidance-yta.

---

## Visuell princip

Målet är närmare referenser som WorkFlex, JumpCloud och Personio:

- mindre komponenter
- tätare layout
- mindre padding
- färre stora cards
- mer listor, tabeller, rows och små statusmoduler
- konsekvent neutral bas
- en lugn accentfärg, inte många konkurrerande färger

Det betyder:

- inga långa staplar av stora fullbreddskort
- inga flera "hero sections" på samma sida
- varje sida ska ha en tydlig primär struktur:
  - lista
  - tabell
  - tab-set
  - compact cards

---

## Beslutsregel

Om en ny feature byggs ska man först fråga:

1. Är detta överblick?
   - då hör den hemma på `Dashboard` i kompakt form
2. Är detta en daglig arbetsyta?
   - då hör den hemma i `Immigration`, `Pre-move`, `Post-move` eller `Documents`
3. Är detta bredare rådgivning?
   - då hör den hemma i `Plan & Guidance`
4. Är detta styrdata?
   - då hör den hemma i `Settings`

Detta ska minska risken att allt hamnar på dashboarden igen.

