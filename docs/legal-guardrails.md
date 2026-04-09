# GoMate — Legal Guardrails

Everything in this document is copy-paste ready and implementable in <1 day.

---

## 1. Product Positioning — Wording Guidelines

### The Rule

GoMate is an **informational guidance tool**. It helps users find, organize, and understand publicly available information about relocating. It does not provide legal, immigration, tax, or financial advice.

### Language Rules (apply to ALL user-facing text)

| Never use | Always use instead |
|---|---|
| "you must" | "typically required" |
| "you need to" | "commonly expected" / "you may want to" |
| "you are required to" | "this is generally required by [source]" |
| "you should" (as obligation) | "it's common to" / "many relocators" |
| "make sure you" | "consider" / "it may be helpful to" |
| "everything you need to know" | "key information about" |
| "everything you need to do" | "common steps to consider" |
| "your complete guide" | "an overview of" / "a guide to" |
| "guaranteed" / "always" / "never" | "typically" / "in most cases" / "rarely" |

### Before/After Examples

**Guide generator intro:**
- Before: "This guide covers everything you need to know about relocating to Germany."
- After: "This guide provides key information about relocating to Germany, based on publicly available official sources. Always verify details with the relevant authorities."

**Settling-in task:**
- Before: "Register your residence. This is legally required within 14 days."
- After: "Register your residence. In most cases, this is required within 14 days of arrival — verify the exact deadline with your local registration office."

**Local requirements card:**
- Before: "Discover what you need to do after arrival"
- After: "Explore common post-arrival steps for your destination"

**Settling-in page:**
- Before: "everything you need to do after arriving at your destination"
- After: "common steps to consider after arriving at your destination"

**Compliance alert:**
- Before: "You must register within 7 days"
- After: "Registration is typically required within 7 days — check with local authorities for your specific situation"

### System Prompt Addition

Add this to the system prompt for ALL user-facing AI responses (chat, guide generation, task generation):

```
TONE RULE: You are an informational guide, not a legal advisor.
- Use "typically required", "commonly expected", "in most cases" instead of "you must" or "you need to"
- When referencing legal deadlines, always add "verify with local authorities" or "based on [source]"
- Never guarantee completeness or accuracy of legal information
- If a user asks whether they legally must do something, say: "Based on publicly available information, this is typically required — but we recommend verifying with the relevant authority or a qualified advisor for your specific situation."
```

---

## 2. Disclaimer System

### A. Onboarding Disclaimer (shown once, during first chat or signup)

**Placement:** Modal or banner at the top of the chat when user starts their first interview.

```
GoMate helps you explore and organize information about relocating abroad.
It is not a substitute for legal, immigration, or financial advice.
All information is based on publicly available sources and may not reflect
your specific circumstances. Always verify with official authorities
before making decisions.
```

**UI:** Light green banner (`bg-green-50 border-l-4 border-green-500`), dismissable with "I understand". Store dismissal in user profile (`onboarding_disclaimer_accepted: true`).

### B. Persistent Disclaimer (always visible)

**Placement:** Footer of the app shell, visible on every page. Small, not intrusive, but always present.

```
GoMate provides informational guidance only — not legal, immigration, or financial advice.
Verify all information with official sources. Terms · Privacy · Disclaimer
```

**UI:** Muted text (`text-muted-foreground text-xs`), centered, in the app shell footer.

### C. Guide/Research Disclaimer (shown on every generated output)

**Placement:** Top of every guide, research result, and settling-in task list.

```
This content is generated from publicly available sources and AI analysis.
It may contain inaccuracies. Verify all information with official authorities
before acting on it.
```

**UI:** Small info banner with an `Info` icon. Same green-border style as onboarding.

### D. Full Disclaimer Page (`/disclaimer`)

```
DISCLAIMER

Last updated: April 2026

GoMate is an informational guidance platform. It helps users find, organize,
and understand publicly available information about international relocation.

GoMate does NOT provide:
- Legal advice
- Immigration advice
- Tax advice
- Financial advice

All information presented in GoMate — including visa recommendations, deadline
estimates, cost of living data, document checklists, and settling-in tasks — is
based on publicly available sources, third-party data providers, and AI analysis.

This information:
- May be incomplete, outdated, or inaccurate
- May not apply to your specific situation
- Should not be relied upon as a substitute for professional advice
- Must be verified with official authorities before you act on it

GoMate uses AI (including OpenAI and Anthropic models) to analyze and synthesize
information. AI-generated content can contain errors. Every recommendation includes
source references where possible — always check the original source.

Deadlines, requirements, and legal obligations vary by country, nationality,
visa type, and individual circumstances. GoMate provides general guidance based
on common scenarios. Your situation may differ.

BY USING GOMATE, YOU ACKNOWLEDGE THAT:
1. You are responsible for verifying all information with official sources
2. GoMate is not a substitute for qualified legal or immigration advice
3. You will not hold GoMate liable for decisions made based on its output
4. Deadlines and requirements shown are estimates and may not apply to you

If you need legal advice about your specific situation, consult a qualified
immigration lawyer or advisor in your destination country.

For questions about this disclaimer, contact: [your email]
```

---

## 3. Terms of Service

**Page:** `/terms`

```
TERMS OF SERVICE

Last updated: April 2026

These terms govern your use of GoMate ("the Service"), operated by
GoMate Technologies ("we", "us", "the Company").

By using GoMate, you agree to these terms.


1. WHAT GOMATE IS

GoMate is an informational guidance tool that helps users explore and
organize publicly available information about international relocation.

GoMate is NOT a legal service, immigration consultancy, financial advisor,
or government authority. We do not provide legal advice.


2. YOUR RESPONSIBILITY

You are responsible for:
- Verifying all information with official sources before acting on it
- Making your own decisions about your relocation
- Consulting qualified professionals when needed
- Ensuring the information you provide to GoMate is accurate

We provide information to help you navigate the process. The final
decisions and actions are yours.


3. NO GUARANTEES

We do our best to provide accurate, up-to-date information. However:

- Information may be incomplete, outdated, or incorrect
- AI-generated content can contain errors
- Legal requirements change frequently
- Your specific situation may differ from general guidance

We do not guarantee the accuracy, completeness, or applicability of
any information provided through GoMate.


4. LIMITATION OF LIABILITY

To the maximum extent permitted by law:

GoMate, its operators, and its affiliates shall not be liable for any
direct, indirect, incidental, or consequential damages arising from
your use of the Service. This includes, but is not limited to:

- Missed deadlines or requirements
- Fines, penalties, or legal consequences
- Visa denials or immigration issues
- Financial losses
- Any actions taken based on information from GoMate

Your use of GoMate is at your own risk.


5. DATA AND PRIVACY

We collect personal data to provide the Service. See our Privacy Policy
for full details on what we collect, why, and how it is processed.


6. PAYMENT AND REFUNDS

Paid plans (Pro, Pro+) are billed as described at the time of purchase.

- Pro is a one-time payment for access to a single relocation plan
- Pro+ is a recurring subscription billed monthly or per selected period
- Refund requests are handled on a case-by-case basis within 14 days
  of purchase if the Service has not been substantially used

You can cancel Pro+ at any time. Cancellation takes effect at the end
of the current billing period.


7. ACCEPTABLE USE

You agree not to:
- Use GoMate to provide immigration services to others
- Resell or redistribute GoMate's output commercially
- Attempt to extract or scrape data from GoMate systematically
- Use GoMate for any unlawful purpose


8. CHANGES TO TERMS

We may update these terms. Continued use after changes constitutes
acceptance. We will notify registered users of material changes.


9. GOVERNING LAW

These terms are governed by the laws of Sweden.

For questions: [your email]
```

---

## 4. Privacy Policy + GDPR

**Page:** `/privacy`

```
PRIVACY POLICY

Last updated: April 2026

This policy explains what data GoMate collects, why, and how it is used.
GoMate is operated by GoMate Technologies, Sweden.


WHAT WE COLLECT

Account data:
- Email address (for authentication)
- Name (if provided)

Profile data (provided during chat interview):
- Citizenship, destination, current location
- Purpose of relocation (work, study, etc.)
- Family situation (spouse, children)
- Financial information (budget, savings)
- Work experience, education, language skills
- Health needs (if disclosed)
- Visa history

Usage data:
- Pages visited, features used
- Plan status and progress

Generated data:
- AI-generated guides, checklists, and task lists
- Research results


WHY WE COLLECT IT

All data is collected to provide the Service:
- Profile data drives personalized guides and recommendations
- Usage data helps us improve the product
- Account data is required for authentication and plan management

Legal basis (GDPR): Consent (you provide the data voluntarily)
and legitimate interest (providing and improving the Service).


WHO WE SHARE IT WITH

Your data is processed by the following third-party services:

| Service | Purpose | Location |
|---------|---------|----------|
| Supabase | Database, authentication | EU/US (check your instance) |
| Vercel | Hosting, serverless functions | US |
| OpenAI (via OpenRouter) | Chat, profile extraction | US |
| Anthropic (via OpenRouter) | Guide generation, research | US |
| Firecrawl | Web research | US |
| Stripe | Payment processing | US |

These providers process data under their own privacy policies and
data processing agreements. Data transfers to the US are covered
by EU-US Data Privacy Framework or Standard Contractual Clauses.

We do NOT:
- Sell your data to third parties
- Use your data for advertising
- Share your data with anyone not listed above


HOW LONG WE KEEP IT

- Account and profile data: as long as your account is active
- Generated content: as long as your account is active
- After account deletion: data is deleted within 30 days

You can request deletion at any time by contacting us.


YOUR RIGHTS (GDPR)

If you are in the EU/EEA, you have the right to:
- Access your data (request a copy)
- Correct inaccurate data
- Delete your data ("right to be forgotten")
- Export your data (portability)
- Withdraw consent at any time
- Lodge a complaint with a supervisory authority

To exercise any of these rights, contact: [your email]


COOKIES

GoMate uses essential cookies for authentication and session management.
We do not use tracking cookies or third-party analytics cookies.


CHANGES

We may update this policy. We will notify registered users of material
changes via email.


CONTACT

[Your name]
[Your email]
[Your address — required for GDPR compliance]
```

---

## 5. Signup Consent Checkbox

**Placement:** Sign-up form, above the "Create account" button.

```
By creating an account, I agree to the Terms of Service and Privacy Policy.
I understand that GoMate provides informational guidance, not legal advice.
```

Both "Terms of Service" and "Privacy Policy" should be clickable links.

**Implementation:** Checkbox must be checked before account creation. Store `terms_accepted_at: timestamp` in the user record.

---

## 6. Implementation Checklist

| Task | Where | Priority |
|---|---|---|
| Create `/app/legal/terms/page.tsx` | New page | Day 1 |
| Create `/app/legal/privacy/page.tsx` | New page | Day 1 |
| Create `/app/legal/disclaimer/page.tsx` | New page | Day 1 |
| Add footer with legal links to `app-shell.tsx` | Existing component | Day 1 |
| Add consent checkbox to `sign-up/page.tsx` | Existing page | Day 1 |
| Add onboarding disclaimer banner to chat | New component | Day 1 |
| Add guide/research disclaimer to guide viewer | Existing component | Day 1 |
| Update guide-generator.ts summary text | Line 757 | Day 1 |
| Update local-requirements-card.tsx text | Lines 354-359 | Day 1 |
| Update settling-in/page.tsx text | Lines 278-280 | Day 1 |
| Add tone rule to system prompt | system-prompt.ts | Day 1 |
| Store `terms_accepted_at` in user record | Migration 025 | Day 1 |
| Check Supabase region (EU vs US) | Supabase dashboard | Day 1 |

---

## 7. Files That Need Changes

| File | Change |
|---|---|
| `lib/gomate/guide-generator.ts:757` | "everything you need to know" → "key information about" |
| `lib/gomate/settling-in-generator.ts:260` | Add "verify with local authorities" |
| `lib/gomate/system-prompt.ts` | Add tone rule for user-facing AI responses |
| `components/local-requirements-card.tsx:354` | "what you need to do" → "common steps to consider" |
| `app/(app)/settling-in/page.tsx:278` | "everything you need to do" → "common steps to consider" |
| `app/auth/sign-up/page.tsx:157` | Add consent checkbox + working links |
| `components/layout/app-shell.tsx` | Add persistent footer with legal links |

Note: System prompt internal directives ("MUST", "NEVER", "CRITICAL") that instruct the AI how to behave are NOT user-facing and do NOT need softening. Only the AI's output language to users needs the tone rule.
