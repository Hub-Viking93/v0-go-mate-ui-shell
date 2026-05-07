# GoMate — User-facing manual test plan

Ett levande dokument. För varje fas vi bygger lägger vi in steg-för-steg-tester
som du kan köra direkt i frontend (`/checklist`, `/onboarding`, etc.) utan att
röra backend, curl, DB eller liknande.

Varje test är skrivet som:

- **Vad** — vad ska funka för användaren?
- **Hur** — exakta klick / inputs i UI:n
- **Förväntat** — vad du ska se

Förkortningar:

- **Listvyn** = task-kortet på `/checklist` (settling-in eller pre-departure)
- **Detail-vyn** = sliding sheet:en som öppnas från höger
- **Urgency-badge** = den lilla pillet som säger "Overdue", "Due today", "Due in 3d", "Due this week", etc.
- **Deadline-type-badge** = "Legal" (röd) eller "Recommended" (grå)

---

## Förberedelser (en gång)

1. Starta dev-servrarna:

   ```
   pnpm -F @workspace/api-server dev   # backend på 3002
   pnpm -F @workspace/gomate dev       # frontend på 5174
   ```

2. Logga in som test-användaren i `.env.local` (TEST_EMAIL / TEST_PASSWORD).

3. Du behöver en aktiv plan. Snabbaste vägen:

   - Gå igenom `/onboarding`-wizardet (5 steg) om du inte redan har en plan.
   - Sätt destination = **Sweden** (mest walkthrough-content), arrival/timeline-datum
     **3 dagar i framtiden** för att lättast trigga "urgent" + "overdue" senare.

4. På `/checklist` ska två tabbar vara synliga: **"Pre-move"** och **"Post-move"**.

---

## Phase 1A — Deadlines + urgency i checklistan

Allt här testar att UI:n visar deadlines, urgency-bucketar (Overdue / Urgent ≤3d /
Approaching ≤14d / Normal) och deadline-type (Legal / Recommended) korrekt på
båda tabbarna.

### 1A-1 — Pre-move-tabben renderar urgency-badges

- **Vad:** Varje task-kort i pre-move-listan visar en urgency-badge när tasken
  är överdue eller nära-deadline.
- **Hur:**
  1. Gå till `/checklist?tab=pre-move`.
  2. Om "Generate my pre-move checklist" visas, klicka den.
  3. Skanna kortlistan.
- **Förväntat:**
  - Tasks med deadline ≤3 dagar bort har en **röd "Due in Xd / Due today / Due tomorrow"**-badge.
  - Tasks med deadline ≤14 dagar bort har en **gul "Due this week / Due in Xd"**-badge.
  - Tasks med passerad deadline har en **röd "Overdue / Overdue by Xd"**-badge.
  - Tasks som är längre bort har **ingen** urgency-badge alls.

### 1A-2 — "Overdue / urgent"-bannern överst

- **Vad:** Om någon task är overdue eller urgent, syns en rosa banner längst upp
  med en kort lista av de mest brådskande.
- **Hur:**
  1. På samma `?tab=pre-move`, scrolla upp till headern.
- **Förväntat:**
  - Om du har overdue/urgent-tasks: rosa banner med rubrik typ
    `"2 overdue · 3 due in ≤3 days"` eller `"3 actions due in ≤3 days"`.
  - Listan i bannern visar upp till 6 task-rubriker, var och en föregådd av sin
    egen urgency-badge.
  - Klick på en rad i bannern öppnar **detail-vyn** för den tasken (se Phase 1B).

### 1A-3 — Deadline-type-badge

- **Vad:** Tasks som är lagstadgade visar en röd **"Legal"**-badge; tasks som är
  optional visar en grå **"Recommended"**-badge.
- **Hur:**
  1. Skanna pre-move-listan efter rubriker som *"Apply for A1 certificate"* eller
     *"Submit visa application"* — de ska ha **Legal**.
  2. Skanna post-move-tabben (`?tab=post-move`) efter *"Apply for Swedish ID
     card"* eller *"Buy SL-card"* — de ska ha **Recommended**.
- **Förväntat:**
  - Legal-badge är röd och konkurrerar inte med urgency-badgen om plats.
  - Recommended-badge är grå/diskret.
  - Tasks utan badge är "practical" (default).

### 1A-4 — Sortering: överdue → urgent → approaching → normal

- **Vad:** Listan ranker mest brådskande tasks överst, oavsett ursprunglig
  sort_order.
- **Hur:**
  1. På `?tab=post-move`, kolla i vilken ordning task-korten ligger.
- **Förväntat:**
  - Eventuella **overdue** items ligger överst.
  - Sen **urgent** (≤3d).
  - Sen **approaching** (≤14d).
  - Längst ned: **normal** + completed.
  - Inom samma bucket: ordnat efter tidigast deadline först.

### 1A-5 — Completed/skipped tas inte med i urgent-bucket

- **Vad:** När du markerar en urgent task som completed försvinner den från
  overdue/urgent-bannern.
- **Hur:**
  1. På pre-move-tabben, hitta en task med röd urgency-badge.
  2. Markera tasken som completed via checkbox-knappen längst till vänster på kortet.
  3. Vänta på spinner att försvinna.
- **Förväntat:**
  - Tasken försvinner från overdue/urgent-bannern.
  - Antalet i banner-rubriken (`"3 due in ≤3 days"`) räknas ned med 1.
  - Task-kortet får överstrykning + flyttar sig längre ned i listan.

### 1A-6 — Post-move "by-date"-fallback

- **Vad:** Tasks utan urgent/overdue/approaching-bucket visar deadline som klartext
  "by 23 Jun" istället för en färgad badge.
- **Hur:**
  1. På `?tab=post-move`, skrolla till tasks långt fram i tiden.
- **Förväntat:**
  - Du ser en grå monospace-text typ `by 23 Jun` istället för en färgad badge.

---

## Phase 1B — Task detail view + walkthroughs

Allt här testar att klick på en task öppnar en sliding Sheet med strukturerad
walkthrough — *what this is / why it matters / before you start / steps /
common mistakes / what happens next* — för de tasks som har authored walkthrough.

### 1B-1 — Sheet öppnas på klick (settling-in)

- **Vad:** Klick på rubriken eller chevron öppnar en sliding panel från höger.
- **Hur:**
  1. Gå till `/checklist?tab=post-move`.
  2. Klicka på rubriken **"Register at Skatteverket → personnummer"** (om destination = Sweden).
- **Förväntat:**
  - Sheet glider in från höger, ca 50% av skärmen.
  - Header visar: kategori-badge ("Registration"), Legal-badge, urgency-badge (om relevant), titel, deadline-rad ("Deadline: …").
  - Bakomliggande sida dimmas men förblir synlig.

### 1B-2 — Walkthrough-sektionerna i rätt ordning

- **Vad:** Sheet:en visar 6 strukturerade sektioner i fast ordning.
- **Hur:**
  1. I samma sheet, scrolla genom innehållet.
- **Förväntat (i ordning):**
  1. **What this is** — 1-2 meningar med definition.
  2. **Why it matters** — gul/varningsfärgad ikon, konkret konsekvens om man missar.
  3. **Before you start** — bullet-lista med vad du behöver innan.
  4. **Steps** — numrerade steg (med små gröna nummer-cirklar). Vissa steg
     har en länk-pill ("Open …") till officiell källa.
  5. **Common mistakes** — röd/varningsfärgad ikon, bullet-lista med fallgropar.
  6. **What happens next** — closing-paragraf.
- Sektioner saknas snyggt om walkthroughen inte har det fältet.

### 1B-3 — Reference-blocket nedanför walkthroughen

- **Vad:** Under walkthroughen finns ett "Reference"-block med tid, kostnad,
  officiell länk och dokumentlista.
- **Hur:**
  1. Scrolla längst ned i sheet:en.
- **Förväntat:**
  - Liten rubrik **"REFERENCE"** i versaler.
  - 2-kol grid med "Time" och "Cost".
  - Klickbar länk till officiell källa (öppnas i ny flik, visar host-namnet, t.ex. `skatteverket.se`).
  - "Documents needed" som bullet-lista.

### 1B-4 — Status-controls i footern

- **Vad:** Sheet:ens footer har 3 status-knappar.
- **Hur:**
  1. I öppen sheet, kolla längst ned.
- **Förväntat:**
  - **Mark complete** (eller "Completed" om redan klar)
  - **In progress**
  - **Skip** (ghost-button)
- Klick på Mark complete:
  - Knappen växlar till "Completed".
  - Sheet:en stängs **inte** automatiskt.
  - När du stänger sheet:en (klick utanför / Esc), syns task:en i listan som
    completed (överstrykning).

### 1B-5 — Walkthrough-stegens länkar fungerar

- **Vad:** Steg som har en länk öppnar källan i ny flik.
- **Hur:**
  1. Öppna t.ex. **"Enroll BankID"** (post-move) eller **"Verify pet microchip + rabies"** (pre-move).
  2. Hitta ett steg med en grön länk-pill (t.ex. "BankID activation guide ↗").
  3. Klicka.
- **Förväntat:**
  - Ny flik öppnas mot officiell källa.
  - Sheet:en själv stängs inte.

### 1B-6 — Empty-state för tasks utan walkthrough

- **Vad:** Tasks utan authored walkthrough säger det rakt ut, fejkar inget.
- **Hur:**
  1. På post-move, öppna en task som **inte** är i Phase 1B-listan
     (tex *"Buy SL-card"*, *"Set up electricity"*, *"Receive Försäkringskassan health card"*).
- **Förväntat:**
  - Header + Reference-block ser normala ut.
  - Walkthrough-zonen visar antingen:
    - en **streckad ruta** med text "Detailed walkthrough not yet authored…", **eller**
    - en sektion **"Quick steps"** med legacy-stegen + en italic-rad som säger
      "Detailed walkthrough not yet authored for this task. The summary above is from the task's generator."
  - Inga fejk-rubriker, inga tomma sektioner med "—" som platshållare.

### 1B-7 — Pre-move detail från urgent-bannern

- **Vad:** Klick på en länk i overdue/urgent-bannern öppnar samma sheet som
  klick i listan.
- **Hur:**
  1. På pre-move-tabben, klicka på en titel inne i den rosa overdue-bannern.
- **Förväntat:**
  - Samma sheet glider in från höger med samma walkthrough-innehåll som
    om du hade klickat på kortet i listan.

### 1B-8 — Sheet stängs på Esc / klick utanför / X

- **Vad:** Tre vanliga UX-mönster för stängning.
- **Hur:**
  1. Öppna en sheet.
  2. Tryck **Esc** → sheet stängs.
  3. Öppna igen, klicka på den dimmade bakgrunden → sheet stängs.
  4. Öppna igen, klicka **X-knappen** uppe i högra hörnet → sheet stängs.
- **Förväntat:** Alla tre stänger sheet:en.

### 1B-9 — Pre-move walkthroughs (high-value)

Tasks som har full Phase 1B-walkthrough på pre-move:

- ✅ Pack day-1 carry-on
- ✅ Set up mail forwarding
- ✅ Submit visa application
- ✅ Apostille birth certificate
- ✅ Apply for A1 social-security certificate
- ✅ Verify pet microchip + rabies vaccination

**Hur:** Öppna var och en, verifiera alla 6 walkthrough-sektioner finns + status-knappar funkar.

### 1B-10 — Post-move walkthroughs (high-value)

Tasks som har full Phase 1B-walkthrough på post-move (Sverige):

- ✅ Register at Skatteverket → personnummer
- ✅ Anmeldung at Bürgeramt (om destination = Germany)
- ✅ Collect physical residence-permit card (om visa_role = primary/dependent)
- ✅ Open a Swedish bank account
- ✅ Enroll BankID
- ✅ Register with a vårdcentral
- ✅ Confirm payroll setup with employer
- ✅ File A1 / CoC certificate copy with destination employer (om posting_or_secondment = yes)
- ✅ Convert / exchange driver's licence (om driver_license_origin/bringing_vehicle = yes)
- ✅ Set Swedish tax residency at Skatteverket
- ✅ Confirm school placement in person (om children_count > 0)

**Hur:** Öppna var och en, verifiera 6 sektioner + Reference-block + status-knappar.

---

## Phase 1C — Officiella länkar + bokningslänkar + next-click guidance

Allt här testar att detail-vyns nya **"Take action"**-sektion längst upp visar
strukturerade länkar (booking / official source / form / portal) med rätt typ,
description och appointment-hint.

### 1C-1 — "Take action" syns överst i detail-vyn

- **Vad:** För high-impact-tasks ska en ny "Take action"-sektion vara det första
  blocket inne i sheet:en, *före* "What this is".
- **Hur:**
  1. Gå till `/checklist?tab=post-move`.
  2. Klicka på **"Register at Skatteverket → personnummer"** (Sweden-flow).
- **Förväntat:**
  - Allra överst i sheet-bodyn: rubrik **"Take action"** med en chevron-ikon.
  - En **stor primär kort-länk** (grön/emerald-tonad) med titeln
    *"Book Skatteverket service-office visit"*.
  - Etiketterna **"BOOKING"** + **"Swedish + English"** ovanför länken.
  - En liten amber-pillruta längre ned i kortet med `On the page: Pick the
    service code 'Flytt till Sverige' / 'Folkbokföring'…`.

### 1C-2 — Sekundära länkar listas under primären

- **Vad:** Övriga länkar (info-page, formulär, portal) ligger som rader under
  primärkortet — distinkta men sekundära.
- **Hur:**
  1. Samma sheet (Skatteverket).
  2. Skanna under primärkortet.
- **Förväntat:**
  - **"Official folkbokföring info page"** med blå/indigo-ikon + badge **"OFFICIAL SOURCE"**.
  - **"SKV 7665 — notification of move (form)"** med amber-ikon + badge **"FORM"**.
  - Båda klickbara, öppnar i ny flik.
  - Hover ger ljus bakgrundsfärg på raden.

### 1C-3 — Appointment-hint på rätt plats

- **Vad:** Bokningslänkar som har en kryptisk eller flerstegs flödet visar en
  konkret guidance-rad: *"On the page: …"*.
- **Hur:**
  1. Öppna **"Anmeldung at Bürgeramt"** (om destination = Germany), eller
     vårdcentral-listning på post-move (Sweden).
- **Förväntat:**
  - Primärkortet visar `On the page: Choose 'Anmeldung einer Wohnung'. Pick
    your DISTRICT office, not just any one — wrong district = rejected on the
    day.` (eller motsvarande för vårdcentral).
  - Amber-pillen ska ha tydlig läsbar text — inte bara en URL.

### 1C-4 — Länk-typer skiljer sig visuellt

- **Vad:** Varje länk-typ har sin egen ikon + tonfärg så användaren ser
  skillnad mellan "info" och "boka".
- **Hur:**
  1. Öppna **"Enroll BankID"**.
- **Förväntat:**
  - Primär (grön): "BankID activation guide" — official_info-typ.
  - Sekundära: "BankID app (iOS)" + "BankID app (Android)" som **external_practical**
    (stone/grå-tonad ExternalLink-ikon).
  - "Test BankID at Skatteverket" som **portal** (KeyRound-ikon, indigo-ton).

### 1C-5 — Open Swedish bank account: 3 olika länk-typer

- **Vad:** Verifiera att en task med 1 booking + 1 official_info + 1 external_practical
  renderar varje länktyp distinkt.
- **Hur:**
  1. På post-move, öppna **"Open a Swedish bank account"**.
- **Förväntat:**
  - Primär: SEB:s nya-arrival-flow (BOOKING, emerald, med "On the page:"-hint).
  - Handelsbanken som "OFFICIAL SOURCE" (indigo).
  - Swedish Bankers Association som "PRACTICAL" (stone).

### 1C-6 — Pre-move: pet microchip + EU-rules

- **Vad:** Pre-move-tasks har samma struktur.
- **Hur:**
  1. Gå till `/checklist?tab=pre-move`.
  2. Öppna **"Verify pet microchip + rabies vaccination"**.
- **Förväntat:**
  - Primär: "EU pet movement — legislation" (OFFICIAL SOURCE).
  - Sekundära: "EU pet passport info", "UK → abroad pet travel".
  - Inget primary-kort eller dialog är tomt.

### 1C-7 — Mail forwarding: tre länder, samma task

- **Vad:** En task som listar parallella länkar för olika länder (DE/SE/UK).
- **Hur:**
  1. Pre-move → öppna **"Set up mail forwarding from origin address"**.
- **Förväntat:**
  - Primär: Deutsche Post Nachsendeservice med `On the page: Pick
    'Nachsendeservice International'…`.
  - Sekundära: PostNord Eftersändning + Royal Mail Redirection — varje med egen
    description.

### 1C-8 — Reference-blocket dubblar inte länken

- **Vad:** Om "official source" redan finns i Take Action-sektionen ska den inte
  dyka upp en gång till i Reference-blocket nedanför.
- **Hur:**
  1. Öppna en task med `walkthrough.links` (t.ex. Skatteverket eller vårdcentral).
  2. Skrolla till botten — Reference-blocket.
- **Förväntat:**
  - "Time", "Cost", "Documents needed" finns kvar.
  - **Ingen** "Official source (skatteverket.se)"-rad — den lever i Take Action-sektionen.

### 1C-9 — Tasks utan länkar fortsätter funka

- **Vad:** Tasks vars walkthrough saknar `links[]` ska inte visa Take Action-sektionen alls.
- **Hur:**
  1. Öppna **"Pack day-1 carry-on"** (pre-move) — har walkthrough men inga länkar.
- **Förväntat:**
  - Ingen "Take action"-sektion överst.
  - Walkthroughen börjar direkt med "What this is" / "Why it matters".
  - Reference-block kan fortfarande visa officialLink från task-objektet om sådan finns.

### 1C-10 — Klick öppnar i ny flik och bevarar sheet:en

- **Vad:** Att klicka på en Take Action-länk får inte stänga sheet:en eller
  navigera bort från checklistan.
- **Hur:**
  1. Öppna en task med Take Action.
  2. Klicka på primärkortet.
- **Förväntat:**
  - Ny flik öppnas med rätt URL.
  - Originalsheet:en förblir öppen.
  - GoMate-sidan i bakgrunden orörd.

### Phase 1C — high-value tasks med authored links

**Settling-in (post-move):**
- ✅ Register at Skatteverket → personnummer (3 länkar)
- ✅ Anmeldung at Bürgeramt (3 länkar, om destination = Germany)
- ✅ Collect physical residence-permit card (1 länk)
- ✅ Open a Swedish bank account (3 länkar)
- ✅ Enroll BankID (4 länkar)
- ✅ Register with a vårdcentral (2 länkar)
- ✅ File A1 / CoC certificate copy (2 länkar)
- ✅ Convert / exchange driver's licence (2 länkar)
- ✅ Set Swedish tax residency at Skatteverket (2 länkar)

**Pre-move:**
- ✅ Set up mail forwarding (3 länkar — DE/SE/UK)
- ✅ Submit visa application (2 länkar — om visa-pathway officialUrl finns)
- ✅ Apostille birth certificate (3 länkar)
- ✅ Apply for A1 social-security certificate (3 länkar)
- ✅ Verify pet microchip + rabies (3 länkar)

---

## Phase 2A — Document Vault

Allt här testar att användaren kan ladda upp, lista, ladda ned och ta bort
relocation-dokument i en riktig privat lagringsyta. Filerna ligger på Supabase
Storage (`relocation-documents`-bucketen) bakom RLS, metadata i nya
`relocation_documents`-tabellen.

### 2A-1 — Vault-tile på dashboarden

- **Vad:** Vault syns som en tydlig tile på dashboarden bredvid Checklist-tile.
- **Hur:**
  1. Logga in och gå till `/dashboard`.
- **Förväntat:**
  - En tile med rubriken **"Document vault"**, mapp/lås-ikon, undertext
    *"Store passport, visa, apostilles & more — privately."*
  - Antalet uppladdade dokument visas stort (0 om vaulten är tom).
  - Klick på tile:n navigerar till `/vault`.

### 2A-2 — Tomt-state på `/vault`

- **Vad:** Innan något laddats upp ska sidan ha en tydlig hjälpsam tom-vy.
- **Hur:**
  1. Klicka på Vault-tile:n eller gå direkt till `/vault`.
- **Förväntat:**
  - Header **"Document vault"** + en privacy-rad: *"Files are stored privately
    under your Supabase account…"*.
  - Streckad ruta i mitten med rubrik **"No documents yet"** och knappen
    **"Upload your first document"**.

### 2A-3 — Upload-dialog

- **Vad:** Klicka Upload öppnar en dialog med file-picker, kategori-select och
  notes-fält.
- **Hur:**
  1. På `/vault`, klicka på **"Upload"** (eller "Upload your first document").
- **Förväntat:**
  - Modal öppnas, rubrik **"Upload document"** + beskrivning
    *"PDFs, images, and Office documents work best (max 25 MB)."*
  - Tre fält:
    - **File** (klicka området → systemets file-picker dyker upp)
    - **Category** (Select med alla 10 kategorier)
    - **Notes** (textarea, valfritt)
  - **"Upload"**-knappen är inaktiverad tills en fil valts.

### 2A-4 — Faktisk uppladdning

- **Vad:** Att uppladdning verkligen sparar både fil + metadata.
- **Hur:**
  1. I dialogen, välj en fil (t.ex. PDF eller bild ≤25 MB).
  2. Välj kategori, t.ex. **"Passport / ID"**.
  3. Skriv en kort notering (valfritt), t.ex. "Valid until 2027".
  4. Klicka **Upload**.
- **Förväntat:**
  - Knappen visar spinner + texten **"Uploading…"**.
  - Dialogen stänger sig själv när färdigt.
  - Filen dyker upp på `/vault` under sin kategori.
  - Inga konsolfel.

### 2A-5 — Filerna grupperas korrekt per kategori

- **Vad:** Listan grupperar dokument efter kategori i en stabil ordning
  (Passport / ID först, "Other" sist).
- **Hur:**
  1. Ladda upp filer i 2-3 olika kategorier.
- **Förväntat:**
  - Varje kategori har egen rubrik + antal-räknare ("3 files").
  - Grupperna kommer i ordning: Passport/ID → Visa/Permit → Civil → Education
    → Employment → Financial → Housing → Health/Insurance → Pet → Other (skippar tomma kategorier).
  - Varje rad visar: ikon, filnamn, kategori-badge, storlek, uppladdningsdatum,
    eventuell anteckning.

### 2A-6 — Storleksgräns + filtypsskydd

- **Vad:** Stora filer ska refuseras med ett tydligt fel.
- **Hur:**
  1. Försök ladda upp en fil > 25 MB.
- **Förväntat:**
  - Röd error-rad: **"File is too large — max 25 MB."**
  - Inget UI-bryt; man kan välja en mindre fil och fortsätta.

### 2A-7 — Ladda ned ett dokument

- **Vad:** Download-knappen ska öppna en signerad URL i ny flik.
- **Hur:**
  1. På en uppladdad fil, klicka **Download**-ikonen (pil ned).
- **Förväntat:**
  - Spinner kort, sedan ny flik öppnas med filen (PDF visas inline, bilder
    visas, andra typer laddar ned beroende på browser).
  - URL:en är signerad — kontrollera att den slutar med `?token=...`.
  - URL:en fungerar bara medan du är inloggad och inom ~30 minuter.

### 2A-8 — Ta bort med bekräftelse

- **Vad:** Delete kräver explicit bekräftelse (skydd mot misstag).
- **Hur:**
  1. Klicka soptunne-ikonen på en fil.
- **Förväntat:**
  - Dialog **"Delete this document?"** med filnamn + varning *"This can't be undone."*
  - Två knappar: **Cancel** (default) + **Delete** (destructive).
  - Klick på **Delete** → spinner → dialog stänger → filen försvinner från listan.
  - Om du sedan testar att gå till den signerade URL:en igen → 404 / unauthorized.

### 2A-9 — Privacy + RLS

- **Vad:** Andra användare kan inte se dina filer.
- **Hur:**
  1. Logga in med ett annat konto.
  2. Gå till `/vault`.
- **Förväntat:**
  - Vaulten är tom (eller visar bara dokumenten som det andra kontot laddat upp).
  - Du kan inte gissa eller åtkomma den första användarens filer.

### 2A-10 — Persisterar mellan sessioner

- **Vad:** Filerna ska finnas kvar efter omladdning / utloggning.
- **Hur:**
  1. Ladda upp 1-2 filer.
  2. Hård-uppdatera (Cmd+Shift+R) eller logga ut + in.
- **Förväntat:**
  - Filerna ligger kvar med rätt kategori, namn och datum.
  - Vault-räknaren på dashboarden uppdateras till rätt antal.

---

## Phase 2B — Task ↔ Document linkage

Tester här verifierar att task detail-vyn nu vet vilka dokument-kategorier en
task behöver, vilka som finns i vaulten, och vilka som saknas — plus att
användaren kan ladda upp eller länka direkt från task-vyn.

### 2B-1 — Documents-sektionen syns på rätt tasks

- **Vad:** Dokumentsektionen ska bara visas när tasken har authored
  `requiredDocumentCategories`.
- **Hur:**
  1. `/checklist?tab=post-move`. Öppna **"Register at Skatteverket → personnummer"**.
  2. Stäng. Öppna **"Set up electricity, internet, water utilities"** (housing-utilities).
- **Förväntat:**
  - Skatteverket-tasken visar en sektion **"Documents for this task"** mellan
    walkthroughen och Reference-blocket.
  - Housing-utilities-tasken visar **inte** sektionen alls (ingen authored
    requirement).

### 2B-2 — Required-chips renderas korrekt

- **Vad:** "Required"-raden listar alla nödvändiga kategorier — gröna när de
  redan är täckta, ambergula när de saknas.
- **Hur:**
  1. Med tom vault: öppna Skatteverket-tasken.
- **Förväntat:**
  - 4 amber chips: Passport / ID, Visa / Permit, Housing, Civil documents.
  - Ovanför står **"0/4 covered"**.
  - Inga gröna chips än.

### 2B-3 — Saknade kategorier visas tydligt

- **Vad:** "Missing"-listan ska ha en rad per saknad kategori med 1-2 CTAs.
- **Hur:**
  1. Samma sheet, fortsätt till "Missing"-blocket.
- **Förväntat:**
  - Varje rad är en gulhinted bar med: kategori-namn + **Upload**-knapp.
  - Om en vault-doc finns i kategorin men inte är länkad → **Link existing** + **Upload**-knappar.

### 2B-4 — Upload from task auto-länkar

- **Vad:** Klick på "Upload" i en missing-rad → upload-dialog förvald med kategorin
  + auto-länkar till tasken vid registrering.
- **Hur:**
  1. På Skatteverket-sheet:en, klicka **Upload** på "Passport / ID"-raden.
  2. Verifiera dialog-rubrik: **"Upload document for this task"**.
  3. Beskrivning ska nämna `"Register at Skatteverket → personnummer"`.
  4. Välj en testfil, lämna kategori = Passport / ID, klicka Upload.
- **Förväntat:**
  - Dialog stänger.
  - "Documents for this task" uppdateras direkt: Passport-chippen blir grön.
  - "Already in your vault"-blocket dyker upp med filen, kategori-tag,
    "Uploaded {datum}" och **Unlink**-knapp.
  - Counter ändras till **"1/4 covered"**.
  - Missing-listan har tappat Passport-raden.

### 2B-5 — Link existing flödet

- **Vad:** Om det redan finns en doc i samma kategori (men inte länkad) ska
  "Link existing"-knappen öppna en plockare.
- **Hur:**
  1. Gå till `/vault` och ladda upp en bild i kategorin **"Housing"**.
  2. Tillbaka till `/checklist?tab=post-move` → öppna Skatteverket-tasken igen.
  3. På "Housing"-raden i Missing, klicka **Link existing**.
- **Förväntat:**
  - Dialog "Link a document" öppnas, beskriver kontexten med task-titeln.
  - Listan filtreras till bara housing-dokument.
  - Klick på din uppladdade fil → den länkas (PATCH /api/vault/:id { link: ... }) och dialog stänger.
  - Sektionen uppdateras: Housing-chippen blir grön, filen syns i "Already in your vault".

### 2B-6 — Matched by category-hint

- **Vad:** Dokument som täcker en kategori implicit (samma kategori, ingen
  explicit länk) ska visa en italic "matched by category"-rad så användaren
  förstår skillnaden.
- **Hur:**
  1. Vault: ladda upp en doc i kategorin **"Civil documents"**.
  2. Öppna Skatteverket-tasken (utan att explicit länka).
- **Förväntat:**
  - Civil documents-chippen är grön.
  - I "Already in your vault" finns filen med texten **"Civil documents · Uploaded … · matched by category"** (italic).
  - **Ingen** "Unlink"-knapp på den raden (eftersom det inte är en explicit länk).

### 2B-7 — Unlink fungerar

- **Vad:** Explicit länkade dokument kan unlinkas från task-vyn utan att raderas.
- **Hur:**
  1. Öppna en task där du explicit länkat en doc (t.ex. Skatteverket via 2B-4).
  2. Klicka **Unlink** på en rad i "Already in your vault".
- **Förväntat:**
  - Spinner kort, sedan raden flyttar tillbaka till Missing (om kategori-doc
    saknas) eller stannar som "matched by category".
  - Filen finns kvar i `/vault` (ladda om för att verifiera).
  - `linkedTaskKeys` på dokumentet i vault-API:t har slutat innehålla
    `settling-in:reg-population`.

### 2B-8 — Pre-move tasks fungerar identiskt

- **Vad:** Pre-departure-tasks får samma documents-sektion.
- **Hur:**
  1. `/checklist?tab=pre-move`.
  2. Öppna **"Submit visa application"** eller **"Apostille birth certificate"**.
- **Förväntat:**
  - Documents-sektion finns med visa-relaterade kategorier (passport, civil, m.fl.) eller "Civil documents" för apostille.
  - Upload + Link existing fungerar.
  - Länken sparas under nyckeln **"pre-departure:visa-submit"** /
    **"pre-departure:docs-birth-apostille"**.

### 2B-9 — Korslänkning mellan flöden

- **Vad:** Ett och samma vault-dokument kan vara länkat till både en pre-move
  och en post-move-task.
- **Hur:**
  1. Ladda upp en passport-fil och länka från **Visa application** (pre-move).
  2. Öppna **Skatteverket-folkbokföring** (post-move) → Passport / ID-raden.
- **Förväntat:**
  - "Already in your vault" visar samma fil med text **"matched by category"**
    (eftersom explicit länkning gjordes mot pre-move-tasken, inte denna).
  - Om du klickar **Link existing** + plockar samma fil får du två länkar
    (pre-departure:visa-submit + settling-in:reg-population) på samma doc.

### 2B-10 — Phase 2B explicit non-goal: ingen kvalitetsbedömning

- **Vad:** Sektionen ska tydligt säga att vi inte bedömer kvalitet ännu.
- **Hur:**
  1. Öppna en task med required docs och scrolla längst ned i sektionen.
- **Förväntat:**
  - Italic-rad: *"We track what's there, not whether it's good enough.
    Document quality + apostille checks arrive in the next release."*
  - Ingen bedömning typ "good", "weak", "expired" — endast covered/missing.

---

## Phase 2C — Proof-of-eligibility coach + document preparation guidance

Tester här verifierar att task detail-sheet:en nu visar VAD du försöker bevisa,
VILKA dokument som brukar accepteras, HUR de ska förberedas, och VAD som ofta
går fel — utan att vi någonsin säger "godkänd" eller "underkänd".

### 2C-1 — "What you're proving" subsection visas på rätt tasks

- **Vad:** Tasks med authored `proofGuidance` ska visa en "What you're proving"-sektion
  med en kortbar per proof goal.
- **Hur:**
  1. Logga in med en plan i `arrived`-stage. Regenerera DAG om dina rader är från före
     Phase 2C-deployen (ny walkthrough-JSON).
  2. `/checklist?tab=post-move` → öppna **"Register at Skatteverket → personnummer"**.
  3. Skrolla till "Documents for this task"-sektionen.
- **Förväntat:**
  - En etikett **"WHAT YOU'RE PROVING"** under Required-chip-raden.
  - Tre kort: **Your identity**, **Where you live in Sweden**, **Civil status (if registering family)**.
  - Varje kort visar:
    - rubrik
    - 1-rads beskrivning ("why this matters")
    - en "USUALLY ACCEPTED"-lista med kategori-badge + dokument-beskrivning + ev. `note` (italic)
    - en status-badge i topphörnet: **Covered** (grön) eller **Still uncertain** (amber)

### 2C-2 — Coverage-status reagerar på faktiskt vault-innehåll

- **Vad:** "Covered" ska bli grön så snart minst ett dokument i en av kategorierna
  i `acceptableEvidence` finns i vaulten.
- **Hur:**
  1. Med tom vault: öppna Skatteverket → varje proof goal är **Still uncertain**.
  2. Stäng sheet. Gå till `/vault` → ladda upp en testfil i kategorin **Passport / ID**.
  3. Tillbaka till Skatteverket-tasken → öppna detail-sheet:en igen.
- **Förväntat:**
  - "Your identity"-kortet är nu grönt med **Covered**.
  - "Where you live in Sweden" + "Civil status" är fortfarande amber.
  - "Matched: <filnamn>"-rad längst ned i det covered:ade kortet.

### 2C-3 — Uncovered-hint + per-goal CTAs

- **Vad:** När en goal är "Still uncertain" och har en `uncoveredHint`, ska
  hint:en visas tillsammans med Upload + Link existing-knappar.
- **Hur:**
  1. På Skatteverket-sheet:en, kolla "Where you live in Sweden"-kortet.
- **Förväntat:**
  - Italic amber text: *"No Swedish housing contract uploaded yet — Skatteverket usually
    rejects 'staying with friends' arrangements without a host letter."*
  - **Upload**-knapp (alltid).
  - **Link existing**-knapp (bara om vaulten redan har en housing-doc som inte är länkad).

### 2C-4 — Upload från proof-goal-CTA fungerar

- **Vad:** Klick på Upload i en proof-goal-CTA ska förvälja en av kategorin i
  `acceptableEvidence` och auto-länka.
- **Hur:**
  1. På "Where you live in Sweden", klicka **Upload**.
- **Förväntat:**
  - Dialog **"Upload document for this task"** öppnas.
  - Default-kategori = **Housing**.
  - Beskrivning nämner Skatteverket-task:en.
  - Upload → kortet flippar till grön **Covered** + "Matched: <filename>".

### 2C-5 — Preparation guide-sektion

- **Vad:** En "How to prepare"-sektion med per-kategori-kort visas under Missing.
- **Hur:**
  1. Skrolla till botten av "Documents for this task" på Skatteverket-sheet:en.
- **Förväntat:**
  - Etikett **"HOW TO PREPARE"**.
  - Ett kort per kategori som är required eller refererad i acceptableEvidence
    (Passport / ID, Visa / Permit, Housing, Civil documents).
  - Varje kort har:
    - kategori-badge
    - kort italic-beskrivning
    - bullet-lista med 3-4 förberedelse-regler
    - rule-pills: **Validity**, **Original vs copy**, **Translation**, **Apostille** (de som finns för kategorin)
    - en collapsed `<details>` för **"Common mistakes (N)"** som kan expanderas

### 2C-6 — Common mistakes-toggle

- **Vad:** Per-kategori-mistakes ska vara dolda tills man klickar.
- **Hur:**
  1. Hitta ett prep-kort med "Common mistakes (3)"-summary.
  2. Klicka.
- **Förväntat:**
  - Listan expanderar med 2-4 mistakes-bullets.
  - Klick igen → kollapsar.
  - Inga mistakes-rader visas innan klick.

### 2C-7 — Disclaimer i botten

- **Vad:** Sektionen avslutas med en preparation-guidance-disclaimer.
- **Hur:**
  1. Skrolla till absoluta botten av documents-sektionen.
- **Förväntat:**
  - Stone-tonad ruta med stark inledning **"Preparation guide, not approval."**
  - Resten: *"We tell you what's usually accepted and how to prepare it. We can't promise
    the authority will accept any specific upload — final decisions stay with them."*
  - Ingen approve/reject-styled text någonstans i sektionen.

### 2C-8 — Pre-move tasks får samma 2C-stöd

- **Vad:** Visa-submit + apostille + A1 + pet-tasks på pre-move ska visa proof-goals + prep guide.
- **Hur:**
  1. `/checklist?tab=pre-move`.
  2. Öppna **"Submit visa application"**.
- **Förväntat:**
  - Fyra proof-goals: Identity, Legal basis, Financial means, Civil status (if relevant).
  - Prep guide-kort för 6 kategorier (passport, visa, civil, education, financial, employment).
  - "Common mistakes" finns på varje kategori-kort.
  - Den röda uncoveredHint på Legal basis: *"The legal basis is the most-rejected proof
    category — visas refused most often because the supporting basis was unclear or missing."*

### 2C-9 — "Matched by category" + uncovered samspelar

- **Vad:** Matched-by-category-dokument ska räkna som covered i proof-goal-vyn även
  utan explicit länkning.
- **Hur:**
  1. Ladda upp en doc i kategorin **Civil documents** via /vault (utan att länka till tasks).
  2. Öppna **"Apostille birth certificate"** (pre-move, om du har civil-status profilfält som triggar tasken).
- **Förväntat:**
  - "An authenticated civil record"-goal är grön Covered.
  - Klick på **Link existing** är fortfarande tillgängligt om du vill explicit-länka.

### 2C-10 — Inga "godkända/avvisade"-etiketter någonstans

- **Vad:** Verifiera att vi aldrig påstår att ett dokument blir godkänt.
- **Hur:**
  1. Skanna alla kort + texter i "Documents for this task" på flera tasks.
- **Förväntat:**
  - Endast soft phrasing: "Covered" / "Still uncertain" / "Usually accepted" / "Common mistakes".
  - Inga ord som "Approved", "Rejected", "Verified", "Validated", "Compliant" om uppladdade dokument.
  - Disclaimer:n är synlig var gång documents-sektionen renderas.

---

## Phase 3A — Readiness model

Tester här verifierar att dashboarden nu visar en strukturerad readiness-bild
i fyra domäner (visa / money / document / move) med förklaringar, blockers
och nästa steg — ingen abstrakt "78%"-siffra.

### 3A-1 — Readiness-sektion finns på dashboarden

- **Vad:** En "How ready are you?"-sektion ska visas på `/dashboard`.
- **Hur:**
  1. Logga in. Gå till `/dashboard`.
- **Förväntat:**
  - Sektion under tile-raden med rubrik **"How ready are you?"** + undertext om
    fyra domäner.
  - Eventuell **Top priority**-banner (grön/emerald) om systemet hittade ett
    nästa-steg.
  - Fyra kort: **Visa**, **Documents**, **Money**, **Move** — sorterade så att
    "low" hamnar först.
  - Avslutande italic-rad: *"Readiness is a guidance signal — not a prediction
    of approval. Authorities make the final decision."*

### 3A-2 — Varje domän visar level + reasons + blockers + next step

- **Vad:** Per domän-kort: level-pill, "Why this level"-bullets, "What's holding
  it back"-bullets, en next-step-rad.
- **Hur:**
  1. På samma `/dashboard`, skanna t.ex. **Visa**-kortet.
- **Förväntat:**
  - Höger om titeln: en pill **Low** / **Medium** / **High** med rätt färg
    (rose/amber/emerald).
  - "WHY THIS LEVEL" → 1-3 bullets med ✓-ikon.
  - "WHAT'S HOLDING IT BACK" → 0-3 bullets med streckad cirkel-ikon (om
    blockers finns).
  - Nedre raden: **"Next: …"** + **Go →**-knapp som länkar till relevant sida.

### 3A-3 — Visa readiness reagerar på pathway-state

- **Vad:** Olika visa-states ska ge olika levels.
- **Hur:**
  1. Med ett konto utan visa-research → **Visa: Low** med next-step
     "Run visa research from your dashboard".
  2. Efter visa-research men utan vald pathway → **Visa: Medium** med
     "Open Visa & Legal and select a pathway".
  3. Med vald pathway men ingen passport i vault → **Visa: Medium** med
     "Upload your passport into the vault".
  4. Med vald pathway + passport + visa_permit i vault → **Visa: High**.
- **Förväntat:** Var och en av nivåerna hittar rätt enligt ovan.

### 3A-4 — EU-EU-fall får alltid Visa: High

- **Vad:** Citizenship + destination som båda är EU/EEA ska kortsluta till High.
- **Hur:**
  1. Sätt citizenship=Swedish, destination=Germany i profilen.
- **Förväntat:**
  - **Visa: High**.
  - Reason: *"EU/EEA freedom of movement — no visa needed for this destination"*.
  - Inget next-step.

### 3A-5 — Money readiness reagerar på savings_available

- **Vad:** Buffert vs. budget styr Money-level.
- **Hur:**
  1. Sätt `savings_available = 0` i onboarding-Visa-finance-steget.
- **Förväntat:**
  - **Money: Low** med reason *"Savings on file is 0"*.
  - Next: *"Update savings_available or plan for a sponsor / advance from your employer"*.
  2. Sätt savings = 1 × monthly budget → **Low** (`<3 månaders runway`).
  3. Sätt savings = 4 × monthly budget → **Medium** med reason om "~4 months at your target budget".
  4. Sätt savings = 8 × monthly budget → **High** (om financial-proof inte krävs av tasks).

### 3A-6 — Document readiness reagerar på vault-coverage

- **Vad:** Procent av required-kategorier som är täckta styr Document-level.
- **Hur:**
  1. Med en plan i `arrived`-stage som genererat tasks (kräver flera kategorier),
     starta med tom vault → **Document: Low** med next-step
     "Start with Passport / ID — open the vault to upload".
  2. Ladda upp 1 fil i Passport / ID via /vault → omladda dashboarden →
     fortfarande Low/Medium beroende på hur många required du har.
  3. Ladda upp filer tills ≥80% av required är täckta → **Document: High**.
- **Förväntat:** Antalet täckta kategorier reflekteras i reasons (e.g. *"3 of 5 required document categories covered"*).

### 3A-7 — Move readiness reagerar på lifecycle-stage + tasks

- **Vad:** Stage `awaiting_collection` / `pre_departure` / `arrived` ger olika
  baselines, sedan justerar antalet completed + overdue.
- **Hur:**
  1. På en plan som ännu är `awaiting_collection` → **Move: Low** med reason
     "You're still in the research / onboarding phase".
  2. Generera pre-move-checklist + se Move flippa till Medium.
  3. Slutför ≥50% av pre-move-tasks utan overdue → **Move: High**.
  4. Lägg in en overdue-task → tillbaka till **Low** med "Clear the overdue
     items first…".

### 3A-8 — Top priority-banner väljer det viktigaste

- **Vad:** Banner längst upp i sektionen plockar det första actionable
  next-stepet i prioriteringsordning visa → document → money → move,
  med bias mot lågnivå.
- **Hur:**
  1. Ha samtidigt **Visa: Medium**-task (upload passport) och **Money: Low**-task.
- **Förväntat:**
  - Banner visar Money:s next-step (low ranks före medium).
  - Klick på banner → `/dashboard` (eller relevant href för domänen).

### 3A-9 — Sortering: lägst nivå först

- **Vad:** De fyra domänkorten sorteras med low → medium → high.
- **Hur:**
  1. På `/dashboard` med blandade levels.
- **Förväntat:**
  - First: alla "Low".
  - Sen: alla "Medium".
  - Sist: alla "High".

### 3A-10 — Inga falska scoring-element

- **Vad:** Verifiera att vi aldrig visar en abstrakt procent-siffra eller
  approval-orientorad text.
- **Hur:**
  1. Skanna alla 4 kort + banner.
- **Förväntat:**
  - **Inga** procent som "78% ready".
  - **Inga** orden Approved / Verified / Compliant / Eligible / Guaranteed.
  - Disclaimer-rad i botten.

---

## Phase 3B — Risks + blockers

Tester här verifierar att dashboarden nu visar en strukturerad risk-/blocker-vy
under readiness-sektionen. Risks är distinkt från readiness — readiness säger
"hur redo du är", risks säger "vad som är skört eller blockerar dig".

### 3B-1 — "Risks & blockers"-sektion finns på dashboarden

- **Vad:** Sektion under readiness-blocket på `/dashboard`.
- **Hur:**
  1. Logga in. Gå till `/dashboard`.
- **Förväntat:**
  - Rubrik **"Risks & blockers"** med subtitel *"What's fragile or stopping
    progress in your current state."*
  - Räknare-rad ("3 blockers · 2 critical · 4 warning · 1 info") när det finns risker.
  - All / Blockers-pillar uppe till höger.
  - Italic-rad i botten: *"These are state-driven flags, not legal advice…"*

### 3B-2 — Tomt-state känns ärligt

- **Vad:** När inga risker hittas ska sektionen säga det rakt ut.
- **Hur:**
  1. Plan i nytt skick (free-movement EU-medborgare, alla docs uppladdade,
     inga öppna tasks med saknade kategorier).
- **Förväntat:**
  - Emerald-tonad ruta med ikon + **"No active risks surfaced"** + förklaring
    att nya risker dyker upp när deadlines närmar sig.

### 3B-3 — Risk-kort renderas med korrekt struktur

- **Vad:** Varje risk är ett kort med severity-pill, titel, förklaring,
  consequence-rad, blocker-pill (om relevant).
- **Hur:**
  1. State med tomt vault + arrival_date <30 dagar bort.
- **Förväntat på risk-kort:**
  - Severity-pill: **Critical** (rose), **Warning** (amber) eller **Info** (stone).
  - Titel-rad t.ex. *"No passport on file"* / *"Vault is empty and arrival is close"*.
  - Förklaring 1-2 meningar under titeln.
  - **"If left:"** + consequence-mening i dimmad text.
  - Domän-tagg uppe till höger ("Visa", "Documents", "Timing", etc.).

### 3B-4 — Blocker-pill + "View blocked task"-CTA

- **Vad:** Risker som blockerar en specifik task ska visa både blocker-pill
  och en knapp som länkar till tasken.
- **Hur:**
  1. Skapa en open task som kräver `passport_id` men ladda inte upp passet.
- **Förväntat:**
  - Risk-kortet *"Missing documents for [task]"* har **Blocker**-pill (rose, med Ban-ikon).
  - **"View blocked task →"**-knapp under consequence-raden.
  - Klick navigerar till `/checklist?tab=post-move` (eller pre-move för
    pre-departure-tasks).

### 3B-5 — Filter "Blockers" döljer non-blocker-risker

- **Vad:** All / Blockers-toggle filtrerar listan.
- **Hur:**
  1. På sektionen, klicka **Blockers**-pill.
- **Förväntat:**
  - Bara risker med `isBlocker=true` syns.
  - När det inte finns några blockers: emerald-rad *"No active blockers.
    Switch to All to see warnings + info."*

### 3B-6 — Sortering: critical först, blocker först inom severity

- **Vad:** Sorterad så att critical+blocker visas allra först.
- **Hur:**
  1. State med blandade severities + 1 blocker-critical.
- **Förväntat:**
  - Första kortet är critical + blocker.
  - Sen critical (icke-blocker), sen warning (blocker först inom warning),
    sen info.

### 3B-7 — Specifika riskertyper triggas av rätt state

- **Vad:** Verifiera att de fem domänerna kan trigga var för sig.
- **Hur:** Sätt state-mutationer via `/api`-anrop eller direkt-edit:

  - **Visa**: pathway selected men ingen passport i vault → *"No passport on file"* (critical, blocker).
  - **Money**: `savings_available = 0` → *"Savings on file is zero"* (critical).
  - **Money**: olika valutor → *"Savings and monthly budget are in different currencies"* (info).
  - **Document**: open task med saknad housing-kategori → *"Missing documents for [task]"* (critical, blocker).
  - **Timing**: 1+ task med passerad deadline → *"N task(s) overdue"* (warning).
  - **Special**: posting_or_secondment="yes" + ingen employment-doc + arrival inom 60d → *"Posted-worker assignment without A1 / CoC on file"* (critical).
  - **Special**: pets="cat" + ingen pet-doc → *"Pet travel without pet documents"* (warning).
  - **Special**: prior_visa_rejection="yes" → *"Prior visa rejection on record"* (warning).

### 3B-8 — Free-movement EU-fall ger inga visa-risks

- **Vad:** EU-medborgare till EU-destination → ingen visa-risk surfacas.
- **Hur:** Sätt citizenship=Swedish, destination=Germany.
- **Förväntat:** Inget kort med `data-risk-domain="visa"` i listan.

### 3B-9 — Risk är distinkt från readiness

- **Vad:** Risk-listan visar specifika items, inte readiness-domain-pillen.
- **Hur:**
  1. På `/dashboard`, jämför Readiness-sektionen ovan med Risks-sektionen.
- **Förväntat:**
  - Readiness säger "Visa readiness: Low" (holistic level).
  - Risks säger "No passport on file" + "If left: You can't submit, can't
    open a destination bank account…" (specifika items).
  - Inga procent-siffror i Risks-sektionen.

### 3B-10 — Inga generiska "red flag"-fraser

- **Vad:** Verifiera att copy:n är state-specifik.
- **Hur:** Skanna alla risk-titlar + förklaringar.
- **Förväntat:**
  - Titlar refererar konkret state ("No passport on file", "3 tasks overdue",
    "Savings cover only ~2.4 months at your target budget").
  - Inga generiska "Risk detected" / "Warning" / "Action required"-fraser.

---

## Phase 3C — Plan B + denied/delayed handling

Tester här verifierar att dashboarden nu visar en strukturerad pathway-vy under
risks-sektionen: nuvarande spår + ev. svaghetsförklaring + state-stödda
alternativ + denied/delayed-guidance när scenariot triggar.

### 3C-1 — "Your path & Plan B"-sektion finns

- **Vad:** Sektion under risks-sektionen på `/dashboard`.
- **Hur:**
  1. Logga in. Gå till `/dashboard`. Skrolla under risks.
- **Förväntat:**
  - Rubrik **"Your path & Plan B"** + subtitle om "current path… realistic alternative…"
  - Italic-rad i botten: *"These suggestions are state-driven, not legal advice…"*

### 3C-2 — Primary path baserad på purpose

- **Vad:** Korrekt primärspår plockas från `profile.purpose`.
- **Hur:** Sätt purpose i profilen, reload dashboard:
  - `purpose=work` → primärkort: **Work permit**
  - `purpose=study` → **Study permit**
  - `purpose=digital_nomad` → **Digital nomad permit**
  - `purpose=settle` → **Family / settle pathway**
  - `purpose=other` eller saknat → "Not set yet"-empty state med länk till `/onboarding`
- **Förväntat:** Compass-ikon + label + rationale-mening som refererar destination.

### 3C-3 — Primary "fragile" reagerar på state

- **Vad:** Primärkortet blir **Fragile** när nyckeldokument saknas.
- **Hur:** Sätt purpose=work, ingen employment-doc i vault, visa_role saknat.
- **Förväntat:**
  - Primärkort har amber-tonad ring + **Fragile**-pill istället för **Holding up**.
  - "Why it's fragile right now"-lista visar konkreta state-bullets, t.ex.
    *"No signed employment contract or HR letter in your vault yet"*.

### 3C-4 — Alternativ surfacas bara när state stödjer dem

- **Vad:** Alternatives ska bara visas när det finns konkret state-grundat skäl.
- **Hur:** Med purpose=work:
  - Inga alternativ alls om varken education, posting eller free-movement passar.
  - Ladda upp en education-doc → **Study permit**-alternativ dyker upp med
    *"You have education credentials on file…"* som whyMayFit.
  - Sätt citizenship=Swedish + destination=Germany → **EU/EEA freedom of movement**
    alternativ med Strong fit-pill överst (sorterat strong→moderate→weak).

### 3C-5 — Inga generiska alternativ

- **Vad:** Verifiera att alla alternative-titlar är konkreta och state-grundade.
- **Hur:** Skanna whyMayFit-texterna för varje alternativ.
- **Förväntat:** Varje alternativ refererar konkret state ("You have education
  credentials on file", "Your citizenship + destination is EU/EEA", "Your
  profile says posting / secondment is yes"). **Inga** generiska "Other options
  to consider" eller "You may want to look at…".

### 3C-6 — Defer-recommendations för study + digital nomad

- **Vad:** När primärspåret är skört och tid är knapp, ska systemet kunna
  rekommendera fördröjning som "alternativ".
- **Hur:**
  1. purpose=study, no admission, arrival_date <60 dagar bort → alternative
     **"Defer to next intake"** med konkreta whatChangesNow-bullets.
  2. purpose=digital_nomad, monthly_income="2000 USD" → alternative
     **"Delay the move and build income"**.
- **Förväntat:** Båda renderas som vanliga alternativkort med moderate-pill.

### 3C-7 — Denied scenario triggar banner + pivot-suggestion

- **Vad:** När `visa_application.applicationStatus = "rejected"` ska en
  scenario-banner överst i sektionen säga vad som ändras.
- **Hur:**
  1. Sätt `visa_application = { selectedVisaType: "X", applicationStatus: "rejected" }`.
- **Förväntat:**
  - Rosa banner med rubrik **"Application denied"** + trigger-mening.
  - **Pivot suggested**-pill till höger (RotateCcw-ikon).
  - Tre kolumner: **Affects**, **Pause now**, **Do instead** med konkreta bullets.
  - Text inkluderar t.ex. "Don't book non-refundable flights or housing", "Read
    the rejection letter carefully".

### 3C-8 — Delayed scenario triggar amber banner

- **Vad:** När application=submitted/decision_pending OCH arrival inom 21 dagar.
- **Hur:**
  1. Sätt arrival_date = idag + 10 dagar.
  2. Sätt `visa_application = { applicationStatus: "submitted" }`.
- **Förväntat:**
  - Amber banner **"Application delayed"** + trigger nämner exakt antal dagar.
  - **Pivot suggested**-pill *frånvarande* (delayed → wait, don't switch).
  - "Do instead"-bullets om att kontakta authority + flexible flights.

### 3C-9 — Stalled scenario när arrival passerat utan stage-flip

- **Vad:** När `stage="pre_departure"` men arrival_date är ≥14 dagar tillbaka.
- **Hur:** Sätt arrival_date = idag - 20 dagar, stage=pre_departure.
- **Förväntat:**
  - Stone-tonad banner **"Plan stalled"** + trigger med dagar tillbaka.
  - "Do instead"-bullets om att markera arrival eller uppdatera arrival_date.

### 3C-10 — Inga falska self-confident claims

- **Vad:** Verifiera att copy:n inte överdriver visshet.
- **Hur:** Skanna sektionens text.
- **Förväntat:**
  - Inga ord som *"will be approved"*, *"guaranteed"*, *"definitely"*.
  - Mjuka kvalificerare istället: *"may fit"*, *"realistic if…"*, *"may be more realistic"*.
  - Italic-rad i botten upprepar att det är guidance, inte juridiskt råd.

---

## Phase 4A — Arrival playbook (First 72 hours / First 30 days)

Tester här verifierar att dashboarden nu visar en strukturerad
ankomst-playbook med två tydligt separerade tidsfönster — distinkt från
checklistan, och inte bara en sortering av tasks.

### 4A-1 — "Arrival playbook"-sektion finns

- **Vad:** Sektion under pathways-sektionen på `/dashboard`.
- **Hur:**
  1. Logga in. Gå till `/dashboard`. Skrolla under pathways.
- **Förväntat:**
  - Rubrik **"Arrival playbook"** + subtitle "What to do right after you land…"
  - Phase-pill uppe till höger: *"Pre-arrival preview"* / *"Day X — first 72 hours"* / *"Day X — first 30 days"* / *"Beyond first 30 days"*.
  - Italic-rad i botten: *"These windows are general best-practice for relocations…"*

### 4A-2 — Två tydligt separerade buckets

- **Vad:** Sektionen har två sub-rubriker, "First 72 hours" och "First 30 days", aldrig hopslagna.
- **Hur:**
  1. På sektionen, skanna sub-rubrikerna.
- **Förväntat:**
  - Sub-rubrik **"First 72 hours"** (Sparkles-ikon, emerald-tonad) med subtitle "Immediate landing — settle in, stay reachable, protect your originals."
  - Sub-rubrik **"First 30 days"** (Compass-ikon, indigo-tonad) med subtitle "Operational setup — get your local IDs, money, healthcare, payroll on track."
  - Räknare per bucket: "X / Y done".

### 4A-3 — Phase-pill reagerar på arrival_date

- **Vad:** Pill-texten ändras med tiden:
- **Hur:**
  1. arrival_date i framtiden → pill säger **"Pre-arrival preview"** (stone-tonad).
  2. arrival_date = idag - 1 dag → **"Day 1 — first 72 hours"** (emerald-tonad).
  3. arrival_date = idag - 10 dagar → **"Day 10 — first 30 days"** (indigo-tonad).
  4. arrival_date = idag - 60 dagar → **"Beyond first 30 days (day 60)"** (stone-tonad).
- **Förväntat:** Pill:ens tone + label matchar tidsfönstret.

### 4A-4 — Items är inte bara checklist-rader

- **Vad:** Många items i 72h-bucketen mappar INTE till någon settling-task.
- **Hur:**
  1. Öppna 72h-bucketen.
- **Förväntat:** Items som **"Pick up your keys"**, **"Activate a destination SIM"**, **"Photograph all originals"**, **"Day-1 essentials"**, **"Note nearest 24h pharmacy"** har ingen "View task →"-länk (de finns inte i settling-DAG:n).
- 30-day-bucketen däremot har items som **"Register at the population authority"** med "View task →"-länk till `/checklist?tab=post-move`.

### 4A-5 — whyNow-rationale är tids-anchored, inte konsekvens-anchored

- **Vad:** Varje item visar en **"Why now: …"**-rad med Clock-ikon.
- **Hur:**
  1. Skanna whyNow-texterna i 72h-bucket.
- **Förväntat:** Texterna refererar tidsfönstret konkret, t.ex.
  - *"Day 0 is the only window where you can still flag missing keys…"*
  - *"Most authority booking portals send 2FA codes to a destination phone…"*
  - *"The first 72 hours are when documents are most vulnerable to being misplaced…"*
- **Inga** generiska "this is required" / "you need to do this someday".

### 4A-6 — Conditional items gates på profile

- **Vad:** Items dyker upp / försvinner baserat på profile-flags.
- **Hur:**
  1. **posting_or_secondment="yes"** → 72h-bucket inkluderar **"Hand your A1 / CoC certificate to destination HR on day one"**.
  2. **children_count > 0** → 72h har **"Locate the school / kindergarten"** + 30d har **"Confirm school placement in person"**.
  3. **bringing_vehicle="yes"** eller **driver_license_origin="yes"** → 30d har **"Submit driver's licence conversion application"**.
  4. **prescription_medications=non-empty** → 72h har **"Take your doctor's letter to the nearest pharmacy"**.
  5. **pets=non-empty** → 72h har **"Set up the pet's space + locate the nearest vet"**.
- **Förväntat:** Item dyker bara upp när motsvarande state är true.

### 4A-7 — Status reflekterar settling-task-state

- **Vad:** När en item har `relatedTaskRef` och tasken är completed, item visar grön bock + line-through.
- **Hur:**
  1. Öppna 30d-bucketen, hitta **"Register at the population authority"**.
  2. Markera den underliggande settling-task `reg-population` som completed.
  3. Reload dashboard.
- **Förväntat:**
  - Item-statusen flippar från ○ (pending) till ✓ (completed, emerald).
  - Item-titeln får line-through-styling.
  - Räknaren "X / Y done" tickar upp med 1.

### 4A-8 — Items utan task default till pending

- **Vad:** Items som inte har relatedTaskRef visar alltid ○ "pending" (vi kan inte derivera deras status).
- **Hur:**
  1. På 72h-bucketen, kolla **"Activate a destination SIM"** eller **"Photograph all originals"**.
- **Förväntat:**
  - Status är ○ (cirkel-ikon, grå).
  - Ingen "View task"-länk (eftersom ingen relatedTaskRef finns).
  - Räknaren räknar dessa som "pending" tills användaren markerar manuellt (vilket inte är möjligt i 4A — det är en future enhancement).

### 4A-9 — Sortering inom bucket är stabil och ordnad

- **Vad:** Items i varje bucket är ordnade efter `order`-fält, inte efter status eller alfabet.
- **Hur:**
  1. Reload dashboarden flera gånger.
- **Förväntat:**
  - Numrering "1." "2." "3." på vänster sida är konsistent mellan reloads.
  - Ordningen 72h: keys → essentials-on-you → SIM → photo → essentials-shop → emergency → … (matchar `order: 0..9`).
  - Ordningen 30d: population-registration → permit-pickup → bank → digital-id → id-card → primary-care → payroll → school → transit → license → tax-residency.

### 4A-10 — Inte bara en kopia av checklistan

- **Vad:** Verifiera att playbooken introducerar items som inte finns i settling-DAG.
- **Hur:**
  1. Jämför playbook-items mot `/checklist?tab=post-move`.
- **Förväntat:**
  - Minst 5 items i 72h-bucketen (keys, SIM, photo-originals, essentials, emergency etc.) finns INTE som tasks i checklistan.
  - 30d-bucketen däremot lutar mer mot checklist-tasks (med deep-links).
  - Item-titlarna är inte identiska med task-titlarna (t.ex. "Open the destination bank account" vs. "Open a Swedish bank account").

---

## Phase 4B — Banking + healthcare setup flows

Tester här verifierar att dashboarden nu visar två separata setup-flöden
(Banking, Healthcare) med stegvis prerequisite-gating, inte bara två task-listor.

### 4B-1 — "Banking & healthcare setup"-sektion finns

- **Vad:** Sektion under arrival-playbook på `/dashboard`.
- **Hur:**
  1. Logga in. Gå till `/dashboard`. Skrolla under arrival playbook.
- **Förväntat:**
  - Rubrik **"Banking & healthcare setup"** + subtitle om "Two ordered setup flows".
  - Två flow-kort: **Banking setup** (Banknote, emerald) + **Healthcare setup** (HeartPulse, rose).
  - Italic-rad i botten: *"Setup flows mirror the underlying checklist…"*

### 4B-2 — Status-pillar reagerar på state

- **Vad:** Varje flow har en status-pill: **Blocked / Ready to start / In progress / Completed**.
- **Hur:**
  1. Med tom vault + ingen registration done → båda flows = **Ready to start** (eller **Blocked** beroende på prerequisites — banking är ready om address-step är ready).
  2. Markera reg-population task = completed → båda flows ska flippa till **In progress**.
  3. Slutför alla tasks → **Completed**.

### 4B-3 — Stegvis ordning + prerequisite-gating

- **Vad:** Banking-flödet har 6 steg i stabil ordning. Steg som beror på tidigare visar **Blocked**-kort med röd ruta.
- **Hur:**
  1. Med tom state, öppna Banking-flödet.
  2. Skanna stegen.
- **Förväntat:**
  - **1. Have your address registration done** — Ready (○) eller Blocked om reg-population skipped.
  - **2. Have passport + permit + proof of address on you** — **Blocked** (rose-ikon) med rosa ruta *"Blocked: Complete first: Have your address registration done"*.
  - **3. Bring the signed employment contract** — Ready (kräver inget).
  - **4. Open the destination bank account** — **Blocked** *"Complete first: Have your address registration done, Have passport + permit…"*
  - **5. Enroll BankID / digital ID** — **Blocked**.
  - **6. Hand IBAN to employer for payroll** — **Blocked**.

### 4B-4 — Healthcare-flödet har 4 base steg + 2 conditional

- **Vad:** Healthcare-flödet har address-registered → health-card → primary-care-clinic → emergency-numbers, plus prescription-transfer (om profile.prescription_medications) och pediatric-registration (om children > 0).
- **Hur:**
  1. Sätt `prescription_medications="yes"` + `children_count=2`.
- **Förväntat:**
  - 6 steg synliga: address-registered, health-card, primary-care-clinic, prescription-transfer, pediatric-registration, emergency-numbers.
  - Tag bort flaggorna → 4 base-steg kvar (prescription + pediatric försvinner).

### 4B-5 — "Current step"-highlight på första non-completed

- **Vad:** Det första steget som inte är completed/N-A är markerat som **Current step** med indigo-ring + pill.
- **Hur:**
  1. Markera reg-population som completed.
  2. Skanna Banking-flödet.
- **Förväntat:**
  - Steg 1 (address-registered): completed (✓ + line-through).
  - Steg 2 (id-ready): **Current step**-pill (indigo) + ring + Play-ikon ▶.
  - Övriga steg: ready/blocked utan highlight.

### 4B-6 — "Why this step"-rad är flow-anchored

- **Vad:** Varje steg har en **"Why this step: …"**-rad med Clock-ikon. Förklaringen refererar flödet, inte tasken.
- **Hur:**
  1. Skanna Banking-stegen.
- **Förväntat:** Texterna säger t.ex. *"Most destination banks require proof of registration…"*, *"Banks run a hard KYC check at the branch. Photos on a phone don't count"*, *"This is the actual goal — without a destination IBAN salary can't land"*.
- **Inga** generiska "this is required" / "important step".

### 4B-7 — "Next:"-rad + "View task"-deep-link

- **Vad:** Steg som har `nextAction` visar en italic *"Next: …"*-rad. Steg med `relatedTaskRef` visar en **"View task →"**-länk till checklistan.
- **Hur:**
  1. Öppna Banking-flödet.
  2. Hover/skanna steg 2 (id-ready).
- **Förväntat:**
  - *"Next: Pack passport, residence-permit decision, and your housing contract before the appointment."*
  - "View task →" länkar till `/checklist?tab=post-move`.

### 4B-8 — Status-derivation från task + vault

- **Vad:** Steg-status pluggar in på två signaler:
  - `relatedTaskRef` → settling-task status.
  - `vaultCoverageOf` → vault-kategori coverage (employment, passport_id).
- **Hur:**
  1. Markera **bank-account-open** task = completed (men inte BankID/payroll-tasks).
  2. Reload.
- **Förväntat:**
  - Steg "Open the destination bank account" → **Completed** (✓).
  - Steg "Enroll BankID" + "Payroll routing" är nu **Ready** (deras prerequisite uppfylld).
- För vault: ladda upp passport-doc → steg 2 (id-ready) flippar till completed.

### 4B-9 — "X / Y done"-räknare

- **Vad:** Per flow visas räknare uppe till höger.
- **Hur:**
  1. Sätt 2 av 6 banking-steg till completed.
- **Förväntat:**
  - Banking-kortet visar **"2 / 6 done"**.
  - När alla är done: **"6 / 6 done"** + status-pill "Completed".

### 4B-10 — Inte 4C/4D-djup

- **Vad:** Flödena ska inte gle in i insurance / cultural / banking-product-comparison.
- **Hur:**
  1. Skanna texten i båda flow-korten.
- **Förväntat:** Inga fraser som "compare insurance providers", "cultural integration", "banking products comparison". Phrasingen håller sig till "open a bank account" / "register at a clinic".

---

## Phase 4C — Driver's licence + insurance guidance

Tester här verifierar att dashboarden nu visar två advisory-kort som hjälper
användaren förstå "behöver jag agera och i vilken ordning".

### 4C-1 — "Driver's licence & insurance"-sektion finns

- **Vad:** Sektion under setup-flows på `/dashboard`.
- **Hur:**
  1. Logga in. Gå till `/dashboard`. Skrolla under banking/healthcare.
- **Förväntat:**
  - Rubrik **"Driver's licence & insurance"** + subtitle om "two often-missed pieces".
  - Två kort: **Driver's licence** (Car-ikon, indigo) + **Insurance** (ShieldCheck, emerald).
  - Italic-rad i botten: *"Guidance is state-driven, not legal advice…"*

### 4C-2 — Driver's licence reagerar på driver_license_origin

- **Vad:** Status flippas baserat på state.
- **Hur:**
  1. Sätt `driver_license_origin = "no"` + `bringing_vehicle = "no"` → status **"Not required"** + urgency **"No action"** (emerald).
  2. Sätt `driver_license_origin = "yes"` + Filipino → Sweden (non-EU) → status **"Action needed"** (amber) + urgency **"First 30 days"**.
  3. Sätt `driver_license_origin = "yes"` + Swedish → Germany (EU/EU) → status **"Likely fine"** (emerald) + urgency **"Later"**.
- **Förväntat:** Pillarna byter färg och text exakt enligt state.

### 4C-3 — Recommended action + reasoning bullets

- **Vad:** Varje status visar konkreta reasoning-bullets + en next-step-rad.
- **Hur:**
  1. Sätt non-EU + driver_license_origin=yes.
- **Förväntat:**
  - "Why we landed here"-rubrik + 3 bullets om grace-period, insurance void etc.
  - **Next:** *"Open the transit-license task and start the exchange application — the round-trip is typically 4-6 weeks."*
  - **"View task →"**-länk till `/checklist?tab=post-move`.

### 4C-4 — Conversion-task=completed → status flippar till "Likely fine"

- **Vad:** När transit-license-tasken är completed, status visas inte längre som "Action needed".
- **Hur:**
  1. Markera `transit-license`-tasken som completed.
- **Förväntat:**
  - Status-pill: **"Likely fine"**.
  - Reasoning innehåller "transit-license task is marked completed".
  - Recommended action saknas (null).

### 4C-5 — Insurance card visar Top-priority-pill

- **Vad:** Insurance-kortets header visar "Top: <urgency>" baserat på första item.
- **Hur:**
  1. Pre-arrival state utan health-card i vault.
- **Förväntat:**
  - Rubriken har en pill **"Top: Act now"** (rose) bredvid "Insurance".
  - Första item är travel/bridge health insurance med Must-have-pill.

### 4C-6 — Items conditional på state

- **Vad:** Insurance items dyker upp och försvinner baserat på state.
- **Hur:**
  1. **bringing_vehicle="yes"** → **"Vehicle insurance"**-item dyker upp (Must-have, First 30 days).
  2. **pets="cat"** → **"Pet insurance"**-item dyker upp (Recommended, Later).
  3. Tag bort flaggorna → respektive item försvinner.

### 4C-7 — Sortering: now → first_30d → later

- **Vad:** Items sorteras efter urgency desc + priority desc.
- **Hur:**
  1. Skanna ordningen i Insurance-kortet med flera items synliga.
- **Förväntat:**
  - Allra först: items med urgency="now" (Travel/bridge, public health card).
  - Sen: first_30d (housing, vehicle).
  - Sen: later (pet).
  - Inom samma urgency: must_have före recommended före optional.

### 4C-8 — Stage=arrived + health-card task=completed → public-health-item försvinner

- **Vad:** När health-card är completed, insurance-blocket tar bort just det item:t.
- **Hur:**
  1. Sätt stage="arrived" + ladda upp en health_insurance-doc i vault.
  2. Markera `health-card`-tasken som completed.
- **Förväntat:**
  - "Public health-insurance enrolment"-item är borta.
  - "Travel + bridge health insurance"-item är också borta (eftersom kortet finns).
  - "Home / contents insurance" är fortfarande kvar (inte completed).

### 4C-9 — Each item visar Why + Next + ev. View task

- **Vad:** Item-kortet är inte bara label.
- **Hur:**
  1. Granska ett item-kort i Insurance.
- **Förväntat:**
  - Label + Priority-pill + Urgency-pill.
  - **"Why: …"** rad med state-anchored reasoning.
  - **"Next: …"** rad med konkret action.
  - "View task →" om relatedTaskRef finns (t.ex. på public-health-card och home-contents).

### 4C-10 — Inte 4D-djup eller marketplace

- **Vad:** Ingen marketplace, partner, eller cultural drift.
- **Hur:** Skanna section-text.
- **Förväntat:**
  - Inga fraser som "compare insurance products", "best provider", "affiliate", "find the cheapest", "cultural integration".
  - Phrasingen håller sig till "buy 90-day travel insurance", "sign up online once you have…", "compare 2-3 destination pet insurers".

---

## Förväntat misslyckande / kända begränsningar

- Tasks utan authored walkthrough (housing-utilities, ID-card, salary-setup,
  union, m.fl.) visar empty-state. Det är **avsett**, inte en bugg.
- Om planen är i `arrived`-stage men `settling_in_tasks`-rader är från före
  Phase 1B är `walkthrough`-kolumnen `null` → Sheet:en visar empty-state även
  för Skatteverket-tasken. Lös genom att regenerera DAG:n: kalla på
  `POST /api/settling-in/arrive` med samma `arrivalDate` (eller via UI:n när
  vi byggt det).

---

## Phase 4D — Cultural orientation layer

**Vad är detta:** En "How everyday systems actually work"-sektion på dashboarden. Hand-författade orientation-topics (systems-cascade, everyday-apps, address-logic, healthcare-practice, housing-culture, common-pitfalls, family-school-cadence, pet-everyday). Sorterade på phase: `first_72h` → `any_time` → `first_30d` → `later`. Varje topic har category-badge, phase-badge, summary, "Why this matters", do/don't-takeaways. Det är **inte** en country guide, **inte** turist-content och **inte** marknadsplats.

**Förkrav:**
- API-server kör på `:3002` med `/api/orientation` mountad.
- Användaren har en aktiv `relocation_plan` (annars 404).

### Test 4D.1 — sektionen finns på dashboarden

1. Gå in på `/dashboard`. Scrolla ner förbi `License + insurance`.
2. Förvänta: en sektion med rubriken `Cultural orientation` (data-testid `orientation-section`, heading `orientation-heading`).
3. Beskrivningstexten ska innehålla "How everyday systems actually work".

### Test 4D.2 — minst 6 topics renderas (default-profil)

1. Med profil utan barn / utan husdjur / utan `origin_lease_status="renting"`: räkna `[data-testid^="orientation-topic-"]`.
2. Förvänta: 6 topics: `systems-cascade`, `everyday-apps`, `address-logic`, `healthcare-practice`, `common-pitfalls`. (housing-culture, family-school-cadence och pet-everyday är gated.)

### Test 4D.3 — housing-culture syns enbart vid `origin_lease_status === "renting"`

1. Sätt `profile_data.origin_lease_status = "renting"` på `relocation_plans`.
2. Förvänta: `[data-testid="orientation-topic-orient:housing-culture"]` finns.
3. Sätt `origin_lease_status` till `null`. Förvänta: housing-topicen saknas.

### Test 4D.4 — family-school-cadence kräver `children_count > 0`

1. Sätt `profile_data.children_count = 0`. Förvänta: `orient:family-school-cadence` saknas.
2. Sätt `children_count = 2`. Förvänta: topicen finns och renderas under category `Systems`.

### Test 4D.5 — pet-everyday kräver pets-flagga

1. `pets = "none"` → topicen `orient:pet-everyday` saknas.
2. `pets = "dog"` → topicen finns.

### Test 4D.6 — sortering på phase

1. Hämta `[data-testid^="orientation-topic-"]` i renderingsordning, läs `data-orientation-phase`.
2. Förvänta-mönster: alla `first_72h`-topics före första `any_time`, som ligger före första `first_30d`. Inga `first_72h`-topics efter en `first_30d`-topic.

### Test 4D.7 — do/don't-takeaways har rätt visuell markering

1. På första topic, läs `[data-takeaway-kind="do"]` ska finnas och visa en grön check-ikon (lucide `Check`).
2. `[data-takeaway-kind="dont"]` ska visa en röd X-ikon (lucide `X`).
3. Båda kinds ska finnas på `orient:common-pitfalls`.

### Test 4D.8 — filter-pillar fungerar

1. Klicka på "First 72h"-pillen i `[data-testid="orientation-filter"]`.
2. Förvänta: bara topics med `data-orientation-phase="first_72h"` eller `"any_time"` är synliga.
3. Klicka "All". Förvänta: alla topics tillbaka.

### Test 4D.9 — inget marknadsplats- eller fluff-innehåll

1. Sök i sektionens DOM-text efter banned termer: `Numbeo`, `SafetyWing`, `Cigna Global`, `Wise`, `Revolut`, `affiliate`, `partner offer`, `book now`, `sign up`.
2. Förvänta: 0 träffar. (Jämför med Test 4C.10.)
3. Sök efter content-marketing-termer: `fun fact`, `did you know`, `tip of the day`. Förvänta: 0 träffar.

### Test 4D.10 — ingen 500/error från API:t med tom profil

1. Ny användare → tom profil_data → `GET /api/orientation`.
2. Förvänta: HTTP 200 med en `topics`-array (default 5 topics: alla utom housing-culture, family-school-cadence, pet-everyday).

### Vanliga problem

- **Topics saknas** → kontrollera att profile-flaggorna i `relocation_plans.profile_data` är skrivna med rätt nyckel: `origin_lease_status`, `children_count`, `pets`. Loosa typer: `children_count` kan vara siffra eller string, men `pets="none"` döljer pet-topicen.
- **Marknadsföringsord smyger sig in** → orientation-topicen är hand-författad i `lib/agents/src/orientation.ts`. Lägg aldrig till brand names i `practicalTakeaways`. Använd kategorier ("national digital-ID app"), inte "BankID / itsme / DigiD".
- **Sektionen kraschar med 404** → användaren saknar aktiv `relocation_plan`. Komponenten skall i så fall visa empty-state, inte error.

---

## Phase 5A — Housing support

**Vad är detta:** Beslutsstöd för att hitta bostad, inte en marknadsplats. Fem block: budget-rimlighet, timing, search-source-kategorier, processgenomgång (search → viewing → application → contract → deposit → move-in), och scam-flaggor. State-driven på `destination`, `target_city`, `monthly_budget`/`rental_budget_max`, och `arrival_date`.

**Förkrav:**
- API-server kör på `:3002` med `/api/housing-support` mountad.
- Användaren har en aktiv `relocation_plan` (annars 404).

### Test 5A.1 — sektionen finns på dashboarden

1. Gå in på `/dashboard`. Scrolla ner förbi `Cultural orientation`.
2. Förvänta: en sektion `Housing support` med data-testid `housing-support-section`, heading `housing-support-heading`.
3. Beskrivningstexten ska innehålla "Practical decision support".

### Test 5A.2 — fem sub-block renderas

1. Förvänta dessa testid:n:
   - `housing-budget-card`
   - `housing-timing-card`
   - `housing-search-card`
   - `housing-process-card`
   - `housing-scams-card`
2. Var och en ska innehålla minst en synlig rubrik: "Budget reasonableness", "When to start", "Where to search", "How the process works", "Red flags + scam patterns".

### Test 5A.3 — budget-verdict reagerar på state

1. Sätt `profile_data.destination = "Sweden"`, `monthly_budget = "500 EUR"`, `arrival_date` 60 dagar fram.
2. Förvänta: `housing-budget-card` har `data-budget-verdict="unrealistic"` och meddelandet nämner "well below" + "Sweden" + €1300+.
3. Sätt `monthly_budget = "1500 EUR"`. Förvänta: `data-budget-verdict="comfortable"` eller `tight`.
4. Sätt `monthly_budget = ""` (eller ta bort fältet). Förvänta: `data-budget-verdict="no_user_budget"` med uppmaning att lägga in budget.

### Test 5A.4 — timing-urgency reagerar på arrival_date

1. `arrival_date` 12+ veckor fram → `data-timing-urgency="ahead"` eller `on_track`, message nämner antal veckor.
2. `arrival_date` 4 veckor fram → `data-timing-urgency="start_now"`, "Apply to listings the day they appear".
3. `arrival_date` 2 veckor fram → `data-timing-urgency="behind"`, rekommenderar 1–3 månaders sublet.
4. `arrival_date` -5 dagar (redan ankommit) → `data-timing-urgency="post_arrival"`.

### Test 5A.5 — search guidance per destination

1. `destination = "Sweden"` → search-card har minst dessa namn i examples: `Hemnet`, `Blocket Bostad`, `Qasa`, `Hyresgästföreningen`.
2. `destination = "Germany"` → `ImmobilienScout24`, `WG-Gesucht`, `SCHUFA` nämns någonstans.
3. `destination = "Mongolia"` (okänd för vår lookup) → kort med generiska beskrivningar utan brand-namn.

### Test 5A.6 — process visar 6 steg med bottlenecks

1. Förvänta: 6 `[data-testid^="housing-process-"]`-noder med IDs `search-and-shortlist`, `viewings`, `background-check`, `contract-signing`, `deposit-and-payment`, `move-in-inspection`.
2. För `destination = "Germany"`: `housing-bottleneck-background-check` ska nämna "SCHUFA".
3. För `destination = "Sweden"`: `housing-bottleneck-search-and-shortlist` ska nämna "first-hand queue" eller "andrahand".

### Test 5A.7 — scams-block har minst 4 varningar

1. Räkna `[data-testid^="housing-scam-"]`. Förvänta: ≥6.
2. Minst 3 ska ha `data-scam-severity="high"`.
3. Texterna ska innehålla orden "viewing", "wire" eller "deposit", "Western Union" eller "crypto".

### Test 5A.8 — ingen marketplace-/affiliate-drift

1. Sök i sektionens DOM-text efter banned termer: `affiliate`, `partner offer`, `book now`, `apply via us`, `we recommend`, `find a broker on`, `referral`, `commission`, `sponsored`.
2. Förvänta: 0 träffar.
3. Inga "Hemnet"-länkar med utm-parametrar — examples är ren orientation-text.

### Test 5A.9 — ingen 4D/5B/5C-drift

1. Sök efter cultural-orientation-termer som inte hör hemma i 5A: `national digital-id app`, `peer-payment app`, `out-of-hours line`, `repatriation`, `pet relocation`, `microchip`.
2. Förvänta: 0 träffar.

### Test 5A.10 — destination okänd → fallback ärlig

1. Sätt `destination = "Vanuatu"`, `monthly_budget = "1000 EUR"`.
2. Förvänta: `data-budget-verdict="no_data"`, reasoning nämner "no destination band on file".
3. Search-card ska fortfarande visa minst 4 generiska källor (national_aggregator, tenant_union, expat_board, subletting).

### Vanliga problem

- **Search-examples saknas för vissa länder** → tillåtet i v1; bara 8 destinationer har egen lookup. Lägg till nya i `DESTINATIONS`-arrayen i `lib/agents/src/housing-support.ts`. Inga affiliate-länkar — bara namn.
- **Budget visas i fel valuta** → `parseBudget()` trimmar enheter (EUR/USD/GBP/SEK/DKK/NOK/CHF/CAD/AUD + symboler `€$£`). Om profilen har `"2500"` utan currency antas EUR.
- **Timing säger fel grej** → `recommendedStartWeeksBefore` är 8 default, override per destination (Sweden/Ireland/NL = 8-10, Spain/UK = 6).
- **Sektionen visar empty-state** → kontrollera att `arrival_date` eller `monthly_budget` är skrivna i `relocation_plans.profile_data`. Empty är OK fallback.

---

## Phase 5B — Departure / repatriation flow

**Vad är detta:** Beslutsstöd för att stänga ner origin-livet (eller senare destination-livet) på ett ordnat sätt. Fyra block: timing (hur mycket tid kvar, brådska), cancel-items (privatkontrakt: lease, utilities, subscriptions, insurance, memberships), deregister-items (myndigheter, register, mail forwarding) och belongings (take/sell/store/donate/dispose per kategori).

**Förkrav:**
- API-server kör på `:3002` med `/api/departure-flow` mountad.
- Användaren har en aktiv `relocation_plan` (annars 404).

### Test 5B.1 — sektionen finns på dashboarden

1. Gå in på `/dashboard`. Scrolla ner förbi `Housing support`.
2. Förvänta: en sektion med `data-testid="departure-flow-section"`, heading `departure-flow-heading`, rubrik som börjar med "Closing down …".
3. Beskrivningstexten ska innehålla "Cancel, deregister, and decide what to do with your stuff".

### Test 5B.2 — fyra sub-block renderas

1. Förvänta dessa testid:n:
   - `departure-timing-card`
   - `departure-cancel-card`
   - `departure-deregister-card`
   - `departure-belongings-card`
2. Var och en har en synlig rubrik: "When you leave", "Cancel", "Deregister + notify", "What to do with your stuff".

### Test 5B.3 — timing-urgency reagerar på arrival_date

1. `arrival_date` 16+ veckor fram → `data-departure-urgency="early"`.
2. `arrival_date` 10 veckor fram → `data-departure-urgency="on_track"`.
3. `arrival_date` 6 veckor fram (mellan 4 och leaseNoticeWeeks=8) → `compressed`.
4. `arrival_date` 2 veckor fram → `very_late`.
5. `arrival_date` -5 dagar (redan ankommit) → `post_departure`, message nämner "tax filing, mail forwarding".

### Test 5B.4 — lease-cancel gating på origin_lease_status

1. `profile_data.origin_lease_status = "renting"` → `departure-cancel-cancel:lease-rental`-item synlig.
2. `origin_lease_status = "owning"` → `departure-cancel-cancel:property-decision`-item synlig (inte rental-item).
3. `origin_lease_status = "neither"` → varken lease-rental eller property-decision visas.

### Test 5B.5 — vehicle-gating

1. `bringing_vehicle = "no"` → varken `departure-cancel-cancel:auto-insurance` eller `departure-deregister-dereg:vehicle` visas.
2. `bringing_vehicle = "yes"` → båda visas.
3. `bringing_vehicle = "selling"` → båda visas.

### Test 5B.6 — sortering på whenToAct

1. Hämta `[data-testid^="departure-cancel-cancel:"]` och läs varje `data-cancel-when`.
2. Förvänta-mönster: `now` före `8w_before`, `8w_before` före `4w_before`, etc. Inga `now`-items efter ett `4w_before`-item.

### Test 5B.7 — deregister markerar deregistration vs notification

1. `departure-deregister-dereg:population-register` har `data-deregister-isDeregistration="true"`.
2. `departure-deregister-dereg:tax-authority` har `data-deregister-isDeregistration="false"` (det är en notification, inte en deregistration).
3. `departure-deregister-dereg:mail-forwarding` har `data-deregister-isDeregistration="false"` och visar badge `Notification`.

### Test 5B.8 — belongings har minst 6 kategorier

1. Räkna `[data-testid^="departure-belongings-bel:"]`. Förvänta: ≥6 (vehicles är gated).
2. Varje kort har minst en action-badge (data-testid `belongings-action-…-take`/sell/store/donate/dispose).
3. `bel:documents` har primär action `take`. `bel:furniture` har primär action `sell`. `bel:sentimental` har `take` eller `store`.

### Test 5B.9 — vehicle-belongings gating

1. Utan vehicle → `[data-testid="departure-belongings-bel:vehicles"]` finns inte.
2. `bringing_vehicle = "yes"` → kategorin visas.

### Test 5B.10 — ingen marketplace/partner-drift

1. Sök i sektionens DOM-text efter banned termer: `affiliate`, `partner offer`, `book a mover`, `sponsored`, `partner with`, `commission`, `referral`, `we recommend`, `request a quote`.
2. Förvänta: 0 träffar.

### Test 5B.11 — ingen 5C-drift

1. Sök efter pet-relocation-termer: `microchip`, `rabies titer`, `pet passport`, `pet quarantine`, `IATA cargo crate`.
2. Förvänta: 0 träffar.

### Vanliga problem

- **"Closing down origin" känns generisk** → om `current_location` saknas faller heading tillbaka på generisk "origin". Sätt `current_location` i profilen för att få "Closing down Sverige" t.ex.
- **Lease-rental visas trots att man äger** → kontrollera `relocation_plans.profile_data.origin_lease_status` — strängen måste vara exakt `"renting"` eller `"owning"`.
- **Tax-authority försvinner** → bara om `departure_tax_filing_required === "no"`. Default är att visa det (de flesta nyanlända behöver hantera origin-årets deklaration).
- **Vehicle-block syns när jag inte har bil** → kolla `bringing_vehicle`-fältet, det matchas case-insensitive på "yes"/"selling"/"exporting" (eller liknande). Saknat eller "no"/"none" döljer.
- **post_departure renderar tom timing-grid** → milestones renderas alltid, men message+nextStep ändras till backward-looking guidance ("focus on tax filing + mail forwarding").

---

## Phase 5C — Pet relocation

**Vad är detta:** Beslutsstöd för att relokera husdjur internationellt. Fem block: pet summary, microchip-guidance (med ordnings-regel "chip BEFORE rabies"), vaccination-guidance (status, post-vaccine wait, common gap), import-rule-guidance (per destination-region: EU / UK / USA / Canada / AU-NZ / rabies-free / generic), transport-guidance (cabin vs cargo + breed/season-warnings), och timeline (T-26w för AU/NZ, T-12w/T-8w/T-4w/T-2w/T-1w/move-day/post-arrival för övriga).

Sektionen är gated på `profile.pets`: när `pets` är `none` / `no` / saknas visas en kort empty-state-invite. När pets är satt visas hela layern.

**Förkrav:**
- API-server kör på `:3002` med `/api/pet-relocation` mountad.
- Användaren har en aktiv `relocation_plan`.

### Test 5C.1 — empty-state utan pets

1. Sätt `profile_data.pets = "none"` (eller ta bort fältet) i `relocation_plans`.
2. Gå till `/dashboard`. Förvänta: sektion `pet-relocation-section` med `data-pet-state="empty"`, heading "Pet relocation", text "No pets on file." + invite att lägga till pet i profilen.
3. Inga av sub-cards (microchip / vaccination / import / transport / timeline) ska finnas i DOM:n.

### Test 5C.2 — full layer när pets är satt

1. Sätt `pets = "dog"`. Refresh.
2. Förvänta: `data-pet-state="active"`, samt alla dessa testid:n synliga:
   - `pet-summary-card`, `pet-microchip-card`, `pet-vaccination-card`, `pet-import-card`, `pet-transport-card`, `pet-timeline-card`.
3. Pet-summary visar `dog` som badge.

### Test 5C.3 — microchip-status reagerar på state

1. `pet_microchip_status = "no"` → microchip-card har `data-microchip-status="missing"` + `data-microchip-urgency="now"`. Message nämner "first compliance step".
2. `pet_microchip_status = "yes"` → `data-microchip-status="in_place"`, `urgency="complete"`.
3. `pet_microchip_status = "outdated"` → `data-microchip-status="outdated"`, `urgency="soon"`, message nämner "non-ISO".
4. Tomt → `data-microchip-status="unknown"`, `urgency="soon"`.

### Test 5C.4 — ordnings-regeln "chip BEFORE rabies" är synlig

1. På microchip-cardet, hitta `[data-testid="pet-microchip-ordering-rule"]`.
2. Texten ska innehålla orden "before" + "rabies" + "redone" (eller liknande).

### Test 5C.5 — vaccination-status reagerar

1. `pet_vaccination_status = "current"` → `data-vaccination-status="current"`, `urgency="complete"`.
2. `pet_vaccination_status = "outdated"` → `urgency="soon"`, "Vaccinations have lapsed".
3. `pet_vaccination_status = "starting"` → `urgency="now"`, "not yet on file".
4. `postVaccineWaitDays` ska vara 21 för EU/UK/USA, 30 för Australia eller Iceland.

### Test 5C.6 — import-rule per destination

1. `destination = "Sweden"` → `[data-testid="pet-import-card"]` har `data-rule-profile="eu"`. keyChecks-listan ska innehålla orden "ISO 11784/11785", "rabies", "21-day", "EU pet passport".
2. `destination = "United Kingdom"` → `data-rule-profile="uk"`, keyChecks nämner "AHC" + "tapeworm".
3. `destination = "Australia"` → `data-rule-profile="australia_nz"`, keyChecks nämner "RNATT" + "180-day", `minimumLeadTimeWeeks ≥ 26`.
4. `destination = "Mongolia"` (okänd) → `data-rule-profile="generic"`, keyChecks generiska utan specifika countries.

### Test 5C.7 — snub-nosed breed-varning

1. `pet_breed = "Pug"` (eller "Bulldog", "Persian", "Boston Terrier" etc) → pet-summary visar "Snub-nosed breed"-badge (rose).
2. Transport-card har `[data-testid="pet-transport-breed-warning"]` synlig med text om "heat-sensitive" / "refuse cargo".
3. `pet_breed = "Labrador"` → ingen breed-warning.

### Test 5C.8 — transport mode

1. `pet_size_weight = "small"` eller "5 kg" → `data-transport-mode="cabin"`.
2. `pet_size_weight = "large"` eller "40 kg" → `data-transport-mode="cargo"`.
3. Tomt eller "medium" → `data-transport-mode="unknown"`.

### Test 5C.9 — timeline T-26w gäller bara AU/NZ + rabies-free

1. `destination = "Sweden"` → `pet-timeline-T-26w` finns INTE.
2. `destination = "Australia"` → `pet-timeline-T-26w` finns och nämner "RNATT" / "180-day" / "titer".
3. `destination = "Iceland"` → `pet-timeline-T-26w` finns.

### Test 5C.10 — timeline passed/behind reagerar på arrival

1. `arrival_date` i framtiden, +12 veckor: timeline-phases T-12w och tidigare har `data-phase-passed="false"` och `data-phase-behind="false"`.
2. `arrival_date` +5 veckor: T-12w och T-8w har `data-phase-behind="true"`.
3. `arrival_date` -10 dagar: alla phases har `data-phase-passed="true"`.

### Test 5C.11 — ingen marketplace/affiliate-drift

1. Sök i sektionens DOM-text efter banned termer: `book a pet mover`, `compare pet movers`, `pet relocation service`, `affiliate`, `partner offer`, `commission`, `we recommend`, `sponsored`, `pet insurance comparison`, `find a vet near you`.
2. Förvänta: 0 träffar.

### Test 5C.12 — ingen Phase 6-drift

1. Sök efter Phase 6-termer: `notification preferences`, `family reunification`, `tax overview`, `rule-change monitoring`.
2. Förvänta: 0 träffar.

### Vanliga problem

- **Empty state visas trots husdjur** → kontrollera att `relocation_plans.profile_data.pets` är skrivet exakt — inte `null`, inte `""`, och inte `"none"`/`"no"`. Värden som `"dog"`, `"cat"`, `"two cats"` triggar full layer.
- **Microchip status felaktig** → `pet_microchip_status` läses case-insensitive. `"yes"` / `"in_place"` / `"iso"` / `"compliant"` blir `in_place`. `"no"` / `"missing"` / `"none"` blir `missing`. `"outdated"` / `"non_iso"` blir `outdated`.
- **Wrong destination profile** → text-match är substring-baserad. `"Sweden"` ger EU; `"UK"` / `"England"` ger UK. För custom mapping, lägg till i `RULE_TABLE` i `lib/agents/src/pet-relocation.ts`.
- **Snub-nosed-warning saknas** → `pet_breed` matchas case-insensitive mot en lista (bulldog, pug, boxer, boston terrier, shih tzu, lhasa, pekingese, chow chow, cane corso, persian, himalayan, exotic shorthair, british shorthair, burmese).
- **Timeline T-26w saknas för AU** → Timeline-T-26w renderas bara när `destinationProfile === "australia_nz"` eller `"rabies_free"`.

---

## Phase 6A — Notifications

**Vad är detta:** Första riktiga proaktiva nudging-lagret. State-driven trigger-logik som tittar på settling-in-tasks, pre-departure-actions, dokument i vault, risker och arrival-window — och beslutar vad användaren behöver höra om JUST NU. Levereras via in-app-bell i dashboardens top-right + Sheet-panel med listan. Modellen är extensible för email senare.

Fem trigger-typer:
- `deadline_overdue` — task overdue (severity `urgent`).
- `deadline_now` — task due today/tomorrow/this week (severity `nudge`).
- `document_missing` — task kräver dokument-kategori som inte finns i vaulten (severity `nudge` eller `urgent` om task overdue).
- `risk_blocker` — högsta risk-severity i `research_meta.risks` (severity `urgent`).
- `arrival_imminent` — arrival inom 7 dagar med kvarvarande pre-move tasks (severity `urgent`).

Persistens: `relocation_plans.research_meta.notifications` (JSONB array). Inget separat tabell-schema — single-applicant-scope.

**Förkrav:**
- API-server kör på `:3002` med `/api/notifications` mountad.
- Användaren har en aktiv `relocation_plan`.

### Test 6A.1 — bell finns på dashboarden

1. Gå till `/dashboard`. Hitta top-right-knappen `[data-testid="notification-bell"]`.
2. Klicka. Förvänta: en `Sheet` öppnas med rubriken "Notifications".
3. Om inga notifications finns ska `[data-testid="notification-empty-state"]` visas med "All caught up".

### Test 6A.2 — overdue task triggar urgent notification

1. Skapa eller patcha en `settling_in_tasks`-rad så `deadline_at` är 5 dagar tillbaka och `status="available"`.
2. Anropa `POST /api/notifications/sync`. Förvänta: payload har minst en notification med `type="deadline_overdue"`, `severity="urgent"`.
3. I UI: bell visar rose-tonad badge med antal unread, klick öppnar Sheet, och raden har `data-notification-severity="urgent"`.

### Test 6A.3 — task due today/tomorrow triggar nudge

1. Patcha task så `deadline_at` är +1 dag.
2. Sync. Förvänta: notification med `type="deadline_now"`, `severity="nudge"`. Badge är amber (inte rose).

### Test 6A.4 — document missing triggar nudge

1. Skapa task med `documents_needed=["passport"]`, `deadline_at` +5 dagar, `status="available"`.
2. Säkerställ att vaulten saknar dokument i kategorin `passport`.
3. Sync. Förvänta: notification med `type="document_missing"`, target_route `/vault`.
4. Ladda upp ett dokument med `category="passport"`. Sync igen. Förvänta: notificationen försvinner ur listan (dedupe-key matchas inte längre + den hade ingen user-action → auto-removed).

### Test 6A.5 — risk_blocker triggar bara på "critical"

1. Sätt `relocation_plans.research_meta.risks = [{id:"r1", severity:"warning", title:"…"}]` → ingen notification.
2. Sätt `severity:"critical"` → notification med `type="risk_blocker"`.

### Test 6A.6 — arrival_imminent fires bara om <7 dagar + open pre-move tasks

1. `arrival_date = +14d` → ingen `arrival_imminent`-notification.
2. `arrival_date = +5d` + minst en pre-move task med `status="available"` → notification triggas.
3. `arrival_date = +5d` men alla pre-move tasks `completed` → ingen notification.

### Test 6A.7 — idempotens (samma sync ger inga duplikat)

1. Sync → notera `notifications.length`.
2. Sync igen utan att ändra state → samma `notifications.length`. Inga nya entries.
3. Verifiera via `relocation_plans.research_meta.notifications` att längden är stabil.

### Test 6A.8 — mark read + dismiss

1. Sync så minst en notification finns. I UI: klicka "Mark read" på en rad → `data-notification-status` ändras till `"read"`, badge-räknaren minskar med 1.
2. Klicka "Dismiss" på en rad → `data-notification-status="dismissed"`, raden flyttas till "Dismissed (n)"-summary-blocket nederst.
3. "Mark all read" knappen visas bara när det finns minst en unread.

### Test 6A.9 — notification klick navigerar till target_route

1. Klicka på en `deadline_now`-notifications titel. Förvänta: Sheet stängs och URL ändras till `/checklist?tab=post-move` (eller `/checklist?tab=pre-move` för pre-departure-tasks).
2. Klicka på `document_missing` → URL ändras till `/vault`.

### Test 6A.10 — counts stämmer

1. `GET /api/notifications` → `counts.total` ≥ `counts.unread` ≥ `counts.urgentUnread`.
2. Bell-badge text matchar `counts.unread` (eller `99+` om >99).

### Test 6A.11 — ingen 6B/6C/6D-drift

1. Sök i sektionen efter banned termer: `family member`, `dependents`, `tax overview`, `rule changed`, `rule update notification`.
2. Förvänta: 0 träffar (dessa hör hemma i 6B/6C/6D).

### Test 6A.12.0 — urgenta triggers ges email-kanal automatiskt

1. Triggar en urgent notification (overdue task / risk_blocker / arrival_imminent). Sync.
2. Förvänta: `notification.channel === "email"`, inte `"in_app"`. Body innehåller även en länk till `PUBLIC_APP_BASE_URL + targetRoute` när email faktiskt går ut.
3. Triggar en nudge-notification (task due in 3 days). Förvänta: `channel === "in_app"`. Inga email-attempts för nudges.

### Test 6A.12.1 — email-dispatcher körs (audit_only-default)

1. Utan `RESEND_API_KEY` satt, sync med en urgent overdue-task. Kontrollera `relocation_plans.research_meta.notification_deliveries`-arrayen.
2. Förvänta: minst en `DispatchAttempt` med `channel="email"`, `mode="audit_only"`, `outcome="logged"`, `notificationId` matchar urgent-notifikationen.
3. Sync igen utan ny state-ändring → `notification_deliveries.length` ökar INTE (inga nya attempts; samma dedupe_key räknas som redan dispatchad).

### Test 6A.12.2 — manual scheduler-tick fyrar oberoende av dashboard

1. Skapa overdue-task. Anropa `POST /api/notifications/scheduler-tick` direkt.
2. Förvänta: `200 OK` med `stats: { plansScanned, notificationsCreated, emailsSent, emailsLogged, emailsErrored }`. `emailsLogged ≥ 1` (audit_only-default).
3. Inspektera `research_meta.notification_last_tick.at` — ny ISO-timestamp.
4. Inspektera `research_meta.notifications` — innehåller den urgenta notifikationen även om användaren inte har öppnat dashboarden.

### Test 6A.12.3 — live-mode skickas via Resend

1. Sätt `RESEND_API_KEY=<din-key>` + `EMAIL_FROM=hello@yourdomain.io` i env och starta om api-server.
2. Trigger urgent notification → sync.
3. Förvänta: `notification_deliveries[]` innehåller en attempt med `mode="live"`, `outcome="sent"`, och `providerMessageId` finns. Email kommer fram till `TEST_EMAIL`.

### Test 6A.12.4 — bakgrundsschemaläggare loggar tick-stats

1. Starta api-server med `NOTIFICATIONS_SCHEDULER_INTERVAL_MS=60000` (1 min).
2. Vänta 1 min utan att öppna dashboarden.
3. Kontrollera api-server-loggen → ska innehålla `"[notifications-scheduler] tick complete"` + stats-payload. Inspektera DB → `notification_last_tick.at` är färskt.

### Test 6A.13 — auto-archive efter 30 dagar

1. Patcha en stored notification så `lastUserActionAt` är 31 dagar gammal och dess underliggande trigger inte längre fyrar.
2. Sync. Förvänta: notification borttagen från listan.

### Vanliga problem

- **Sync ger 401 i Playwright** → cookie/auth-token saknas på request. Använd `page.evaluate(async () => { const r = await fetch("/api/notifications"); return r.json(); })` så använder fetch:en inloggade cookies.
- **Notifications dyker inte upp på dashboarden** → kontrollera att Bell-komponenten renderas i main-branch (med destination), inte welcome-branch. Bell finns bara där just nu.
- **deadline_at-format** — måste vara ISO-string (`2026-05-15T00:00:00Z`). Drizzle skriver normalt i rätt format.
- **Same dedupe_key fires om titlarna ändras** → det är korrekt; vi uppdaterar copy från senaste compute men behåller delivery + user-action state.
- **arrival_imminent fires inte** — kräver att tasks har `category` exakt `"pre_move"` eller `"pre_departure"`. Settling-in-tasks räknas inte som pre-move.

---

## Phase 6C — Year-1 tax overview

**Vad är detta:** Year-1 tax orientation. Inte tax engine, inte calculator, inte filing — bara strukturerad rådgivning som hjälper användaren förstå vad första skatteåret typiskt innebär. Fem block: yearOneSummary (regimespecifik 2-4-mening narrative), nextStep (one-action recommendation), checkpoints (likely obligations, gated by purpose/posting/origin), watchouts (severity-graderade pitfalls), disclaimer ("orientation, not advice").

State-driven på: `destination`, `current_location`, `citizenship`, `purpose`, `posting_or_secondment`, `departure_tax_filing_required`, `arrival_date`, `stage`. Pure code, deterministisk, INGA skattenummer/rate-gissningar.

Regime-profiler: `eu_residency_based`, `uk_srt`, `canada_residency_based`, `aunz_residency_based`, `generic` (med `us_citizenship_based` reserverat för framtid). Substring-match med exakt-match för korta aliaser (samma pattern som 5C).

**Förkrav:**
- API-server kör på `:3002` med `/api/tax-overview` mountad.
- Användaren har en aktiv `relocation_plan`.

### Test 6C.1 — sektionen finns på dashboarden

1. Gå till `/dashboard`. Förvänta `[data-testid="tax-overview-section"]` synligt, heading "Year-1 tax overview".
2. Beskrivningstexten ska innehålla "Practical orientation" + "Not tax advice".
3. Disclaimer-paragrafen `[data-testid="tax-disclaimer"]` ska finnas och innehålla orden "orientation" + "not tax advice" + "qualified" / "professional".

### Test 6C.2 — fem sub-block renderas

1. Förvänta dessa testid:n: `tax-summary-card`, `tax-next-step-card`, `tax-checkpoints-card`, `tax-watchouts-card`, plus disclaimer.
2. Regime-badge `[data-testid="tax-regime-badge"]` finns med korrekt label.

### Test 6C.3 — regime-detection per destination

1. `destination = "Sweden"` → `[data-testid="tax-summary-card"]` har `data-regime-profile="eu_residency_based"`. yearOneSummary nämner "183-day".
2. `destination = "United Kingdom"` → `data-regime-profile="uk_srt"`. yearOneSummary nämner "Statutory Residence Test" + "split-year".
3. `destination = "Canada"` → `data-regime-profile="canada_residency_based"`. yearOneSummary nämner "ties-test".
4. `destination = "Australia"` → `data-regime-profile="aunz_residency_based"`.
5. `destination = "Mongolia"` → `data-regime-profile="generic"`. yearOneSummary erkänner explicit avsaknad av destination-specifik framing.

### Test 6C.4 — checkpoints är gated av profil

1. `purpose = "settle"` (utan posting) → checkpoint `ck:tax-registration` + `ck:residency-clock` + `ck:year-one-declaration` synliga. `ck:employer-withholding` ska INTE finnas (purpose är inte work).
2. `purpose = "work"` → `ck:employer-withholding` dyker upp.
3. `posting_or_secondment = "yes"` → `ck:social-security-continuity` (A1/CoC) dyker upp.
4. `current_location` + `destination` båda satta → `ck:dual-residency-check` finns.
5. `departure_tax_filing_required = "no"` → `ck:departure-origin` försvinner. Inte satt eller "yes" → den finns kvar.

### Test 6C.5 — watchouts är gated och severity-graderade

1. Default state → minst `wo:tax-residence-trap`, `wo:split-year-handling`, `wo:year-end-calendar`, `wo:foreign-income-reporting` finns.
2. `purpose = "digital_nomad"` → `wo:tax-residence-trap` har `data-watchout-severity="high"` (annars `warning`).
3. `citizenship = "American"` (eller "US"/"USA") → `wo:us-citizenship-based-taxation` synlig med `severity="high"`.
4. `posting_or_secondment = "yes"` → `wo:social-security-continuity` finns.
5. `departure_tax_filing_required = "yes"` → `wo:departure-tax` finns.

### Test 6C.6 — nextStep reagerar på stage + arrival

1. `stage = "ready_for_pre_departure"` med `arrival_date = +60d` → `data-next-step-kind="talk_to_accountant"`, body nämner "before the move date locks".
2. Samma stage med `arrival_date = +20d` → fortfarande `talk_to_accountant`, body nämner "30-min cross-border tax call before you fly".
3. `stage = "arrived"` → `data-next-step-kind="register_destination"`, target_route `/checklist?tab=post-move`.
4. `stage = "settling_in"` eller `"complete"` → `data-next-step-kind="track_residency_days"`.

### Test 6C.7 — INGEN falsk numerisk precision

1. Sök i hela sektionens DOM-text efter banned numeriska mönster: `\d+%` (procent-rate-claims), `€\d`, `\$\d`, `kr \d`, `tax bracket`, `marginal rate`, `effective rate`, `tax rate of`.
2. Förvänta: 0 träffar. Modellen ska INTE gissa skattetal.

### Test 6C.8 — INGEN engine-/calculator-drift

1. Sök efter banned termer: `calculate your`, `our calculator`, `submit your return`, `e-file with us`, `download your return`, `tax engine`, `complete the form`, `start filing`.
2. Förvänta: 0 träffar.

### Test 6C.9 — INGEN partner-/marketplace-drift

1. Sök efter: `our partner accountant`, `book through us`, `affiliate`, `referral fee`, `we recommend`, `compare accountants`, `hire via us`, `sponsored`.
2. Förvänta: 0 träffar.

### Test 6C.10 — INGEN 6B/6D-drift

1. Sök efter family/dependents-termer: `family reunification`, `spouse tax`, `dependents tax`, `joint filing` (om inte motiverat av regime — i v1 har vi inte joint-filing-logic).
2. Sök efter rule-change-monitoring-termer: `rule changed`, `regulation update`, `monitor rules`, `rule-change watcher`.
3. Förvänta: 0 träffar.

### Test 6C.11 — disclaimer alltid synlig

1. Disclaimer-paragrafen visas ALLTID, oavsett state — även för helt tom profile.
2. Innehåller "not tax advice", "Confirm", och "tax professional" / "qualified".

### Test 6C.12 — checkpoint timing-sortering

1. Checkpoints ska renderas så att läsbarheten är ok — `before_move`-items känns inte fel placerade efter `first_year_end`-items när bägge finns. (Detta är primärt visuell granskning.)

### Vanliga problem

- **Regime fel-detekteras** — `Australia` matchade tidigare `us` (substring i a**us**tralia). Fixat genom exakt-match-kravet för aliaser ≤ 3 chars (samma fix som Phase 5C).
- **US citizenship-watchout dyker inte upp** — `citizenship`-fältet matchas på `"us"`, `"usa"`, `"united states"`, eller substring `"american"`. Andra varianter (`"USA citizen"`) fångas via substring-check.
- **digital_nomad watchout-severity** — kräver `purpose === "digital_nomad"` (med underscore). `"digital nomad"` (med mellanslag) fångas också.
- **Watchout om departure-tax** — visas så länge `departure_tax_filing_required` INTE är `"no"` (default-on, måste explicit stängas av).
- **NextStep target_route** — bara `register_destination` och `track_residency_days` har `targetRoute`. Övriga är textuella rekommendationer utan deeplink.
- **Numeriska tal** — modellen ska aldrig nämna procent eller belopp. Om något smyger in: lägg in det som testfall.

---

## Phase 6D — Rule-change monitoring

**Vad är detta:** Plan-relevant rule-change-yta. INTE en news-feed, INTE en content library, INTE real-time-monitoring. En kuraterad authored-feed (6 entries i v1: Schengen ETIAS, UK eVisa, EU pet-rabies, US CDC dog-import, Sweden andrahand, France Visale) plus en per-user predicate-engine som filtrerar vilka som faktiskt rör användarens plan. Varje relevant entry får per-user `relevanceReasons[]`, `impactSummary`, `impactSeverity` (info / review / action_required), och en `recommendedAction` med kind (review_pathway / review_documents / rerun_research / confirm_official_source / monitor) + ev. targetRoute.

Acks lagras i `relocation_plans.research_meta.rule_change_acks` per id med `{status, at}`. Fyra status: `new` / `reviewed` / `dismissed` / `research_requested`.

**Förkrav:**
- API-server kör på `:3002` med `/api/rule-changes` mountad.
- Användaren har en aktiv `relocation_plan`.

### Test 6D.1 — empty state när inga changes är relevanta

1. Sätt `profile_data.destination = "Mongolia"` + `pets = "none"` + `purpose = "study"` + `current_location = "Argentina"` (matchar inte Schengen, UK, USA, Sweden, France, eller pet-rules).
2. Gå till `/dashboard`. Förvänta `[data-testid="rule-changes-section"]` med `data-rule-changes-state="empty"`, heading "Plan-affecting changes", "No active rule-changes affect your plan right now".
3. Antalsbadgen ska visa "6 on file · 0 affect you".

### Test 6D.2 — Schengen ETIAS triggas för non-EU + Schengen-destination

1. `destination = "Sweden"` + `citizenship = "Filipino"`. Förvänta `[data-testid="rule-change-rc:schengen-etias"]` synlig med severity-badge.
2. `arrival_date = +30d` (≤90d) → severity ska vara `action_required`.
3. `arrival_date = +120d` → severity blir `review`.
4. `citizenship = "Swedish"` → ETIAS-entry försvinner (EU-medborgare exkluderade).

### Test 6D.3 — UK eVisa triggas för UK-destinationer

1. `destination = "United Kingdom"` → `[data-testid="rule-change-rc:uk-evisa-migration"]` synlig.
2. Severity ska vara `action_required`. `data-rule-change-area="visa_immigration"`.
3. Recommended action: `targetRoute = "/checklist?tab=pre-move"`. Klick på "Open"-länken → navigerar dit.

### Test 6D.4 — pet-rules per destination

1. `destination = "Sweden"` + `pets = "dog"` + `current_location = "Philippines"` → `rc:eu-pet-rabies-tightening` finns. `data-rule-change-area="pet_import"`.
2. `pets = "none"` → entry försvinner.
3. `destination = "United States"` + `pets = "dog"` → `rc:us-cdc-dog-import` finns istället. ETIAS-entry ska INTE finnas (USA ≠ Schengen).
4. `destination = "United States"` + `pets = "cat"` → `rc:us-cdc-dog-import` försvinner (kräver explicit "dog").

### Test 6D.5 — housing-changes per destination

1. `destination = "Sweden"` → `rc:sweden-rental-bostadsbrist` finns. `data-rule-change-area="housing_market"`.
2. `destination = "France"` → `rc:france-visale-guarantor` finns istället.
3. `destination = "Germany"` → ingen housing-entry (ingen authored entry för DE än).

### Test 6D.6 — research-flag är synlig för rätt entries

1. För `rc:schengen-etias`, `rc:uk-evisa-migration`, `rc:eu-pet-rabies-tightening`, `rc:us-cdc-dog-import` ska `[data-testid="rule-change-{id}-research-flag"]` finnas + "Re-run research"-knappen synlig.
2. För `rc:sweden-rental-bostadsbrist`, `rc:france-visale-guarantor` ska research-flagga + Re-run-knapp INTE finnas (`shouldTriggerResearch: false`).

### Test 6D.7 — ack-status persisteras

1. Trigger en relevant entry (t.ex. ETIAS via Sweden+Filipino). Klicka "Mark reviewed".
2. Förvänta: `data-rule-change-ack-status="reviewed"`, ack-badge visar "Reviewed".
3. Refresh sidan → status kvarstår.
4. Inspektera DB: `relocation_plans.research_meta.rule_change_acks["rc:schengen-etias"]` ska vara `{status: "reviewed", at: "<iso>"}`.

### Test 6D.8 — dismiss flyttar till "Dismissed"-fold

1. Klicka "Dismiss" på en entry. Förvänta: raden flyttas till `[data-testid="rule-changes-dismissed-list"]` (under `<details>`).
2. `data-rule-change-ack-status="dismissed"`.
3. "Restore"-knappen ska finnas på dismissed entries och resetta status till `new`.

### Test 6D.9 — request research → status="research_requested"

1. Klicka "Re-run research" på en research-flaggad entry.
2. Förvänta: `data-rule-change-ack-status="research_requested"`, ack-badge visar "Research requested" (indigo).
3. Knappen "Re-run research" försvinner från den raden (kan inte trycka två gånger).
4. DB: ack-statusen är `research_requested`.

### Test 6D.10 — action-required-räknare visas

1. När minst en relevant entry har severity `action_required` och inte är dismissed → `[data-testid="rule-changes-action-count"]` visar "{n} action required" som rose badge.
2. Dismissa alla action_required-entries → räknaren försvinner.

### Test 6D.11 — sortering

1. Hämta active list i DOM-ordning. Förvänta sortering: action_required → review → info, sedan changedAt desc, sedan id alpha.
2. Dismissed entries hamnar alltid sist (i `<details>`).

### Test 6D.12 — INGEN news-feed-drift

1. Sök i sektionens DOM-text efter banned termer: `latest news`, `breaking`, `news feed`, `articles`, `read more`, `recent updates from around`, `worldwide news`.
2. Förvänta: 0 träffar.

### Test 6D.13 — INGEN partner-/marketplace-drift

1. Sök efter: `affiliate`, `our partner immigration lawyer`, `book a consultation through`, `referral fee`, `we recommend our`, `compare lawyers`, `sponsored update`.
2. Förvänta: 0 träffar.

### Test 6D.14 — INGEN 6B-drift

1. Sök efter family/dependents-rule-change-termer: `family member affected`, `dependents impacted`, `your spouse needs`, `joint application`.
2. Förvänta: 0 träffar.

### Test 6D.15 — disclaimer-paragraf visas

1. Sektionens slutparagraf nämner "curated from official sources, not a real-time crawl" + "verify the latest on the source's own page".

### Vanliga problem

- **ETIAS dyker upp för EU-medborgare** → kontrollera att `citizenship` är formulerat med en av de erkända EU-adjektiven (swedish/german/french/spanish/etc). Annars antar systemet non-EU.
- **Pet-entry triggas inte** — `pets`-fältet måste vara satt och inte `"none"`/`"no"`. Tom string räknas också som "no pets".
- **CDC dog-entry kräver "dog" specifikt** — `pets = "cat"` triggar inte denna; bara dog-entrar i `pets`-fältet matchas.
- **Source-länk öppnar fel ställe** — vissa entries har `url: null` (Sweden-housing). Då ska `[data-testid="rule-change-{id}-source-link"]` inte renderas.
- **Acks återställs inte** — använd `PATCH /api/rule-changes/{id}` med `{action: "reset"}` för att flytta tillbaka till `new`. "Restore"-knappen i dismissed-listan gör detta.
- **Research-flagga saknas på en entry** — `shouldTriggerResearch` är hand-författad per entry. Om vi vill att ny entry ska kunna triggera research, sätt true i `RULE_CHANGE_FEED`.

---

## Logg per testkörning

Lägg till en rad varje gång du kör testet, så vi vet vad som funkar.

| Datum | Phase | Test | Resultat | Anteckningar |
|-------|-------|------|----------|--------------|
|       |       |      |          |              |
