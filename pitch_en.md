# GoMate — Pitch

---

> If you miss a single deadline when moving abroad, you can face fines, delays — or even deportation.
>
> Moving abroad isn't an information problem. It's an execution problem.
>
> GoMate is the first operating system for relocation — turning one of life's most chaotic processes into a structured, executable system.

---

## The Problem

Moving abroad is one of life's biggest projects — and one of the worst supported.

**It's not the information that's missing. It's the execution.**

Anyone can google a visa in five minutes. But everything else — where to register your residency, how to open a bank account, what deadlines you have, in what order things need to happen — it's a mess. And that mess is unique to every country, every situation, every person.

**Time-critical deadlines slip through the cracks.** Population registration within 7 days. Tax registration within 30 days. Residence permit before your first day of work. Miss a deadline and you risk fines, deportation, or months of extra waiting.

**No service covers the full journey.** Relocation agencies cost $2,000–5,000 and focus on corporations, not individuals. Expat forums have anecdotes, not structured plans. Google gives generic lists that don't account for your specific situation. ChatGPT hallucinates, has no compliance tracking, and no way to verify against official sources.

**The result:** Many spend 50–100 hours on research, still miss critical steps, and feel lost when they arrive.

---

## Why Now?

Four forces are colliding — creating a window:

**1. The remote work explosion.**
Post-COVID, remote work has gone from exception to norm. Millions of people can now choose where they live — and are doing so. Digital nomad visas have grown from 5 to 50+ countries in three years.

**2. Governments are tightening regulations.**
Countries are introducing stricter compliance requirements, shorter deadlines, and higher fines. Portugal, Spain, Germany — all have tightened their rules in 2024–2026. The consequences of missing a deadline are growing.

**3. Individuals are on their own.**
Companies have relocation agencies. Individuals have Google. The gap is enormous — and it's growing as more people relocate independently.

**4. AI makes this possible only now.**
Three years ago, this product was impossible. Web research pipelines, LLM synthesis, and real-time personalization — all of this is functional only now. GoMate isn't an idea waiting for the technology. The technology has arrived.

---

## Origin

GoMate shouldn't have needed to be built.

My fiancee is from the Philippines. I'm from Sweden. We want to live together, which means one of us needs to relocate.

I thought it would be straightforward — figure out the visa, apply, done. But it wasn't. I spent hours jumping between Reddit threads, forums, and government websites trying to understand what you actually need to do. Not just the visa, but everything around it — where to start, what happens when you land, what's expected of you locally.

There was plenty of information. But nothing tailored to our situation.

That's when it clicked: this isn't an information problem — it's an execution problem. And there's no tool that actually helps you get through the entire process step by step.

What can I expect as a Swede in the Philippines? What can she expect as a Filipina in Sweden? The answers exist — scattered across hundreds of sites, in different formats, in different languages. Someone needs to pull it together and make it executable.

So we built it. Not as a guide — but as a system that actually runs the process.

---

## The Solution

GoMate is an AI-powered relocation operating system that builds a complete, personalized relocation plan based on a 15-minute chat interview — and then follows you through the entire settling-in process.

### How it works:

**1. Describe your situation (15 min)**
An AI assistant asks questions in a natural conversation. No forms, no dropdowns — just a conversation. Under the surface, GoMate builds a profile with 65+ data points: citizenship, destination, purpose, family situation, budget, work experience, language skills, health needs, and more.

**2. Get your plan (automatically)**
Once the profile is complete, an AI-driven research pipeline is triggered that:
- **Searches official sources** (embassies, immigration websites, government agencies) via web scraping
- **Analyzes and synthesizes** the information with AI
- **Builds a tailored guide** with 15+ sections

**3. Act with confidence**
Your plan contains everything you need:

| Section | What you get |
|---|---|
| **Visa recommendations** | 3–8 visa types ranked by your profile, with requirements, cost, processing time, and step-by-step instructions |
| **Budget & cost of living** | Real-time data for your city with month-by-month budget (minimum vs comfortable) |
| **Document checklist** | Prioritized documents (critical/high/medium/low) with where to obtain them |
| **Housing guide** | Rent by area, platforms, deposit rules |
| **Healthcare, banking, jobs, culture** | Everything tailored to your country, your city, your situation |
| **Flight search** | Comparisons from 5 booking sites |
| **Timeline** | Milestones from now to arrival |

**4. Land and get established (Pro+)**
When you arrive, you activate post-arrival mode. You get:
- **A task graph with dependencies** — a bank account can't be opened until you've registered your residency, and GoMate knows that
- **Deadlines tied to your arrival date** — "register with the tax authority within 7 days"
- **Compliance alerts** — overdue/urgent/approaching so you never miss anything legally critical
- **AI chat for questions** — ask anything about your new city and get answers based on your profile and your plan

---

## Wedge

We don't start with "everyone who moves abroad." We start here:

> **Professionals and couples relocating within and to/from Europe.**

This is the segment with the highest frequency, highest compliance complexity, and highest urgency — and where there is currently no solution for individuals.

EU freedom of movement sounds simple, but the reality is different: every country has unique requirements for residency registration, tax registration, insurance, and bank account opening. Deadlines are strict. Consequences are real.

This gives us:
- **Fast feedback loops** — high relocation frequency, short cycles
- **Repeatable flows** — the same compliance requirements recur country by country
- **High urgency** — deadlines with legal consequences drive willingness to pay

From there, we expand to digital nomads, global relocations, and more country combinations.

---

## Trust

We don't generate advice. We generate **verifiable, time-bound instructions tied to official sources.**

Every recommendation in GoMate is:
- **Backed by an official source** — embassies, immigration authorities, government agencies. Linked so the user can verify.
- **Timestamped** — the user sees when the information was retrieved.
- **Quality-rated** — `full` (complete data from official sources), `partial` (incomplete), or `fallback` (AI-based). Nothing is presented as more certain than it is.

When a profile changes or research is older than 7 days, the guide is automatically marked as stale. Nothing is ever presented as current unless it is. Next step is continuous re-validation: when a source changes, your plan updates — before it becomes your problem.

Profile data extracted from the chat interview is tagged with a confidence level: `explicit`, `inferred`, or `assumed`. Assumed data is always confirmed with the user before it's used.

GoMate is not a lawyer, advisor, or government authority. We help you find, structure, and execute — but the final responsibility is always yours. This is communicated clearly in the product.

---

## Moat

Most players in this space build guides. We build infrastructure.

**1. The compliance engine.**
A DAG-based task graph where every task has dependencies, deadlines relative to arrival date, legal-requirement flags, and urgency computation. It's not a checklist — it's an operational system that computes what you need to do, in what order, and warns you when you're about to miss something. Building this correctly took 11 build phases. It's not a feature — it's an engine.

**2. Profile depth.**
65+ data points with intelligent branching — your purpose (work/study/digital nomad/family) determines which questions are asked, which research is triggered, and which output you get. Every new profile makes the platform's output quality better.

**3. Research pipeline with web grounding.**
Not just LLM generation — but real-time scraping of official sources + AI synthesis. Every result has source attribution. Next step is continuous monitoring: when a source changes, it gets flagged.

This is not a feature problem. It's a systems problem. And systems — once built correctly — are extremely hard to replace.

Someone can build a relocation chatbot in a weekend. No one can build a compliance engine with DAG dependencies, deadline computation, web-grounded research, and 65-field profile personalization in a weekend.

---

## Business Model

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | Chat interview + profile + overview |
| **Pro** | $189 (one-time) | Full guide, visa research, budget, documents, flight search |
| **Pro+** | $39/mo | Everything in Pro + unlimited plans, post-arrival compliance OS, AI assistant |

Pro+ bundles: 3 months ($95), 6 months ($169), annual ($289).

**Why this pricing:**
A relocation agency costs $2,000–5,000. GoMate delivers 80% of the value at 5% of the price. $189 for Pro is less than a single hour of consultation — but you get a complete, AI-driven plan.

**Unit economics are strong:** Marginal cost per user is LLM calls (~$0.50–1.50) + Firecrawl search (~$0.20–0.50). No human advisors, no manual research. Gross margin >90%.

---

## Distribution

### Growth engine

Every relocation plan we generate can become a structured, indexed guide. Over time, this creates thousands of high-intent landing pages — continuously updated with real user patterns — where every guide improves the next.

This is not content. It's a **self-improving distribution engine.**

### Phase 1: Organic + SEO (0–6 months)

**Country-specific guides as SEO magnets.** GoMate already generates 15+ section guides for every country-destination combination. Publish the best as standalone landing pages: "Moving to Spain from the UK — complete guide 2026." Every guide is a top-of-funnel leading to signup.

**Expat communities.** Reddit (r/expats, r/digitalnomad, r/IWantOut), Facebook groups, InterNations. Not spam — genuine presence with answers that demonstrate the product's depth.

**Content on TikTok/YouTube.** Short videos: "3 deadlines you MUST NOT miss when moving to Germany." Relocation content has high engagement and low competition.

### Phase 2: Partnerships (6–12 months)

**Expat platforms.** Integration with InterNations, Expatica, or similar — "Powered by GoMate compliance tracking."

**Companies with international hires.** Small businesses that can't afford relocation agencies but hire internationally. GoMate as the onboarding tool for new hires.

**Government agencies and educational institutions.** Universities with international students. Migration organizations. GoMate as a "recommended tool."

### Phase 3: Platform expansion (12+ months)

Every completed relocation generates data about what works in which countries. This data makes the next user's plan better — a **data flywheel** that accelerates over time.

---

## Market

- **3+ million** international relocations per year (OECD countries)
- **560,000+** Swedes live abroad; **200,000+** foreign citizens relocate to Sweden annually
- **Digital nomad market** growing 20%+ annually — 50+ countries now offer specific nomad visas
- **Relocation services market:** $20B+ globally, dominated by companies paying $20k+ per relocation

| Alternative | Problem |
|---|---|
| Relocation agencies | $2,000–5,000, focused on corporations |
| Expat forums | Anecdotal, unstructured, impersonal |
| Generic guides | Not personalized, quickly outdated |
| ChatGPT directly | Hallucinates, no compliance tracking, no web grounding |

GoMate is the first service that gives **individuals** access to personalized relocation intelligence with compliance tracking — at a fraction of the cost.

---

## Team

**Axel** — Product, system design & AI engineering. Not a programmer — a problem solver. Understands systems, how they're expected to work, and what the output should look like. Finds abstract solutions to complex problems. Built all of GoMate — architecture, compliance engine, research pipeline, 24 system definitions, engineering contracts — using AI as the tool. Uses ChatGPT for system design and Claude Code for implementation, governed through detailed contracts and specifications. Background in scaling GTM systems, SEO/AEO infrastructure, and onboarding processes for sales and marketing teams.

**Roselle** — Design & user experience. Trained teacher with a background as Virtual Assistant and Executive Assistant. Designs all of GoMate's user flows — taking a chaotic problem and making it navigable. The teaching background gives the ability to take something complex and make it understandable. Operational experience from the EA role provides deep understanding of complex processes, deadlines, and workflows — exactly what GoMate's UX demands.

We didn't start with a market thesis. We started with a real cross-border relocation between Sweden and the Philippines — and built the tool we couldn't find.

---

## Technology

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS, shadcn/ui |
| Backend | Vercel serverless, Supabase (PostgreSQL + auth) |
| AI — chat & extraction | GPT-4o via OpenRouter |
| AI — generation & research | Claude Sonnet 4 via OpenRouter |
| Web research | Firecrawl (search + scrape) |
| Data | Numbeo (cost of living), 5 flight booking sites |

---

## Status

GoMate v1 is live. 11 build phases completed. Core functionality works end-to-end:

- Chat interview with profile building (65+ fields, intelligent branching)
- AI-driven visa and requirements research (web-grounded, source attribution)
- Complete guide generation (15+ sections, staleness detection)
- Cost of living analysis with currency conversion
- Document checklist with prioritization
- Post-arrival task graph with DAG dependencies and deadline tracking
- Compliance alerts (overdue/urgent/approaching)
- Confidence scoring on extracted profile data
- Subscription management (Free / Pro / Pro+)

---

## Vision

GoMate is not a relocation tool. It is the first **operating system for cross-border life** — starting with relocation, expanding into everything that happens after.

| Phase | Expansion |
|---|---|
| **v1 (now)** | Relocation OS — visa, guide, compliance, post-arrival |
| **v2** | Job system — matching user profiles to open positions in the destination country |
| **v3** | Artifact generation — CV adaptation, cover letters, application materials |
| **v4** | Partner integration — direct connections to housing platforms, banks, insurance providers |
| **v5** | Community — matching with others moving to the same city |
| **Long-term** | Tax, insurance, pensions, citizenship — everything that moves across borders |

Every step adds more data, more value creation, and higher switching cost.

---

*GoMate — the operating system for cross-border life.*
