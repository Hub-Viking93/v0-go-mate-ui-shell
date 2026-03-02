# GoMate — Persistence Layer SystemDoc

**Phase:** 1.3
**Status:** Reality-based
**Primary source files:**
- `scripts/001_create_profiles.sql`
- `scripts/002_create_relocation_plans.sql`
- `scripts/003_create_checklist_progress.sql`
- `scripts/005_create_guides.sql`
- `scripts/006_add_document_statuses.sql`
- `scripts/007_add_guide_type.sql`
- `scripts/008_create_subscriptions.sql`
- `scripts/009_add_plan_metadata.sql`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `lib/gomate/supabase-utils.ts`
- `middleware.ts`

**Last verified:** 2026-02-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [Infrastructure](#2-infrastructure)
3. [Migration History](#3-migration-history)
4. [Table Reference](#4-table-reference)
   - 4.1 [profiles](#41-profiles)
   - 4.2 [relocation_plans](#42-relocation_plans)
   - 4.3 [checklist_progress](#43-checklist_progress)
   - 4.4 [guides](#44-guides)
   - 4.5 [user_subscriptions](#45-user_subscriptions)
5. [Entity Relationships](#5-entity-relationships)
6. [JSONB Column Inventory](#6-jsonb-column-inventory)
7. [Triggers and Functions](#7-triggers-and-functions)
8. [Row-Level Security](#8-row-level-security)
9. [Indexes](#9-indexes)
10. [Client Architecture](#10-client-architecture)
11. [Session and Middleware](#11-session-and-middleware)
12. [Application-Layer Helpers](#12-application-layer-helpers)
13. [Known Issues and Gaps](#13-known-issues-and-gaps)
14. [Gap Analysis](#14-gap-analysis)
15. [Target State](#15-target-state)

---

## 1. Overview

GoMate's persistence layer is built on **Supabase**, which provides:

- **PostgreSQL** — the primary database
- **Supabase Auth** — user identity, managed via the `auth.users` table (Supabase-internal)
- **Row-Level Security (RLS)** — enforced on all application tables
- **`@supabase/ssr`** — the client library for server-side rendering with cookie-based session management

The persistence layer consists of **5 application tables**, **8 SQL migration scripts**, **2 database triggers**, **1 shared trigger function**, **1 auto-provisioning function**, and an application-layer helper module.

All tables enforce user isolation via RLS. No user can read, write, or delete another user's data at the database level. Cascade deletes propagate from `auth.users` through all tables, ensuring that deleting a user removes all their data.

---

## 2. Infrastructure

| Component | Technology | Details |
|---|---|---|
| Database | PostgreSQL (via Supabase) | Hosted, managed |
| Auth | Supabase Auth | JWT-based; `auth.users` is the identity anchor |
| Client library | `@supabase/ssr` | Used for both browser and server contexts |
| Session management | Cookie-based | Managed by `lib/supabase/middleware.ts` via `updateSession()` |
| Environment variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for all client instantiation |

---

## 3. Migration History

Migrations are stored as numbered SQL files in `scripts/`. They must be applied sequentially in the order implied by their prefix.

| Script | What it does |
|---|---|
| `001_create_profiles.sql` | Creates `public.profiles` table, RLS policies, and the `handle_new_user()` trigger function and trigger |
| `002_create_relocation_plans.sql` | **Drops** and recreates `public.relocation_plans` table, RLS policies, `user_id` index, `update_updated_at_column()` function, and updated_at trigger |
| `003_create_checklist_progress.sql` | Creates `public.checklist_progress` table, RLS policies, indexes, and updated_at trigger |
| *(004 — missing)* | No file exists for this number in the scripts directory |
| `005_create_guides.sql` | Creates `public.guides` table, RLS policies, and indexes |
| `006_add_document_statuses.sql` | Adds `document_statuses jsonb` column to `relocation_plans` |
| `007_add_guide_type.sql` | Adds `guide_type text` column to `guides` and two new indexes |
| `008_create_subscriptions.sql` | Creates `public.user_subscriptions` table, RLS policies, indexes, and updated_at trigger |
| `009_add_plan_metadata.sql` | Adds `title`, `status`, `is_current` columns to `relocation_plans`; adds the partial unique index on `(user_id) where is_current = true`; backfills `is_current` for existing rows |
| `010_settling_in_checklist.sql` | Adds `arrival_date`, `post_relocation_generated` to `relocation_plans`; **extends the `stage` check constraint to include `'arrived'`**; creates `settling_in_tasks` table, RLS policies, indexes, and updated_at trigger |
| *(011 — applied 2026-02-28, no file in scripts/)* | Phase 0: Adds `steps text[]`, `documents_needed text[]`, `cost text` to `settling_in_tasks`. Applied to live database; SQL not committed to repo. |
| *(012 — applied 2026-02-28, no file in scripts/)* | Phase 0: Adds `visa_research jsonb`, `local_requirements_research jsonb` to `relocation_plans`. Applied to live database; SQL not committed to repo. |
| *(013 — applied 2026-02-28, no file in scripts/)* | Phase 0: Adds `document_statuses jsonb` to `relocation_plans`. Applied to live database; SQL not committed to repo. |
| *(014 — reserved)* | Phase 3: plan switch RPC (if needed). Do not use for anything else. |
| **Next: `015`** | — |

> **Note on migrations 011–013:** These were applied directly to the live Supabase database during Phase 0 schema repair. No `.sql` files were committed to `scripts/`. If you need to reconstruct them, the content is described in `docs/audit.md` section 5 and `docs/phases/phase-0-baseline.md` section 8. To add future columns, use `scripts/015_*.sql` with `ADD COLUMN IF NOT EXISTS`.

### The missing migration 004

The sequence jumps from `003` to `005`. No `004_*.sql` file exists in `scripts/`. The reason for this gap is not recorded anywhere in the codebase. It may represent:

- A migration that was applied directly and never committed to the scripts directory
- A migration that was planned but not written
- A script that was deleted

The practical effect is that migration `005` cannot safely assume sequential numbering if any tooling enforces it.

### The destructive migration 002

`002_create_relocation_plans.sql` opens with:

```sql
drop table if exists public.relocation_plans cascade;
```

This is a destructive operation. If applied to a database with existing plan data, all relocation plans — and any rows in `checklist_progress` that reference them via cascade — would be permanently deleted. This migration script was likely written before any data existed. It should be treated with extreme caution if the database has production data.

---

## 4. Table Reference

### 4.1 `profiles`

**Source:** `001_create_profiles.sql`

Stores identity and display information for authenticated users. Has a 1:1 relationship with `auth.users`. Created automatically when a user signs up.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key. Foreign key → `auth.users(id)` on delete cascade |
| `first_name` | `text` | YES | — | Populated from `raw_user_meta_data` at signup |
| `last_name` | `text` | YES | — | Populated from `raw_user_meta_data` at signup |
| `email` | `text` | YES | — | Copied from `auth.users.email` at signup |
| `avatar_url` | `text` | YES | — | Not auto-populated; must be set by application |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Not updated by trigger — only by explicit writes |

**Notes:**
- `updated_at` has a default value but no trigger. The `update_updated_at_column()` function (created in migration 002) is not applied to `profiles`. Updates to profile rows do not auto-update `updated_at` unless the application sets it explicitly.
- The `profiles` table stores display metadata only. Interview data lives in `relocation_plans.profile_data`.
- `avatar_url` is defined but no mechanism exists to set it — no upload flow is implemented.

---

### 4.2 `relocation_plans`

**Sources:** `002_create_relocation_plans.sql`, `006_add_document_statuses.sql`, `009_add_plan_metadata.sql`, `010_settling_in_checklist.sql`

The central table of GoMate. Stores the interview profile, plan state, outputs, and lock status. One row = one relocation plan.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users(id)` on delete cascade |
| `profile_data` | `jsonb` | YES | `'{}'` | Full `Profile` object from the interview |
| `stage` | `text` | YES | `'collecting'` | Check: `('collecting', 'generating', 'complete', 'arrived')` — extended by migration 010 |
| `locked` | `boolean` | YES | `false` | Whether the plan is finalized |
| `locked_at` | `timestamptz` | YES | — | Timestamp when locked |
| `target_date` | `date` | YES | — | User's intended move date |
| `visa_recommendations` | `jsonb` | YES | `'[]'` | Array of visa recommendation objects |
| `budget_plan` | `jsonb` | YES | `'{}'` | Budget calculation results |
| `checklist_items` | `jsonb` | YES | `'[]'` | Generated checklist items |
| `document_statuses` | `jsonb` | YES | `'{}'` | Per-document completion map *(added by 006)* |
| `title` | `text` | YES | — | Human-readable plan name *(added by 009)* |
| `status` | `text` | NOT NULL | `'active'` | Check: `('active', 'archived', 'completed')` *(added by 009)* |
| `is_current` | `boolean` | NOT NULL | `false` | Whether this is the user's active plan *(added by 009)* |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Auto-updated by trigger on any UPDATE |

**Constraints:**
- `stage check`: values restricted to `('collecting', 'generating', 'complete', 'arrived')` — migration 002 created with first three values; migration 010 dropped and recreated the constraint to add `'arrived'`
- `status check` (added by 009): values restricted to `('active', 'archived', 'completed')`
- Partial unique index: only one row per `user_id` may have `is_current = true` (see [Indexes](#9-indexes))

**Important distinctions — `stage` vs `status` vs `locked`:**

These three columns represent overlapping but distinct concepts:

| Column | What it tracks | Who sets it |
|---|---|---|
| `stage` | Where the plan is in the generation lifecycle | Set to `'complete'` by the lock action; `'generating'` requires explicit call |
| `status` | Whether the plan is active in the user's plan list | Set to `'archived'` by `archivePlan()` in `plan-factory.ts` |
| `locked` | Whether the interview data is frozen | Set by `PATCH /api/profile { action: "lock" }` |

A plan can be `stage='complete'`, `status='active'`, `locked=true` — which is the normal post-completion state.

---

### 4.3 `checklist_progress`

**Source:** `003_create_checklist_progress.sql`

Tracks the completion status of individual checklist items per user/plan combination. One row = one item's completion state.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users(id)` on delete cascade |
| `plan_id` | `uuid` | NOT NULL | — | FK → `relocation_plans(id)` on delete cascade |
| `item_id` | `text` | NOT NULL | — | Application-defined identifier for the checklist item |
| `completed` | `boolean` | YES | `false` | Whether the item is done |
| `completed_at` | `timestamptz` | YES | — | When marked complete |
| `notes` | `text` | YES | — | Optional user notes |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Auto-updated by trigger |

**Constraints:**
- Unique: `(user_id, plan_id, item_id)` — one completion record per item per plan per user

**Cascade behaviour:**
- Deleting a `relocation_plan` row cascades and deletes all `checklist_progress` rows for that plan
- Deleting a user cascades and deletes all `checklist_progress` rows for that user

---

### 4.4 `guides`

**Sources:** `005_create_guides.sql`, `007_add_guide_type.sql`

Stores generated relocation guides. One row = one guide. A guide is linked to a plan but outlives it (plan deletion sets `plan_id` to null, not cascades).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users(id)` on delete cascade |
| `plan_id` | `uuid` | YES | — | FK → `relocation_plans(id)` **on delete set null** |
| `title` | `text` | NOT NULL | — | Guide title |
| `destination` | `text` | NOT NULL | — | Target country |
| `destination_city` | `text` | YES | — | Target city, if specified |
| `purpose` | `text` | YES | — | `'study'` / `'work'` / `'settle'` / `'digital_nomad'` |
| `overview` | `jsonb` | YES | `'{}'` | Top-level guide overview |
| `visa_section` | `jsonb` | YES | `'{}'` | Visa pathway content |
| `budget_section` | `jsonb` | YES | `'{}'` | Budget and financial content |
| `housing_section` | `jsonb` | YES | `'{}'` | Housing market content |
| `banking_section` | `jsonb` | YES | `'{}'` | Banking and finance setup |
| `healthcare_section` | `jsonb` | YES | `'{}'` | Healthcare system content |
| `culture_section` | `jsonb` | YES | `'{}'` | Cultural context |
| `jobs_section` | `jsonb` | YES | `'{}'` | Employment market content |
| `education_section` | `jsonb` | YES | `'{}'` | Education system content |
| `timeline_section` | `jsonb` | YES | `'{}'` | Month-by-month timeline |
| `checklist_section` | `jsonb` | YES | `'{}'` | Guide-specific checklist |
| `official_links` | `jsonb` | YES | `'[]'` | Array of official resource links |
| `useful_tips` | `jsonb` | YES | `'[]'` | Array of tips |
| `status` | `text` | YES | `'draft'` | Check: `('draft', 'generating', 'complete', 'archived')` |
| `guide_type` | `text` | YES | `'main'` | Added by migration 007 |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | No trigger — updated explicitly |
| `completed_at` | `timestamptz` | YES | — | When generation finished |

**Notes:**
- `guides` has no `updated_at` trigger. The `update_updated_at_column()` function is not attached to this table. Updates do not auto-update `updated_at`.
- `plan_id` uses `on delete set null`. If a plan is deleted, guides remain but lose their plan association. This is intentional — guides represent generated content that should survive plan deletion.
- `guide_type` column added by migration 007 has a default of `'main'` but its value is not meaningfully leveraged by the guide generation code in `lib/gomate/guide-generator.ts`.
- Guide `status` lifecycle (`draft` → `generating` → `complete` → `archived`) is defined in the schema but is not fully driven by the application — guides are inserted directly as complete objects by `app/api/profile/route.ts`.

---

### 4.5 `user_subscriptions`

**Source:** `008_create_subscriptions.sql`

Stores one subscription record per user. Enforces a hard constraint of one row per user at the database level.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `auth.users(id)` on delete cascade |
| `tier` | `text` | NOT NULL | `'free'` | Check: `('free', 'pro_single', 'pro_plus')` |
| `billing_cycle` | `text` | YES | — | Check: `('one_time', 'monthly', 'quarterly', 'biannual', 'annual', null)` |
| `status` | `text` | NOT NULL | `'active'` | Check: `('active', 'cancelled', 'expired', 'past_due')` |
| `plan_limit` | `integer` | NOT NULL | `1` | Maximum number of plans the user may create |
| `price_sek` | `integer` | YES | `0` | Price paid, stored in Swedish öre (1/100 kr) |
| `stripe_customer_id` | `text` | YES | — | Stripe customer identifier — not yet populated |
| `stripe_subscription_id` | `text` | YES | — | Stripe subscription identifier — not yet populated |
| `stripe_price_id` | `text` | YES | — | Stripe price identifier — not yet populated |
| `started_at` | `timestamptz` | NOT NULL | `now()` | |
| `expires_at` | `timestamptz` | YES | — | Null = no expiry (free or lifetime plans) |
| `cancelled_at` | `timestamptz` | YES | — | When user cancelled |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Auto-updated by trigger |

**Constraints:**
- `constraint unique_active_subscription unique (user_id)` — enforces one subscription row per user at the database level
- `tier check`, `billing_cycle check`, `status check` — enum enforcement

**Notes:**
- The three Stripe columns exist but are never populated by the application. No Stripe SDK, webhook handler, or payment flow is implemented. The columns are placeholders.
- Free tier creation is handled entirely in application code (`ensureSubscription()` in `lib/gomate/tier.ts`), not by a database trigger.

---

## 5. Entity Relationships

```
auth.users (Supabase-managed)
  │
  ├── profiles                    1:1   on delete cascade
  │
  ├── relocation_plans            1:many   on delete cascade
  │     │
  │     ├── checklist_progress    1:many   on delete cascade (plan → checklist)
  │     │                                  on delete cascade (user → checklist)
  │     │
  │     └── guides                1:many   on delete SET NULL (plan → guide)
  │                                        on delete cascade (user → guide)
  │
  └── user_subscriptions          1:1 (enforced by unique constraint)
                                  on delete cascade
```

**Cascade behaviour summary:**

| Trigger | Effect |
|---|---|
| `auth.users` deleted | Cascades to: `profiles`, `relocation_plans`, `checklist_progress`, `guides`, `user_subscriptions` |
| `relocation_plans` row deleted | Cascades to: `checklist_progress` for that plan. Sets `plan_id = null` on `guides` for that plan |
| `checklist_progress` row deleted | No cascades |
| `guides` row deleted | No cascades |
| `user_subscriptions` row deleted | No cascades |

---

## 6. JSONB Column Inventory

JSONB columns store semi-structured data that does not have a fixed relational schema. The following documents what each column is intended to hold, based on code that reads and writes to them.

### `relocation_plans.profile_data`

Holds the full `Profile` object as defined in `lib/gomate/profile-schema.ts`.

Expected shape: all 45 profile fields, each a nullable string or null. Written by `saveProfileToSupabase()` and `updatePlanProfile()` as a merged object on each chat turn.

```json
{
  "name": "Sofia",
  "citizenship": "Sweden",
  "destination": "Germany",
  "purpose": "work",
  "job_offer": "yes",
  ...
}
```

### `relocation_plans.visa_recommendations`

Array of visa recommendation objects. Written by the research/visa endpoint. No enforced schema — the shape depends on what OpenAI returns.

### `relocation_plans.budget_plan`

Budget calculation output. Written by the cost-of-living system. Shape defined by `calculateMonthlyBudget()` return value in `lib/gomate/web-research.ts`.

### `relocation_plans.checklist_items`

Array of checklist item objects generated by `lib/gomate/checklist-generator.ts`. No enforced schema.

### `relocation_plans.document_statuses`

Per-document completion tracking. Keys are document identifiers; values are `{ completed: boolean, completedAt?: string }` objects.

```json
{
  "passport": { "completed": true, "completedAt": "2026-01-15T10:30:00Z" },
  "visa_application": { "completed": false }
}
```

### `guides.*_section` columns (11 columns)

Each section of a guide is stored in its own JSONB column. All default to `'{}'`. Shape defined by the interfaces in `lib/gomate/guide-generator.ts`. The eleven section columns are:

`overview`, `visa_section`, `budget_section`, `housing_section`, `banking_section`, `healthcare_section`, `culture_section`, `jobs_section`, `education_section`, `timeline_section`, `checklist_section`

### `guides.official_links`

Array of link objects. Default `'[]'`.

### `guides.useful_tips`

Array of string tips. Default `'[]'`.

---

## 7. Triggers and Functions

### `public.handle_new_user()`

**Source:** `001_create_profiles.sql:22–38`

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
```

Fires `after insert on auth.users` for each row. Inserts a new row into `public.profiles` with `id`, `first_name`, `last_name`, and `email` extracted from `auth.users.raw_user_meta_data`. Uses `on conflict (id) do nothing` — safe to re-fire.

**Trigger name:** `on_auth_user_created`
**Fires:** After every new user signup (any auth method — email/password, OAuth, magic link)

### `public.update_updated_at_column()`

**Source:** `002_create_relocation_plans.sql:49–55`

```sql
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;
```

Sets `updated_at` to the current UTC timestamp before any UPDATE operation.

**Applied to:**

| Table | Trigger name |
|---|---|
| `relocation_plans` | `update_relocation_plans_updated_at` |
| `checklist_progress` | `update_checklist_progress_updated_at` |
| `user_subscriptions` | `update_user_subscriptions_updated_at` |

**NOT applied to:**

| Table | Notes |
|---|---|
| `profiles` | `updated_at` has a default but no trigger |
| `guides` | `updated_at` has no trigger; set manually if needed |

---

## 8. Row-Level Security

RLS is enabled on all five application tables. All policies follow the same pattern: users may only access rows where the `user_id` (or `id` for profiles) matches `auth.uid()`.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | `auth.uid() = id` | `auth.uid() = id` | `auth.uid() = id` | `auth.uid() = id` |
| `relocation_plans` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `checklist_progress` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `guides` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `user_subscriptions` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | *(no delete policy)* |

**Note on `user_subscriptions`:** No DELETE policy is defined. Users cannot delete their own subscription row through the API. Deletion only occurs via the cascade from `auth.users`.

**No admin or service-role policies are defined in the migration scripts.** Any server-side operations that need to bypass RLS must use the Supabase service role key. The application currently uses only the anon key — which means all database operations are subject to RLS.

---

## 9. Indexes

| Index name | Table | Columns | Type | Notes |
|---|---|---|---|---|
| `relocation_plans_user_id_idx` | `relocation_plans` | `user_id` | B-tree | Fast lookup by user |
| `relocation_plans_current_per_user` | `relocation_plans` | `user_id` WHERE `is_current = true` | Partial unique | Enforces one current plan per user |
| `relocation_plans_status_idx` | `relocation_plans` | `status` | B-tree | Fast filter by status |
| `checklist_progress_user_id_idx` | `checklist_progress` | `user_id` | B-tree | |
| `checklist_progress_plan_id_idx` | `checklist_progress` | `plan_id` | B-tree | |
| `guides_user_id_idx` | `guides` | `user_id` | B-tree | |
| `guides_plan_id_idx` | `guides` | `plan_id` | B-tree | |
| `guides_destination_idx` | `guides` | `destination` | B-tree | |
| `idx_guides_type` | `guides` | `guide_type` | B-tree | Added by migration 007 |
| `idx_guides_user_destination` | `guides` | `(user_id, destination, purpose, guide_type)` | Composite B-tree | Added by migration 007 |
| `user_subscriptions_user_id_idx` | `user_subscriptions` | `user_id` | B-tree | |
| `user_subscriptions_tier_idx` | `user_subscriptions` | `tier` | B-tree | |
| `user_subscriptions_status_idx` | `user_subscriptions` | `status` | B-tree | |

**The partial unique index** `relocation_plans_current_per_user` is the most architecturally significant index. It guarantees at the database level that a user cannot have two plans with `is_current = true` simultaneously. `switchCurrentPlan()` relies on this constraint.

---

## 10. Client Architecture

GoMate uses `@supabase/ssr` for all client instantiation. There are two separate factory functions for browser and server contexts.

### Browser client — `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr"
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
```

Used in React components and client-side hooks. Reads credentials from `NEXT_PUBLIC_*` environment variables. Throws if variables are missing.

### Server client — `lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr"
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) { /* sets cookies, ignores errors from Server Components */ }
    }
  })
}
```

Used in API routes, Server Components, and server actions. Reads session from the request cookie store. The `setAll` implementation silently ignores cookie-setting errors when called from Server Components — this is intentional, as the middleware handles session refresh.

**Both clients use the anon key**, not the service role key. All database operations are subject to RLS.

---

## 11. Session and Middleware

### `lib/supabase/middleware.ts` — `updateSession()`

Called on every request. Responsibilities:

1. **Creates a server-side Supabase client** using the request's cookies
2. **Calls `supabase.auth.getUser()`** to verify the session token
3. **Enforces protected routes**: If the path starts with `/dashboard`, `/chat`, `/guides`, `/booking`, or `/settings` and the user is not authenticated, redirects to `/auth/login`
4. **Redirects authenticated users** away from auth pages (`/auth/*`) to `/dashboard`
5. **Redirects authenticated users** from root `/` to `/dashboard`

**Graceful degradation:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing or empty, the middleware logs a warning and passes the request through **without auth enforcement**. This allows the application to load in environments without Supabase configured.

**Error handling:** Any error during session verification is caught, logged, and the request is allowed to proceed. This means a Supabase outage does not lock all users out — but it also means a bad session could pass through.

### `middleware.ts` — Next.js entry point

```typescript
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

Applies to all routes **except** static assets (`_next/static`, `_next/image`, `favicon.ico`) and image file extensions (`.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`).

Applied to: all page routes, all API routes, all app directory routes.

---

## 12. Application-Layer Helpers

### `lib/gomate/supabase-utils.ts`

Two functions for profile persistence from within the chat flow.

#### `saveProfileToSupabase(profile)`

Called by `app/api/chat/route.ts` after each successful extraction turn.

Behaviour:
1. Gets authenticated user
2. Finds the user's current plan (`is_current = true`)
3. If plan exists: merges `profile` into `plan.profile_data` and writes back
4. Auto-generates or updates the plan `title` if:
   - The current title is absent or starts with `"Plan "` (auto-generated)
   - AND the merged profile now has `destination`
   - Title format: `"{Purpose} in {Destination}"` if purpose is known, otherwise `"Move to {Destination}"`
5. If no plan exists: creates a new plan with `stage: "collecting"`, `is_current: true`

Returns `boolean` — `true` on success, `false` on any error.

#### `loadProfileFromSupabase()`

Loads the `profile_data` from the user's current plan. Returns `Profile | null`.

Used as fallback when the client does not send a profile in the request body.

### `lib/gomate/plan-factory.ts`

The primary interface for plan CRUD operations. All functions are `"use server"` and require authentication.

| Function | Signature | Description |
|---|---|---|
| `getCurrentPlan()` | `() → RelocationPlan \| null` | Returns plan where `is_current = true`. Falls back to most-recent plan and promotes it to current if no current exists. |
| `createPlan()` | `(profile?, title?) → RelocationPlan \| null` | Clears `is_current` from all existing plans, inserts new plan as current. Auto-generates title if not provided. |
| `switchCurrentPlan()` | `(planId) → RelocationPlan \| null` | Verifies ownership, clears all `is_current`, sets target plan as current. |
| `listUserPlans()` | `() → RelocationPlan[]` | Returns all plans, current first, then by creation date descending. |
| `renamePlan()` | `(planId, title) → boolean` | Updates `title` and `updated_at`. |
| `archivePlan()` | `(planId) → boolean` | Sets `status = 'archived'`, `is_current = false`. |
| `updatePlanProfile()` | `(planId, profileData) → RelocationPlan \| null` | Fetches current `profile_data`, merges `profileData` into it, writes back. |
| `updatePlanStage()` | `(planId, stage) → RelocationPlan \| null` | Sets `stage` to the given `PlanStage` value. |
| `getOrCreatePlan()` | `() → RelocationPlan \| null` | Returns existing current plan or creates a new one. |

All functions validate user ownership before writing. All errors are logged with `[GoMate]` prefix and return `null` or `false`.

---

## 13. Known Issues and Gaps

### A — Migration 004 is missing

**Authoritative ruling (2026-03-01):** This gap is permanent. Do **not** create a `scripts/004_*.sql` file to fill it. The gap originated in early development (likely a migration that was applied directly or a file that was deleted before the repository was committed) and has no functional consequence — Supabase applies migrations by filename alphabetical order, not by enforcing strict sequential integers.

The practical effect: migration `005` and all subsequent migrations have been applied to production without error. The gap causes no issues and must not be "fixed". The next available migration number is `015`. See `CLAUDE.md § Critical Architecture Facts → Migration State`.

If an automated migration tool is ever introduced that requires sequential numbering, the gap would need to be addressed at that time with a no-op placeholder file. For now, leave it.

### B — Migration 002 is destructive

`drop table if exists public.relocation_plans cascade` at the top of the file will destroy all plan data if applied to a database with existing rows. This script is not safe to run idempotently on a production database.

### C — `profiles.updated_at` has no trigger

The `update_updated_at_column()` trigger function is not attached to `profiles`. Profile rows do not auto-update `updated_at`. Any consumer relying on `profiles.updated_at` to detect stale data will get incorrect results.

### D — `guides.updated_at` has no trigger

Same as profiles. Guide rows do not auto-update `updated_at` on UPDATE.

### E — `guides.status` lifecycle not driven by application

The `guides` table defines a status progression (`draft` → `generating` → `complete` → `archived`). The application inserts guides directly as complete objects — the `status` field is not cycled through its lifecycle states. The guide's actual generation state is therefore not reflected in `guides.status`.

### F — `guide_type` column is unused in generation logic

Migration 007 adds `guide_type` and an index on it. `lib/gomate/guide-generator.ts` does not set or use `guide_type` when creating guides. The column exists with default `'main'` but carries no semantic value in the current implementation.

### G — Stripe columns are unpopulated placeholders

`stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id` exist in `user_subscriptions` but are never written to. No Stripe integration is implemented.

### H — No audit or event table

There is no table to record state changes, profile mutations, or system events. The history of a plan's evolution cannot be queried from the database.

### I — Two plan creation paths

Plans can be created by either:
- `createPlan()` in `plan-factory.ts`
- `saveProfileToSupabase()` in `supabase-utils.ts` (creates a plan if none exists)
- `GET /api/profile` (creates a plan inline if none exists)

These paths are not fully synchronized. They use different logic, different defaults, and different column sets. A plan created by `saveProfileToSupabase()` may not have `title` populated; one created by `GET /api/profile` will not have `title` populated either.

---

## 14. Gap Analysis

| Design Contract Requirement | Reality | Status |
|---|---|---|
| Durable profile data storage | `relocation_plans.profile_data` JSONB | **Exists** |
| RLS for user isolation | Enabled on all 5 tables | **Exists** |
| Cascade delete on user removal | Configured on all tables | **Exists** |
| Auto-profile creation on signup | `handle_new_user()` trigger | **Exists** |
| Sequential migration history | Scripts 001–003, 005–009 (gap at 004) | **Partial** |
| State event / mutation audit table | Not implemented | **Missing** |
| `profiles.updated_at` auto-update | No trigger on `profiles` | **Missing** |
| `guides.updated_at` auto-update | No trigger on `guides` | **Missing** |
| Profile synchronization protocol (Batch 5) | No formal sync — direct merge writes | **Missing** |
| Singleton Data Registry (Batch 5) | Not implemented | **Missing** |
| Job state persistence table | No job table | **Missing** |
| Stripe payment integration | Columns exist; no integration | **Partial** |
| `guide_type` semantics leveraged | Column exists; not used in logic | **Partial** |
| `guides.status` lifecycle driven by app | Schema supports it; app bypasses it | **Partial** |

---

## 15. Target State

The Batch 5 Contracts (Foundation Completion) describe two persistence-related capabilities not yet implemented:

### State Persistence

The target architecture persists discrete state values rather than deriving them. This would require:

- An `interview_state` column on `relocation_plans` (or equivalent)
- An event/mutation log table tracking every state transition with timestamps and actor

### Profile Synchronization Protocol

The target envisions a formal synchronization protocol for keeping profile data consistent across multiple systems (chat state, research results, plan data). Currently, profile data is written directly via `saveProfileToSupabase()` on each turn with no versioning, no conflict detection, and no consistency guarantees beyond the last-write-wins merge in `updatePlanProfile()`.

### Audit Trail

An audit log table would capture:
- When each field was first answered
- When each field's value changed
- What the previous value was
- Which turn (trace_id) caused the change

This is required by the Observability and Replay contracts in Batch 4 and does not exist in any form today.

---

*Document generated from direct code analysis of all files listed in the header. All claims are traceable to those files.*
