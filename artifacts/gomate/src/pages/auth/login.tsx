import { useState, type FormEvent } from "react"
import { Link } from "wouter"
import { useRouter } from "@/lib/router-compat"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight, AlertCircle } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGuestLoading, setIsGuestLoading] = useState(false)
  const router = useRouter()

  const handleGuestContinue = async () => {
    const supabase = createClient()
    setIsGuestLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      router.push("/onboarding")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start guest session")
      setIsGuestLoading(false)
    }
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push("/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 relative"
      style={{
        background:
          "linear-gradient(180deg, #FAFAF6 0%, #F1F5F0 60%, #E6EFE3 100%)",
      }}
    >
      {/* Decorative background — soft sage glows top-left and
          bottom-right so the page reads warm rather than flat-white. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 50% 40% at 0% 0%, rgba(94,232,156,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(27,58,45,0.10) 0%, transparent 65%)",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Brand mark + serif headline. Uses the GoMate
            globe-and-airplane logo (same one users see in marketing
            and the favicon) at a generous size so the page reads as
            a real landing surface, not a generic auth form. */}
        <div className="flex flex-col items-center gap-4 mb-7">
          <img
            src="/images/gomate-logo-round.png"
            alt="GoMate"
            className="w-24 h-24 object-contain"
          />
          <div className="text-center">
            <h1
              className="font-sans tracking-tight text-foreground"
              style={{ fontSize: "30px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.012em" }}
            >
              GoMate
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
              Your move, planned together — visa, budget, paperwork, settling-in.
            </p>
          </div>
        </div>

        {/* Editorial card — 3px sage stripe + soft shadow, matching
            the dashboard / settings card chrome. */}
        <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card shadow-[0_12px_40px_rgba(20,48,42,0.08)]">
          <div
            className="h-[3px]"
            style={{
              background:
                "linear-gradient(90deg, #0F172A 0%, #334155 60%, #0D9488 100%)",
            }}
          />
          <div className="p-7 md:p-8">
            <div className="text-center mb-6">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-700 dark:text-emerald-400">
                Sign in
              </p>
              <h2
                className="font-sans tracking-tight text-foreground mt-1.5"
                style={{ fontSize: "24px", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.012em" }}
              >
                Welcome back
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                Continue planning your move where you left off.
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[12px] font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl border-stone-200 dark:border-stone-800 focus-visible:ring-[#334155]/40 focus-visible:border-[#334155]/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[12px] font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl border-stone-200 dark:border-stone-800 focus-visible:ring-[#334155]/40 focus-visible:border-[#334155]/40"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-rose-700 dark:text-rose-300">{error}</p>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl gap-2 text-white shadow-md disabled:opacity-70"
                  style={{
                    background:
                      "linear-gradient(180deg, #334155 0%, #1E293B 100%)",
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-stone-200 dark:border-stone-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900/40"
              onClick={handleGuestContinue}
              disabled={isGuestLoading || isLoading}
              data-testid="continue-as-guest"
            >
              {isGuestLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Starting guest session…
                </>
              ) : (
                "Continue as guest"
              )}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Try GoMate without signing up — save your progress later.
            </p>

            <div className="mt-6 pt-5 border-t border-stone-200/70 dark:border-stone-800 text-center text-[13px] text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="font-semibold text-[#334155] dark:text-emerald-400 hover:underline"
              >
                Create one
              </Link>
            </div>
          </div>
        </div>

        {/* Tiny legal foot — replaces the redundant "official sources"
            link with a quieter trust message. */}
        <p className="text-center text-[11px] text-muted-foreground mt-5 leading-relaxed">
          GoMate provides informational guidance only. Verify every detail with{" "}
          <strong className="font-semibold text-foreground">official sources</strong>.
        </p>
      </div>
    </div>
  )
}
