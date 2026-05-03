import { useEffect, useState, type ReactNode } from "react"
import { useLocation } from "wouter"
import { Loader2 } from "lucide-react"

/**
 * Wraps the legacy /chat page so users who are still in the "collecting"
 * stage are sent to the new mascot-driven /onboarding flow. Post-
 * onboarding users (locked plan, onboardingCompleted, or any non-
 * collecting stage) continue to see the legacy /chat page as the
 * free-form coach.
 */
export function RedirectToOnboardingIfCollecting({
  children,
}: {
  children: ReactNode
}) {
  const [, navigate] = useLocation()
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const r = await fetch("/api/profile")
        if (!r.ok) {
          if (!cancelled) setDecided(true)
          return
        }
        const data = await r.json()
        const plan = data.plan ?? {}
        const stage = plan.stage as string | undefined
        const stillOnboarding =
          (!stage || stage === "collecting") &&
          !plan.locked &&
          !plan.onboarding_completed
        if (cancelled) return
        if (stillOnboarding) {
          navigate("/onboarding", { replace: true })
          return
        }
        setDecided(true)
      } catch {
        if (!cancelled) setDecided(true)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (!decided) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  return <>{children}</>
}
