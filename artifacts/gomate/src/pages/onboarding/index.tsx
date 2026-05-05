// =============================================================
// /onboarding — wizard welcome / overview screen.
// =============================================================
// First page a new user lands on after sign-up. Sets expectation
// for what's about to happen: 5 quick steps, what each covers,
// and a single Start CTA that drops them into the wizard at
// /onboarding/profile.
//
// Returning users mid-wizard: the CTA reads "Continue" but still
// routes to /onboarding/profile — once we ship steps 2–5 we'll
// compute the next-incomplete step here and route to it.
//
// Returning users with onboarding_completed=true: redirect to
// /dashboard. They've already finished and shouldn't see the
// welcome again.
// =============================================================

import * as React from "react"
import { useRouter } from "@/lib/router-compat"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"

interface PlanResponse {
  plan: {
    onboarding_completed?: boolean
    profile_data?: { name?: string | null } | null
  } | null
}

const STEPS = [
  {
    title: "Profile",
    body: "Name, citizenship, languages, what you do — the basics about you.",
  },
  {
    title: "Destination",
    body: "Where you're going, when, and how long you plan to stay.",
  },
  {
    title: "Purpose",
    body: "Studying, working, settling, or remote? We adapt to your situation.",
  },
  {
    title: "Visa & finance",
    body: "Visa history, savings, and how you'll fund your move.",
  },
  {
    title: "Review",
    body: "Confirm everything looks right, then we generate your plan.",
  },
]

export default function OnboardingWelcomePage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [hasStarted, setHasStarted] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/profile")
      .then((res) => (res.ok ? (res.json() as Promise<PlanResponse>) : null))
      .then((data) => {
        if (cancelled || !data) return
        if (data.plan?.onboarding_completed) {
          router.replace("/dashboard")
          return
        }
        setHasStarted(Boolean(data.plan?.profile_data?.name))
      })
      .catch((err) => {
        console.error("[onboarding/welcome] profile fetch failed", err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const handleStart = () => router.push("/onboarding/profile")

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-2rem)] bg-gradient-to-b from-background to-emerald-50/30 dark:to-emerald-950/10">
      {/* Editorial hero — same visual language as /onboarding/profile and /dashboard */}
      <div
        className="flex-shrink-0 relative overflow-hidden text-white"
        style={{
          background:
            "linear-gradient(135deg, #14302A 0%, #1B3A2D 38%, #234D3A 72%, #2D6A4F 100%)",
          boxShadow:
            "0 2px 8px rgba(20,48,42,0.18), 0 12px 32px rgba(20,48,42,0.20)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 100% 0%, rgba(94,232,156,0.18) 0%, transparent 60%)",
          }}
        />
        <div className="relative px-5 sm:px-8 py-5 sm:py-7 max-w-3xl mx-auto w-full">
          <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-emerald-200/80">
            Welcome to GoMate
          </p>
          <h1
            className="font-serif tracking-tight text-white mt-0.5"
            style={{ fontSize: "22px", fontWeight: 600, lineHeight: 1.2 }}
          >
            Let's plan your move, together.
          </h1>
          <p className="text-[12px] text-emerald-100/80 mt-1.5 max-w-lg">
            A short setup that builds your personalized relocation plan —
            visa pathway, timeline, budget, and the practical stuff for landing.
          </p>
        </div>
      </div>

      <main className="flex-1 flex flex-col px-5 sm:px-8 pt-10 pb-8 max-w-5xl mx-auto w-full">
        <ol className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card p-3.5 transition-shadow hover:shadow-sm"
            >
              <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/70 block">
                Step {i + 1}
              </span>
              <h3 className="text-[13px] font-semibold text-foreground mt-0.5">{step.title}</h3>
              <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-[12px] text-muted-foreground text-center">
          When you finish, we'll generate your visa pathway, budget, timeline, and document
          checklist — about 5 minutes, save and resume anytime.
        </p>
      </main>

      <footer className="flex-shrink-0 border-t border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <div className="px-5 sm:px-8 py-6 max-w-5xl mx-auto w-full flex flex-col-reverse sm:flex-row items-center sm:justify-between gap-4">
          <nav className="flex items-center gap-4 text-xs text-muted-foreground/70">
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <span aria-hidden className="text-muted-foreground/30">·</span>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <span aria-hidden className="text-muted-foreground/30">·</span>
            <Link href="/legal/disclaimer" className="hover:text-foreground transition-colors">
              Disclaimer
            </Link>
          </nav>
          <Button
            type="button"
            onClick={handleStart}
            disabled={loading}
            size="lg"
            className="gap-2 rounded-full bg-gradient-to-r from-[#1B3A2D] to-[#2D6A4F] text-white hover:opacity-95 shadow-md disabled:opacity-50 disabled:bg-stone-200 disabled:from-stone-200 disabled:to-stone-200 disabled:text-stone-400 px-6 h-10"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                {hasStarted ? "Continue" : "Start"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  )
}
