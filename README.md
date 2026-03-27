# GoMate

**AI-powered relocation intelligence platform.**

GoMate guides users through international relocation — from visa research and cost-of-living analysis to a post-arrival settling-in task graph with compliance timeline tracking. Users complete a structured chat interview that builds a 65-field profile, which drives AI-generated guides and a personalized action plan.

> For full technical documentation, architecture, and contribution guidelines, read [`CLAUDE.md`](./CLAUDE.md).

---

## Quick Start

**Prerequisites:** Node.js 20+, pnpm, a Supabase project, an OpenRouter account, a Firecrawl account.

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local and fill in your values
# (or use: vercel env pull .env.local if you have Vercel access)

# 3. Run the development server
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Database + Auth | Supabase (PostgreSQL + GoTrue) |
| AI | GPT-4o (chat/extraction) + Claude Sonnet 4 (generation) via OpenRouter |
| Web research | Firecrawl |
| Styling | Tailwind CSS v4, shadcn/ui |
| Deployment | Vercel |

---

## Project Status

GoMate is approximately 70–75% implemented. See [`CLAUDE.md`](./CLAUDE.md) and [`docs/audit.md`](./docs/audit.md) for the detailed system status and active build phases.

---

## Documentation

| Document | Purpose |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Start here — architecture, rules, phase execution |
| [`docs/system-architecture.md`](./docs/system-architecture.md) | High-level readable architecture overview |
| [`docs/build-protocol.md`](./docs/build-protocol.md) | Phase specifications (what to build) |
| [`docs/phase-status.md`](./docs/phase-status.md) | Current phase completion status |
| [`docs/audit.md`](./docs/audit.md) | System state classification and gap register |
| [`docs/glossary.md`](./docs/glossary.md) | Term definitions |
