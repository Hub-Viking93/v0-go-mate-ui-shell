# Digital Nomad Onboarding

Det här dokumentet listar alla frågor för digital-nomad-flödet.

Scope för första versionen:

- Endast primary applicant
- Inga partner-/barn-/dependent-frågor
- Fokus på att bevisa att digital-nomad-flödet fungerar end-to-end

## /onboarding/digital-nomad

### Sektion 1: Remote Work Setup

1. Do you already earn income remotely?
   Fält: `remote_income`
   Alternativ:
   - Yes
   - No

2. What is your main source of income?
   Fält: `income_source`
   Alternativ:
   - Freelance
   - Remote employee
   - Business owner
   - Mixed

3. What is your approximate monthly income?
   Fält: `monthly_income`

4. How consistent is your income?
   Fält: `income_consistency`
   Alternativ:
   - Stable
   - Variable
   - New / just started

5. How much income history can you show?
   Fält: `income_history_months`
   Alternativ:
   - Less than 3 months
   - 3-6 months
   - 6-12 months
   - 12+ months

### Sektion 2: Work Style

6. Are you planning to keep your current clients / employer after the move?
   Nytt fält: `keep_current_remote_work`
   Alternativ:
   - Yes
   - No
   - Partly
   - Not sure

7. Will you mainly work for clients / employers outside the destination country?
   Nytt fält: `foreign_income_only`
   Alternativ:
   - Yes
   - No
   - Mixed
   - Not sure

## /onboarding/digital-nomad/visa-finance

### Sektion 1: Money

1. How much have you saved so far?
   Fält: `savings_available`

2. What currency should we show your budget in?
   Fält: `preferred_currency`

3. Do you expect your current income to cover your living costs there?
   Nytt fält: `income_covers_living_costs`
   Alternativ:
   - Yes
   - No
   - Not sure

### Sektion 2: Visa History

4. Have you had a visa for this country before?
   Fält: `prior_visa`
   Alternativ:
   - Yes
   - No

5. What type of visa was it?
   Fält: `prior_visa_type`
   Visa bara om `prior_visa === "yes"`

6. Have you ever had a visa refused or rejected?
   Fält: `visa_rejections`
   Alternativ:
   - Yes
   - No

7. Do you have any criminal record or ongoing legal issue that could affect a visa application?
   Fält: `criminal_record`
   Alternativ:
   - Yes
   - No

### Sektion 3: Health & Special Circumstances

8. Do you have any ongoing medical conditions or healthcare needs?
   Fält: `healthcare_needs`
   Alternativ:
   - None
   - Chronic condition
   - Disability

9. Do you take any prescription medications?
   Fält: `prescription_medications`
   Visa bara om `healthcare_needs !== "none"`
   Alternativ:
   - Yes
   - No

10. Are you bringing any pets?
    Fält: `pets`
    Alternativ:
    - None
    - Dog
    - Cat
    - Other

## Inte i första versionen

- Partner / spouse / children
- Dependent visa logic
- Monthly budget som användaren själv ska gissa
- Police clearance status
- Diploma apostille status
- Medical exam required
- Övriga dokumentstatusfrågor
