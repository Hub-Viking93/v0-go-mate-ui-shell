// =============================================================
// /onboarding — wizard welcome / overview screen.
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
  { title: "Profile", body: "Name, citizenship, languages, what you do — the basics about you." },
  { title: "Destination", body: "Where you're going, when, and how long you plan to stay." },
  { title: "Purpose", body: "Studying, working, settling, or remote? We adapt to your situation." },
  { title: "Visa & finance", body: "Visa history, savings, and how you'll fund your move." },
  { title: "Review", body: "Confirm everything looks right, then we generate your plan." },
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
    return () => { cancelled = true }
  }, [router])

  const handleStart = () => router.push("/onboarding/profile")

  return (
    <div className="min-h-screen gm-canvas flex flex-col">
      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-14 flex flex-col">
        <div className="max-w-3xl mx-auto w-full">
          <div className="gm-surface px-6 sm:px-10 py-8 sm:py-10">
            <span className="gm-eyebrow">Welcome to GoMate</span>
            <h1
              className="font-sans tracking-tight text-[#1F2A24] mt-3"
              style={{ fontSize: "26px", fontWeight: 600, lineHeight: 1.1 }}
            >
              Let's plan your move, together.
            </h1>
            <p className="text-[13px] text-[#4E5F57] mt-2.5 max-w-xl leading-relaxed">
              A short setup that builds your personalized relocation plan — visa pathway, timeline,
              budget, and the practical stuff for landing.
            </p>

            <div className="my-7 h-px bg-[#ECF1EC]" aria-hidden />

            <ol className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="gm-surface-sub flex flex-col px-3 py-3 min-h-[120px]"
                >
                  <span className="gm-eyebrow !text-[10px]">Step {i + 1}</span>
                  <h3 className="text-[13px] font-semibold text-[#1F2A24] mt-2">
                    {step.title}
                  </h3>
                  <p className="text-[11.5px] text-[#7E9088] mt-1.5 leading-relaxed flex-1">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-[12px] text-[#7E9088] text-center max-w-xl mx-auto">
              When you finish, we'll generate your visa pathway, budget, timeline, and document
              checklist — about 5 minutes, save and resume anytime.
            </p>
          </div>
        </div>
      </main>

      <footer
        className="bg-white"
        style={{
          borderTop: "1px solid #DCE7DF",
          boxShadow: "0 -4px 12px -8px rgba(31, 42, 36, 0.08)",
        }}
      >
        <div className="px-4 sm:px-6 py-3.5 max-w-3xl mx-auto w-full flex flex-col-reverse sm:flex-row items-center sm:justify-between gap-3">
          <nav className="flex items-center gap-3 text-[11px] text-[#7E9088]">
            <Link href="/legal/terms" className="hover:text-[#1F2A24] transition-colors">
              Terms
            </Link>
            <span aria-hidden className="text-[#DCE7DF]">·</span>
            <Link href="/legal/privacy" className="hover:text-[#1F2A24] transition-colors">
              Privacy
            </Link>
            <span aria-hidden className="text-[#DCE7DF]">·</span>
            <Link href="/legal/disclaimer" className="hover:text-[#1F2A24] transition-colors">
              Disclaimer
            </Link>
          </nav>
          <Button
            type="button"
            onClick={handleStart}
            disabled={loading}
            size="sm"
            className="gap-1.5 rounded-md bg-[#24332C] text-white hover:bg-[#2D3E36] shadow-sm h-9 px-4 text-[12.5px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                {hasStarted ? "Continue" : "Start"}
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  )
}
