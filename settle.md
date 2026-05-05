# Settle Onboarding

Det här dokumentet listar alla frågor för settle-flödet.

Scope för första versionen:

- Endast primary applicant
- Inga partner-/barn-/dependent-frågor
- Fokus på att bevisa att settle-flödet fungerar end-to-end

## /onboarding/settle

### Sektion 1: Why You’re Settling

1. What best describes why you want to settle there?
   Fält: `settlement_reason`
   Alternativ:
   - Retirement
   - Family reunion
   - Ancestry / heritage
   - Investment
   - Lifestyle / long-term move
   - Other

2. Do you already have family ties in the country?
   Fält: `family_ties`
   Alternativ:
   - Yes
   - No

### Sektion 2: Family Reunion

3. Who are you joining in the country?
   Fält: `relationship_type`
   Visa bara om `settlement_reason === "family_reunion"`
   Alternativ:
   - Spouse
   - Fiancé / fiancée
   - Registered partner
   - Cohabitant / sambo
   - Parent
   - Child
   - Other family member

4. What citizenship does that person have?
   Fält: `partner_citizenship`
   Visa bara om `settlement_reason === "family_reunion"`

5. What is their status in the country?
   Fält: `partner_visa_status`
   Visa bara om `settlement_reason === "family_reunion"`
   Alternativ:
   - Citizen
   - Permanent resident
   - Work visa
   - Student visa
   - Other

6. How long have you been in this relationship / family arrangement?
   Fält: `relationship_duration`
   Visa bara om `settlement_reason === "family_reunion"`
   Alternativ:
   - Less than 1 year
   - 1-2 years
   - 3-5 years
   - 5+ years

### Sektion 3: Your Background

7. What is your current occupation?
   Fält: `current_occupation`

8. What is your highest completed education?
   Fält: `education_level`
   Alternativ:
   - High school
   - Vocational
   - Bachelor’s
   - Master’s
   - PhD

9. Is there anything special about your situation we should keep in mind?
   Fält: `special_requirements`
   Alternativ:
   - No, nothing special
   - Yes

10. Tell us about any special requirement we should keep in mind.
   Fält: `special_requirements`
   Visa bara om föregående svar motsvarar `Yes`

## /onboarding/settle/visa-finance

### Sektion 1: Money

1. How much have you saved so far?
   Fält: `savings_available`

2. What currency should we show your budget in?
   Fält: `preferred_currency`

3. How will you support yourself after the move?
   Nytt fält: `settlement_support_source`
   Alternativ:
   - Own savings
   - Pension / retirement income
   - Investment income
   - Remote income
   - Family support
   - Mixed
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

- Barn / children
- Full dependent visa logic utanför family reunion-branch
- Monthly budget som användaren själv ska gissa
- Police clearance status
- Diploma apostille status
- Medical exam required
- Övriga dokumentstatusfrågor
