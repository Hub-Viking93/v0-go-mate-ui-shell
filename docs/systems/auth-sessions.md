# Authentication and Session Management — System Document

**Phase:** 6.1
**Status:** Reality-first
**Primary sources:**
- `middleware.ts` (13 lines)
- `lib/supabase/middleware.ts` (73 lines) — `updateSession()` implementation
- `lib/supabase/client.ts` (14 lines) — browser client factory
- `lib/supabase/server.ts` (37 lines) — server client factory
- `app/auth/login/page.tsx` (136 lines)
- `app/auth/sign-up/page.tsx` (163 lines)
- `app/auth/sign-up-success/page.tsx` (66 lines)
- `app/auth/callback/route.ts` (20 lines)
- `app/(app)/layout.tsx` (16 lines)
- `scripts/001_create_profiles.sql` — profile auto-creation trigger
**Last audited:** 2026-02-25

---

## 1. Overview

GoMate uses Supabase Auth with email/password as the sole authentication mechanism. Session management is implemented via Next.js middleware using the `@supabase/ssr` package. There is no social auth, no OAuth, no SSO, and no password reset flow.

Auth state is maintained by Supabase session cookies set and refreshed on every request by the `updateSession()` middleware function.

---

## 2. Supabase Client Factories

Two separate factory functions create Supabase clients appropriate to their execution context.

### 2.1 Browser Client — `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
```

- Throws a hard `Error` if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing
- Used by: `app/auth/login/page.tsx`, `app/auth/sign-up/page.tsx`
- Reads and writes cookies via the browser's native cookie API
- Handles session refresh automatically via Supabase realtime

### 2.2 Server Client — `lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Silently ignore — setAll from Server Component is expected to fail
        }
      },
    },
  })
}
```

- Also throws a hard `Error` if env vars are missing
- Used by: all API route handlers, `app/auth/callback/route.ts`
- The `setAll` catch block suppresses cookie-setting errors from Server Components (expected when middleware handles refresh)
- The `try/catch` on `setAll` means Server Components cannot set session cookies — they can only read them

**Error handling asymmetry:** `lib/supabase/client.ts` and `lib/supabase/server.ts` throw hard errors on missing env vars. The middleware (`lib/supabase/middleware.ts`) instead logs a warning and continues, allowing the app to render without auth. These are three different behaviors for the same missing-config condition.

---

## 3. Middleware — Route Protection

### 3.1 `middleware.ts` (Top Level)

```typescript
import { updateSession } from "@/lib/supabase/middleware"
import { type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
```

The middleware is a single delegation to `updateSession()`. The matcher covers all routes except Next.js static assets, images, and favicon. Every page request (including API routes) passes through this middleware.

### 3.2 `lib/supabase/middleware.ts` — `updateSession()`

`updateSession()` does three things per request:

1. **Supabase configuration guard:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set, it logs a warning and returns `NextResponse.next()` — allowing all requests to proceed without any auth check. This is a no-op fallback for unconfigured environments.

2. **Session refresh:** Creates a server-side Supabase client and calls `supabase.auth.getUser()`. The `@supabase/ssr` client automatically refreshes the session token if the access token is near expiration, writing updated cookies to the response via `supabaseResponse.cookies.set()`.

3. **Route guards:** Three conditional redirects:

```typescript
// Protected routes — redirect unauthenticated users to login
const protectedPaths = ["/dashboard", "/chat", "/guides", "/booking", "/settings"]
const isProtectedPath = protectedPaths.some((path) =>
  request.nextUrl.pathname.startsWith(path)
)
if (isProtectedPath && !user) {
  // → redirect to /auth/login
}

// Auth pages — redirect authenticated users to dashboard
if (user && request.nextUrl.pathname.startsWith("/auth")) {
  // → redirect to /dashboard
}

// Root redirect for authenticated users
if (user && request.nextUrl.pathname === "/") {
  // → redirect to /dashboard
}
```

**Gap:** The protected path list is hardcoded in `updateSession()`. Adding a new protected route requires modifying this list.

**Gap:** On any error in `updateSession()`, the catch block calls `return supabaseResponse` — which is `NextResponse.next()`. A middleware crash silently allows all requests through without auth.

---

## 4. Sign-Up Flow

### 4.1 Sign-Up Page — `app/auth/sign-up/page.tsx`

Client component. Validates locally:
- Passwords must match
- Password must be ≥ 6 characters (no complexity requirement)

Calls `supabase.auth.signUp()`:

```typescript
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
})
```

On success → navigates to `/auth/sign-up-success`.
On error → renders error string inline.

### 4.2 Sign-Up Success Page — `app/auth/sign-up-success/page.tsx`

Static page. Instructs the user to check their email for a confirmation link. No resend functionality — only a link back to sign-up. No email address displayed to confirm which address received the link.

### 4.3 Email Confirmation Callback — `app/auth/callback/route.ts`

GET handler. Supabase sends users here after clicking the confirmation link:

```typescript
const code = searchParams.get("code")
const next = searchParams.get("next") ?? "/dashboard"

if (code) {
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error) {
    return NextResponse.redirect(`${origin}${next}`)
  }
}

return NextResponse.redirect(`${origin}/auth/error?message=Could not authenticate user`)
```

- `exchangeCodeForSession()` exchanges the one-time code for a session and sets session cookies
- On success → redirects to `next` parameter (defaults to `/dashboard`)
- On failure or missing code → redirects to `/auth/error` with a message query param

**Gap:** The `next` parameter is passed through without validation. A malicious link could set `next=/some-path` to an arbitrary internal path. There is no allowlist check on the `next` value.

### 4.4 Profile Auto-Creation — `on_auth_user_created` DB Trigger

Migration 001 installs a PostgreSQL trigger on `auth.users`:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
as $$
begin
  insert into public.profiles (id, first_name, last_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', null),
    coalesce(new.raw_user_meta_data ->> 'last_name', null),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

When Supabase creates a new user in `auth.users`, this trigger fires synchronously and inserts a row into `public.profiles`. The sign-up form does not pass `first_name` or `last_name` in `raw_user_meta_data`, so those fields are always null on signup. `email` is populated from the Supabase user record.

**Gap:** The trigger is `security definer` — it runs as the function owner (postgres) and bypasses RLS. If the trigger fails, the user row is created in `auth.users` but has no corresponding profile row. No error surfaces to the client.

---

## 5. Login Flow

### 5.1 Login Page — `app/auth/login/page.tsx`

Client component. Calls `supabase.auth.signInWithPassword()`:

```typescript
const { error } = await supabase.auth.signInWithPassword({ email, password })
if (error) throw error
router.push("/dashboard")
```

- On success → `router.push("/dashboard")` (Next.js client navigation, no full redirect)
- On error → renders error message (includes Supabase error messages like "Invalid login credentials")

**Gap:** The login page calls `router.push("/dashboard")` on success. This does not trigger the middleware redirect logic for authenticated users on `/auth/*`. The middleware's auth-page redirect (`/auth` → `/dashboard`) is a fallback, not the primary redirect mechanism. Both paths end at `/dashboard` but via different mechanisms.

---

## 6. Session Lifecycle

### 6.1 Cookie-Based Session

Supabase Auth uses JWT access tokens stored in cookies. The `@supabase/ssr` package handles:
- Reading the session from `request.cookies` in middleware and server components
- Writing refreshed tokens back to `response.cookies` in middleware

Session cookies are HTTP-only and set by Supabase's client libraries. Cookie names follow the pattern `sb-[project-ref]-auth-token`.

### 6.2 Session Refresh Mechanism

On every non-static request, `updateSession()` calls `supabase.auth.getUser()`. If the access token is expired but a valid refresh token exists, the `@supabase/ssr` client performs a refresh and writes the new tokens to the `supabaseResponse` cookies.

The response returned from middleware is `supabaseResponse` (not `NextResponse.next()` or a redirect), which carries the refreshed cookies. This is the standard `@supabase/ssr` pattern.

### 6.3 Session Expiry

Session expiry is controlled by Supabase project settings (default access token lifetime: 3600 seconds / 1 hour). The refresh token lifetime is also configurable in Supabase. These are not documented or configured within the GoMate codebase.

### 6.4 Sign-Out

> **CORRECTION (Phase 7.1 audit):** Sign-out IS implemented. `components/layout/app-shell.tsx` calls `supabase.auth.signOut()` followed by `router.push("/auth/login")` inside `handleSignOut()`. The gap below (G-6.1-A) is **retired**. See correction register in `docs/systems/master-index.md § 8`.

Sign-out is implemented in `AppShell` via `handleSignOut()`. The sign-out button is rendered in the app navigation. There is no dedicated `/api/auth/sign-out` route — sign-out is handled entirely client-side via the Supabase browser client.

---

## 7. Protected Route Architecture

### 7.1 Middleware-Enforced Routes

The following path prefixes are protected by middleware:

| Path prefix | Protected by |
|---|---|
| `/dashboard` | Middleware redirect |
| `/chat` | Middleware redirect |
| `/guides` | Middleware redirect |
| `/booking` | Middleware redirect |
| `/settings` | Middleware redirect |

All are redirected to `/auth/login` if `supabase.auth.getUser()` returns no user.

### 7.2 API Route Protection

API routes are NOT in the protected path list. Each API route independently calls `supabase.auth.getUser()` and returns 401 on no user. This is correct for API routes but means API-level auth is a per-route concern, not middleware-enforced.

Routes that do enforce auth (verified in prior phases): all `app/api/` route handlers call `supabase.auth.getUser()` and return 401.

**Gap:** `app/api/flights/route.ts` does NOT require authentication. The flight search endpoint is accessible without a session.

### 7.3 `app/(app)/layout.tsx` — No Auth Check

```typescript
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <Toaster />
    </>
  )
}
```

The `(app)` route group layout contains no auth check. It delegates entirely to middleware. If middleware is bypassed, disabled, or misconfigured, the `(app)` pages render without any fallback auth gate.

---

## 8. Auth Pages Layout

Auth pages (`/auth/login`, `/auth/sign-up`, `/auth/sign-up-success`, `/auth/error`) are NOT inside the `(app)` route group. They have no shared layout file — each page is a standalone full-page component. There is no `app/auth/layout.tsx`.

---

## 9. Missing Auth Features

| Feature | Status |
|---|---|
| Email/password login | Implemented |
| Email confirmation on signup | Implemented (Supabase default) |
| Password validation | Minimum 6 chars only — no complexity |
| Social auth (Google, GitHub, etc.) | Not implemented |
| Password reset / forgot password | Not implemented — no route, no UI |
| Sign-out | ~~Not implemented~~ — **CORRECTED:** implemented in `AppShell.handleSignOut()` |
| Magic link (passwordless) | Not implemented |
| 2FA / MFA | Not implemented |
| Email resend on signup | Not implemented (sign-up-success links back to sign-up form only) |
| Session timeout UI | Not implemented |
| `next` parameter validation in callback | Not implemented — open redirect risk |

---

## 10. Gap Analysis — Critical Findings

### ~~G-6.1-A: Sign-out is not implemented~~ — RETIRED

> **Correction (Phase 7.1):** This gap is retired. `supabase.auth.signOut()` is called in `components/layout/app-shell.tsx:handleSignOut()`. Users can log out via the app navigation. See `docs/systems/master-index.md § 8` (Correction Register).

### G-6.1-B: No password reset flow

There is no forgot-password page, no `supabase.auth.resetPasswordForEmail()` call, and no password-update handler. Users who forget their password have no recovery path.

### G-6.1-C: Open redirect in `/auth/callback`

The `next` query parameter is passed directly to `NextResponse.redirect()` without validation. A malicious email link could exploit this to redirect users to arbitrary internal paths after authentication (open redirect). The risk is limited to same-origin since `origin` is extracted from the request URL, but any internal path can be targeted.

### G-6.1-D: Middleware error silently allows all requests

The `try/catch` in `updateSession()` returns `NextResponse.next()` on any error. A Supabase outage or SDK exception would make all protected routes publicly accessible.

### G-6.1-E: Inconsistent env-var error handling

`lib/supabase/client.ts` and `lib/supabase/server.ts` throw hard errors on missing env vars. `lib/supabase/middleware.ts` logs a warning and allows requests. Three different error behaviors for the same configuration condition.

### G-6.1-F: Profile trigger failure is silent

If the `on_auth_user_created` trigger fails (e.g., database connectivity issue during signup), a user is created in `auth.users` with no corresponding `public.profiles` row. All profile-dependent features then fail without a clear error. There is no fallback or retry mechanism for trigger failure.

---

## 11. Target State

| Item | Current | Target |
|---|---|---|
| Sign-out | ✅ Implemented — `AppShell.handleSignOut()` calls `supabase.auth.signOut()` | — |
| Password reset | Not implemented | Add `/auth/forgot-password` + `/auth/reset-password` routes |
| Callback `next` validation | None | Allowlist of safe redirect paths |
| Middleware error behavior | Silently allows all requests | Log + return error response or redirect to error page |
| Profile trigger failure | Silent | Alert/retry mechanism or application-layer fallback |
| Password complexity | 6 chars minimum | Add entropy requirements |
| Sign-out after lock | No session management | Clear session or redirect to login after password change |
