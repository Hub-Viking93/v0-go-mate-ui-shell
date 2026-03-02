# Subscription System — System Document

**Phase:** 4.3
**Status:** Reality-first (documents what exists)
**Primary sources:**
- `lib/gomate/tier.ts` (419 lines)
- `app/api/subscription/route.ts` (124 lines)
- `scripts/008_create_subscriptions.sql`
**Last audited:** 2026-02-25

---

## 1. Overview

The subscription system controls feature access and plan creation limits across three tiers. The tier logic, feature matrix, and pricing configuration are fully implemented in `tier.ts`. Stripe payment processing fields exist in the database schema but **no Stripe integration is implemented**. Subscriptions can currently only be modified via direct API calls (no user-facing payment flow).

---

## 2. Types

```typescript
export type Tier = "free" | "pro_single" | "pro_plus"
export type BillingCycle = "one_time" | "monthly" | "quarterly" | "biannual" | "annual"
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due"
```

---

## 3. UserSubscription Interface

```typescript
export interface UserSubscription {
  id: string
  user_id: string
  tier: Tier
  billing_cycle: BillingCycle | null
  status: SubscriptionStatus
  plan_limit: number
  price_sek: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  started_at: string
  expires_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}
```

---

## 4. Feature Access Matrix

12 features × 3 tiers:

| Feature | Free | Pro Single | Pro+ |
|---|---|---|---|
| `chat` | ✓ | ✓ | ✓ |
| `visa_recommendation` | ✗ | ✓ | ✓ |
| `local_requirements` | ✗ | ✓ | ✓ |
| `cost_of_living` | ✗ | ✓ | ✓ |
| `budget_planner` | ✗ | ✓ | ✓ |
| `guides` | ✗ | ✓ | ✓ |
| `documents` | ✗ | ✓ | ✓ |
| `booking` | ✗ | ✓ | ✓ |
| `plan_switcher` | ✗ | ✗ | ✓ |
| `post_relocation` | ✗ | ✗ | ✓ |
| `compliance_alerts` | ✗ | ✗ | ✓ |
| `post_arrival_assistant` | ✗ | ✗ | ✓ |

**Free tier** gets chat only. **Pro Single** unlocks all pre-relocation features (8 features). **Pro+** adds multiple plans + post-arrival features (4 additional).

**Gap:** Feature checks via `canAccessFeature()` are called from `app/api/subscription/route.ts` to build the feature map for the client. However, individual API routes (e.g., `/api/research/visa`, `/api/guides`) do **not** call `canAccessFeature()` before serving requests. Feature gating is client-side only — a free-tier user who bypasses the UI can call any API endpoint directly.

---

## 5. Pricing Configuration

6 `PricingOption` entries in `PRICING`:

| Label | Tier | Billing cycle | Price (SEK) | Plan limit | Savings |
|---|---|---|---|---|---|
| Free | free | null | 0 | 1 | — |
| Pro Single | pro_single | one_time | 699 | 1 | — |
| Pro+ Monthly | pro_plus | monthly | 249/mo | 999 | — |
| Pro+ 3 Months | pro_plus | quarterly | 599 | 999 | 20% |
| Pro+ 6 Months | pro_plus | biannual | 999 | 999 | 33% |
| Pro+ Annual | pro_plus | annual | 1 699 | 999 | 43% |

**Note on plan_limit:** Pro+ sets `plan_limit = 999` (effectively unlimited). Free and Pro Single set `plan_limit = 1`.

**Note on price_sek:** The `user_subscriptions` table comment says `"stored in SEK oere/cents"` but the values stored (699, 249, etc.) are whole Swedish kronor, not öre. The comment is misleading.

**Note on Pro Single:** Billing cycle is `one_time` — a lifetime purchase with no expiry. `upgradeSubscription()` only computes `expires_at` for recurring billing cycles; `one_time` receives `expires_at = null`.

---

## 6. user_subscriptions Table (migration 008)

### 6.1 Column Definitions

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `user_id` | uuid FK → auth.users | cascade delete; UNIQUE constraint |
| `tier` | text | free / pro_single / pro_plus |
| `billing_cycle` | text | null for free; one_time / monthly / quarterly / biannual / annual |
| `status` | text | active / cancelled / expired / past_due |
| `plan_limit` | integer | 1 (free/pro_single), 999 (pro_plus) |
| `price_sek` | integer | Whole SEK despite column comment saying "oere/cents" |
| `stripe_customer_id` | text | null — Stripe not integrated |
| `stripe_subscription_id` | text | null — Stripe not integrated |
| `stripe_price_id` | text | null — Stripe not integrated |
| `started_at` | timestamptz | Set on upgrade |
| `expires_at` | timestamptz | null for free + one_time |
| `cancelled_at` | timestamptz | Set on downgrade |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | auto-updated via trigger |

### 6.2 Uniqueness Constraint

```sql
constraint unique_active_subscription unique (user_id)
```

One row per user. `upgradeSubscription()` and `downgradeToFree()` UPDATE the existing row rather than INSERT a new one.

### 6.3 RLS Policies

3 policies: select, insert, update — all restricted to `auth.uid() = user_id`. No DELETE policy. Subscriptions cannot be deleted by users (only when the auth user account is deleted, via cascade).

### 6.4 No Auto-Creation Trigger

Unlike the `profiles` table (which has an auto-creation trigger on `auth.users`), `user_subscriptions` has no database trigger. Free tier creation is handled in app code via `ensureSubscription()`, which is called on every authenticated request to the subscription endpoint. If `ensureSubscription()` is never called for a user (e.g., they use the API directly), they may have no subscription record.

---

## 7. Server-Side Functions (tier.ts)

| Function | Description |
|---|---|
| `ensureSubscription(userId?)` | Gets or creates subscription; creates free tier if none exists |
| `getUserTier(userId?)` | Returns current tier; returns "free" if expired or not active |
| `getUserSubscription(userId?)` | Alias for `ensureSubscription()` |
| `canAccessFeature(feature, userId?)` | Async; checks tier → feature matrix |
| `hasFeatureAccess(tier, feature)` | Synchronous; check tier → feature matrix without DB call |
| `canCreatePlan(userId?)` | Counts plans vs plan_limit; returns `{ allowed, current, limit, tier }` |
| `upgradeSubscription(userId, tier, billingCycle)` | Updates DB row; calculates expires_at for recurring cycles |
| `downgradeToFree(userId)` | Sets tier=free, plan_limit=1, cancelled_at=now |

### 7.1 getUserTier() Expiry Check

```typescript
if (sub.status !== "active") return "free"
if (sub.expires_at && new Date(sub.expires_at) < new Date()) return "free"
return sub.tier
```

This implements expiry-based downgrade in memory. However, the `status` column is never automatically updated when a subscription expires — there is no scheduled job or webhook to set `status = "expired"`. A subscription past its `expires_at` will return `"free"` from `getUserTier()` but remain `status = "active"` in the database.

---

## 8. API Endpoints

### 8.1 GET /api/subscription

Returns the full subscription state for the current user.

```typescript
Response: {
  subscription: UserSubscription
  plans: { current: number, limit: number, canCreate: boolean }
  features: Record<Feature, boolean>  // full feature map for the client
  pricing: PricingOption[]            // all 6 pricing options
}
```

`ensureSubscription()` is called, so this endpoint creates a free-tier record if the user has none.

### 8.2 POST /api/subscription

Supports `upgrade` and `downgrade` actions:

**Upgrade flow:**
```
POST /api/subscription
{ action: "upgrade", tier: "pro_single"|"pro_plus", billing_cycle?: string }
│
├── Validate tier (must be free/pro_single/pro_plus)
├── pro_single → only "one_time" billing_cycle allowed
├── pro_plus → requires valid subscription billing cycle
│   (monthly / quarterly / biannual / annual)
│
└── upgradeSubscription(userId, tier, billingCycle)
    → UPDATE user_subscriptions SET tier, billing_cycle, status, plan_limit,
       price_sek, started_at, expires_at, cancelled_at=null
```

**Downgrade flow:**
```
POST /api/subscription
{ action: "downgrade" }
│
└── downgradeToFree(userId)
    → UPDATE user_subscriptions SET tier="free", plan_limit=1,
       price_sek=0, expires_at=null, cancelled_at=now
```

**Gap:** This endpoint modifies subscriptions directly without payment verification. It is explicitly marked in comments as "for testing/admin use" with the note "In the future, this will be called after successful Stripe payment." Any authenticated user can upgrade themselves to any tier for free by calling this endpoint.

---

## 9. Stripe Integration Status

The Stripe integration is scaffolded but not implemented:

| Component | Status |
|---|---|
| `stripe_customer_id` DB column | Exists, always null |
| `stripe_subscription_id` DB column | Exists, always null |
| `stripe_price_id` DB column | Exists, always null |
| Stripe SDK (`stripe` npm package) | Not in package.json |
| Webhook handler route | Does not exist |
| Payment intent creation | Does not exist |
| Checkout session | Does not exist |
| Subscription lifecycle events | Not handled |

Upgrading a subscription via `POST /api/subscription` skips payment entirely and directly writes to the database. This is the current testing/demo mode.

---

## 10. Gap Analysis — Critical Findings

### G-4.3-A: No server-side feature gating on API routes

Feature access checks (`canAccessFeature()`) are only performed when a client requests `GET /api/subscription`. Individual API routes (`/api/research/visa`, `/api/guides`, etc.) do not check feature access. A determined free-tier user can access paid features by calling API endpoints directly.

### G-4.3-B: Subscription expiry not enforced in database

When a Pro+ subscription expires (past `expires_at`), `getUserTier()` returns `"free"` in memory but the DB row remains `status = "active"`. There is no scheduled job, webhook, or trigger to update expired subscriptions. Expired subscriptions are invisible to database-level queries.

### G-4.3-C: No Stripe integration

All three Stripe columns exist but are always null. No payment SDK, no webhook handler, no checkout flow. The subscription system is functional as a data model but cannot process real payments.

### G-4.3-D: Any user can self-upgrade for free

`POST /api/subscription` with `action: "upgrade"` directly modifies the database without requiring payment. This is intentional for development/testing but must be addressed before any production payment flow.

### G-4.3-E: No subscription auto-creation trigger

Free tier creation depends on `ensureSubscription()` being called. If a user authenticates and directly calls API routes without first hitting the subscription endpoint, they may have no subscription record and will fail `canCreatePlan()` checks.

### G-4.3-F: price_sek comment says "oere/cents" but stores whole kronor

The DB column comment is incorrect: `"stored in SEK oere/cents"`. The actual stored values (699, 249, etc.) are whole Swedish kronor. Any future billing integration that treats this column as oere (× 100) will calculate incorrect amounts.

---

## 11. Target State

| Item | Current | Target |
|---|---|---|
| Payment processing | Not implemented | Stripe SDK + webhook handler |
| Feature gating | Client-side only | Server-side check on each API route |
| Subscription expiry | Memory-only check | Scheduled job to update expired status |
| Stripe columns | Always null | Populated on Stripe checkout completion |
| Self-upgrade without payment | Allowed | Remove or protect behind admin auth |
| price_sek semantics | Misleading comment | Clarify: rename to price_sek_whole or fix comment |
| Free tier auto-creation | App code only (ensureSubscription) | DB trigger on auth.users insert |
