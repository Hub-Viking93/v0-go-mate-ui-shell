# GoMate — Pricing

> Last updated: 2026-04-04

---

## Overview

GoMate uses a three-tier pricing model. Free lets users explore. Pro Single unlocks all pre-move intelligence as a one-time purchase. Pro+ is a subscription that adds the full post-arrival stack — compliance, banking, tax registration, wellbeing, and unlimited plans.

All prices are in USD.

---

## Tier 1: Free

**Price:** $0

| Feature | Description |
|---|---|
| Full chat interview | AI-guided profile building (65+ fields) |
| Profile building | Structured data extraction from conversation |
| Basic relocation overview | High-level summary of relocation path |

**Limits:** 1 plan. No access to research, guides, documents, or post-arrival features.

---

## Tier 2: Pro Single

**Price:** $29 (one-time payment)

Everything in Free, plus:

| # | Feature | Description |
|---|---|---|
| 1 | Visa recommendations & research | AI + Firecrawl-powered visa research with eligibility scoring |
| 2 | Local requirements research | Country-specific registration, healthcare, tax ID requirements |
| 3 | Cost of living analysis | Numbeo data with home-country comparison |
| 4 | Budget planner | Monthly budget breakdown against destination costs |
| 5 | Affordability analysis | Budget vs COL — affordable / comfortable / tight / risky |
| 6 | Full relocation guide | AI-generated, PDF-renderable, destination-specific |
| 7 | Document checklist | Status tracking per document (not_started → submitted) |
| 8 | Pre-move timeline | Phased timeline: before_move → first_week → first_month |
| 10 | Plan consistency checks | Warnings about profile conflicts and missing fields |
| 11 | Tax overview | Tax obligations and rates per destination |
| 12 | Chat history | Persistent conversation — pick up where you left off |

**Limits:** 1 plan. No post-arrival features.

**Positioning:** "Get your complete relocation plan."

---

## Tier 3: Pro+

**Price:** $29/month (subscription)

Everything in Pro Single, plus:

| # | Feature | Description |
|---|---|---|
| 13 | Unlimited relocation plans | Compare multiple destinations side by side |
| 14 | Visa application tracker | Full lifecycle: status stepper, deadlines, documents per application |
| 15 | Banking setup wizard | 4-step guide with local bank recommendations (Wise, Revolut, N26) |
| 16 | Tax registration guide | Country-specific tax ID registration (Steuer-ID, BSN, etc.) |
| 17 | Post-arrival task manager | DAG-based task graph with dependencies and deadlines |
| 18 | Post-arrival AI assistant | Context-aware chat that knows your situation and progress |
| 19 | Compliance calendar | Calendar view of all deadlines + iCal export |
| 20 | Compliance alerts & reminders | Overdue / urgent / upcoming deadline notifications |
| 21 | Wellbeing check-ins | Weekly mood tracking + mental health resources |
| 22 | Plan switcher | Switch between plans without losing data |

**Limits:** None. Full platform access.

**Positioning:** "Stay compliant, organized, and in control after arrival."

---

## Pro+ Subscription Plans

| Plan | Price | Per month | Savings |
|---|---|---|---|
| Monthly | $29/mo | $29 | — |
| 3 Months | $59 | ~$20 | 32% |
| 6 Months | $99 | ~$17 | 43% |
| Annual | $199 | ~$17 | 43% |

The **3-month plan** covers a typical relocation timeline and is the recommended entry point for serious movers.

---

## Feature Access Matrix

| Feature | Free | Pro Single | Pro+ |
|---|---|---|---|
| Chat interview | yes | yes | yes |
| Visa recommendations | — | yes | yes |
| Local requirements | — | yes | yes |
| Cost of living | — | yes | yes |
| Budget planner | — | yes | yes |
| Affordability analysis | — | yes | yes |
| Guides | — | yes | yes |
| Documents | — | yes | yes |
| Pre-move timeline | — | yes | yes |
| Plan consistency | — | yes | yes |
| Tax overview | — | yes | yes |
| Chat history | — | yes | yes |
| Plan switcher | — | — | yes |
| Settling-in tasks | — | — | yes |
| Compliance alerts | — | — | yes |
| Compliance calendar | — | — | yes |
| Post-arrival assistant | — | — | yes |
| Visa tracker | — | — | yes |
| Banking wizard | — | — | yes |
| Tax registration | — | — | yes |
| Wellbeing check-ins | — | — | yes |
| **Total features** | **1** | **13** | **23** |
| **Plans** | 1 | 1 | Unlimited |

---

## Pricing Logic

- **Pro Single at $29** — impulse buy for a life decision tool. Same price as a meal out.
- **Pro+ at $29/mo** — same price point as Pro Single makes the choice clear: "for the same price, I get everything, every month."
- **3-month bundle ($59)** — the natural upgrade path. Most relocations take 2-4 months.
- **Annual ($199)** — premium anchor that makes monthly feel expensive by comparison.

---

## Currency

- Base currency: **USD**
- Database column: `price_sek` (legacy name, stores USD value — rename planned for v2 migration)
- Multi-currency display planned for v2 (convert based on user's `preferred_currency` profile field)

---

## Implementation Reference

- Feature type and access matrix: `lib/gomate/tier.ts`
- Pricing display: `components/upgrade-modal.tsx`
- Paywall gates: `components/tier-gate.tsx`
- All API routes enforce tier via `hasFeatureAccess(tier, feature)` returning 403 on mismatch.
