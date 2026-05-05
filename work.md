# Work Onboarding

Det här dokumentet listar alla frågor för work-flödet.

Scope för första versionen:

- Endast primary applicant
- Inga partner-/barn-/dependent-frågor
- Fokus på att bevisa att work-flödet fungerar end-to-end

## /onboarding/work

### Sektion 1: Work Setup

1. What kind of work situation fits you best?
   Fält: `job_offer`
   Alternativ:
   - I already have a job offer
   - I’m interviewing / in progress
   - I’m still looking

2. What field will you be working in?
   Fält: `job_field`
   Alternativ:
   - Tech / IT
   - Engineering
   - Healthcare
   - Finance
   - Education
   - Marketing / Sales
   - Hospitality / Service
   - Construction / Skilled trades
   - Other

3. What is your highest completed education?
   Fält: `education_level`
   Alternativ:
   - High school
   - Vocational
   - Bachelor’s
   - Master’s
   - PhD

4. How many years of experience do you have in this field?
   Fält: `years_experience`
   Alternativ:
   - 0-1 years
   - 2-4 years
   - 5-9 years
   - 10+ years

5. Would you consider yourself highly skilled for this role?
   Fält: `highly_skilled`
   Alternativ:
   - Yes
   - No
   - Not sure

### Sektion 2: Employer Path

6. Will your employer sponsor your visa?
   Fält: `employer_sponsorship`
   Visa bara om `job_offer === "yes"` eller `job_offer === "in_progress"`
   Alternativ:
   - Yes
   - No
   - Not sure

7. Is this a company transfer or secondment?
   Fält: `posting_or_secondment`
   Alternativ:
   - Yes
   - No
   - Not sure

8. What is the name of your home-country employer?
   Fält: `home_country_employer`
   Visa bara om `posting_or_secondment === "yes"`

9. What is the employer’s registered address?
   Fält: `posting_employer_address`
   Visa bara om `posting_or_secondment === "yes"`

10. How long will the posting last?
    Fält: `posting_duration_months`
    Visa bara om `posting_or_secondment === "yes"`
    Alternativ:
    - 0-6 months
    - 6-12 months
    - 12-24 months
    - 24+ months
    - Not sure

## /onboarding/work/visa-finance

### Sektion 1: Money

1. How much have you saved so far?
   Fält: `savings_available`

2. What currency should we show your budget in?
   Fält: `preferred_currency`

3. How will you support yourself before your first paycheck?
   Nytt fält: `pre_first_paycheck_support`
   Alternativ:
   - Own savings
   - Family support
   - Employer support / relocation package
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

### Sektion 4: Posting Compliance

11. What is the status of your A1 certificate?
    Fält: `a1_certificate_status`
    Visa bara om `posting_or_secondment === "yes"`
    Alternativ:
    - Not started
    - In progress
    - Obtained
    - Not applicable

12. What is the status of your Certificate of Coverage?
    Fält: `coc_status`
    Visa bara om `posting_or_secondment === "yes"`
    Alternativ:
    - Not started
    - In progress
    - Obtained
    - Not applicable

13. Has the posted worker declaration been filed?
    Fält: `pwd_filed`
    Visa bara om `posting_or_secondment === "yes"`
    Alternativ:
    - Yes
    - No
    - Not sure

## Inte i första versionen

- Partner / spouse / children
- Dependent visa logic
- Monthly budget som användaren själv ska gissa
- Police clearance status
- Diploma apostille status
- Medical exam required
- Övriga dokumentstatusfrågor
