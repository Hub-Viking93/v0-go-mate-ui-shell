

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { UpgradeModal } from "@/components/upgrade-modal"
import { useTier } from "@/hooks/use-tier"
import {
  User,
  Moon,
  Shield,
  Download,
  Trash2,
  Flag,
  Plane,
  Lock,
  CreditCard,
  Crown,
  Sparkles,
} from "lucide-react"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [passwordResetSent, setPasswordResetSent] = useState(false)
  const { tier, loading: tierLoading, planCount, planLimit, refresh: refreshTier } = useTier()

  // Fetch real user + profile data
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [citizenship, setCitizenship] = useState("")
  const [destination, setDestination] = useState("")

  useEffect(() => {
    async function loadUserData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? "")
      setUserName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "")

      const { data: plan } = await supabase
        .from("relocation_plans")
        .select("profile_data")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .maybeSingle()

      if (plan?.profile_data) {
        const p = plan.profile_data as Record<string, string | null>
        setCitizenship(p.citizenship ?? "")
        setDestination(p.destination ?? "")
        if (!userName && p.name) setUserName(p.name)
      }
    }
    loadUserData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveName() {
    setSaving(true)
    setSaveMessage(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { full_name: userName },
      })
      if (error) throw error
      setSaveMessage("Saved!")
      setTimeout(() => setSaveMessage(null), 2000)
    } catch {
      setSaveMessage("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-4xl">
      {/* Hero — same editorial gradient + radial glow as the
          dashboard hero so Settings reads as part of the same
          product surface. Eyebrow + serif headline. */}
      <div
        className="relative overflow-hidden rounded-3xl mb-8"
        style={{
          background:
            "linear-gradient(135deg, #14302A 0%, #1B3A2D 38%, #234D3A 72%, #2D6A4F 100%)",
          boxShadow:
            "0 2px 8px rgba(20,48,42,0.18), 0 24px 48px rgba(20,48,42,0.20)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_100%_0%,rgba(94,232,156,0.18),transparent_60%)]" />
        <div className="relative p-7 md:p-9">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-200/80 mb-2">
            Account
          </p>
          <h1
            className="font-serif tracking-tight text-white"
            style={{ fontSize: "32px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.012em" }}
          >
            Settings
          </h1>
          <p className="text-emerald-100/75 mt-2 text-sm md:text-base max-w-xl">
            Manage your account, subscription, preferences and data privacy.
          </p>
        </div>
      </div>

      {/* Profile */}
      <SectionCard
        eyebrow="Identity"
        title="Profile"
        icon={User}
        tint="emerald"
        className="mb-6"
      >
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/15 to-[#1B3A2D]/10 ring-1 ring-emerald-500/30 flex items-center justify-center">
              <User className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Your name" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={userEmail} disabled className="rounded-xl bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="citizenship" className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-muted-foreground" />
                Citizenship
              </Label>
              <Input id="citizenship" value={citizenship} disabled placeholder="Set via chat interview" className="rounded-xl bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination" className="flex items-center gap-2">
                <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                Target Destination
              </Label>
              <Input id="destination" value={destination} disabled placeholder="Set via chat interview" className="rounded-xl bg-muted/50" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          {saveMessage && (
            <span className={`text-sm ${saveMessage === "Saved!" ? "text-emerald-600" : "text-destructive"}`}>
              {saveMessage}
            </span>
          )}
          <Button className="rounded-full px-5" onClick={handleSaveName} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SectionCard>

      {/* Subscription */}
      <SectionCard
        eyebrow={tier === "pro" ? "Active subscription" : "Plan"}
        title="Subscription"
        icon={CreditCard}
        tint="amber"
        className="mb-6"
      >
        {tierLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${tier === "pro" ? "bg-amber-500/15 ring-1 ring-amber-500/30" : "bg-secondary"}`}>
                {tier === "pro" ? (
                  <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-serif text-lg text-foreground">{tier === "pro" ? "Pro" : "Free"}</p>
                  <Badge
                    variant="secondary"
                    className={tier === "pro"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]"
                      : "text-[10px]"}
                  >
                    {tier === "free" ? "Free tier" : "Active"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {tier === "free"
                    ? "Upgrade to Pro for $39/mo or $299/yr (saves ~36%)."
                    : `Unlimited plans. Currently using ${planCount}${planLimit ? ` of ${planLimit}` : ""}.`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-full bg-transparent shrink-0 gap-1.5"
              onClick={() => setUpgradeModalOpen(true)}
            >
              {tier === "free" ? "Upgrade" : "Manage plan"}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        currentTier={tier}
        onUpgradeComplete={() => { refreshTier() }}
      />

      {/* Preferences */}
      <SectionCard
        eyebrow="Display"
        title="Preferences"
        icon={Moon}
        tint="sky"
        className="mb-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 ring-1 ring-sky-200/60 dark:ring-sky-900/40">
              <Moon className="w-4 h-4 text-sky-700 dark:text-sky-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Switch to a darker color scheme</p>
            </div>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>
      </SectionCard>

      {/* Data & Privacy */}
      <SectionCard
        eyebrow="Your data"
        title="Data & Privacy"
        icon={Shield}
        tint="purple"
        className="mb-6"
      >
        <p className="text-muted-foreground leading-relaxed text-[14px]">
          Your data privacy is important to us. GoMate stores your relocation preferences and
          planning data securely. We never share your personal information with third parties
          without your explicit consent.
        </p>

        <Separator className="my-5" />

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto gap-2 rounded-full bg-transparent"
            onClick={() => { window.open("/api/account/export", "_blank") }}
          >
            <Download className="w-4 h-4" />
            Download my data
          </Button>
          <p className="text-xs text-muted-foreground">
            Export all your GoMate data including plans, preferences, and saved guides.
          </p>
        </div>

        <Separator className="my-5" />

        <div className="space-y-2">
          {!deleteConfirm ? (
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 rounded-full text-destructive hover:text-destructive bg-transparent border-destructive/30 hover:border-destructive/50"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete my account
            </Button>
          ) : (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
              <p className="text-sm font-medium text-destructive">
                Are you sure? This will permanently delete your account, all plans, guides, and chat history. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 rounded-full"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true)
                    try {
                      const res = await fetch("/api/account/delete", { method: "DELETE" })
                      if (!res.ok) throw new Error()
                      const supabase = createClient()
                      await supabase.auth.signOut()
                      window.location.href = "/"
                    } catch {
                      setDeleting(false)
                      setDeleteConfirm(false)
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent rounded-full"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
        </div>
      </SectionCard>

      {/* Security */}
      <SectionCard
        eyebrow="Sign-in"
        title="Security"
        icon={Lock}
        tint="rose"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">Password</p>
            <p className="text-sm text-muted-foreground">
              {passwordResetSent
                ? "Check your email for a password reset link."
                : "Send a password reset link to your email."}
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-full bg-transparent"
            disabled={passwordResetSent}
            onClick={async () => {
              if (!userEmail) return
              const supabase = createClient()
              await supabase.auth.resetPasswordForEmail(userEmail, {
                redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
              })
              setPasswordResetSent(true)
            }}
          >
            {passwordResetSent ? "Email sent" : "Reset password"}
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}

// ===========================================================
// SectionCard — editorial card chrome shared by every Settings
// section: 3px tinted stripe, eyebrow + serif headline + icon
// in a soft tinted bubble. Each section gets its own tint
// (emerald/amber/sky/purple/rose) so they're scannable as
// distinct concerns rather than five identical boxes.
// ===========================================================
type SectionTint = "emerald" | "amber" | "sky" | "purple" | "rose"

const TINT_STYLES: Record<SectionTint, { stripe: string; iconBg: string; iconColor: string; eyebrow: string }> = {
  emerald: {
    stripe: "from-emerald-400 via-teal-500 to-emerald-500",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-200/60 dark:ring-emerald-900/40",
    iconColor: "text-emerald-700 dark:text-emerald-400",
    eyebrow: "text-emerald-700 dark:text-emerald-400",
  },
  amber: {
    stripe: "from-amber-400 via-orange-400 to-amber-500",
    iconBg: "bg-amber-50 dark:bg-amber-950/40 ring-amber-200/60 dark:ring-amber-900/40",
    iconColor: "text-amber-700 dark:text-amber-400",
    eyebrow: "text-amber-700 dark:text-amber-400",
  },
  sky: {
    stripe: "from-sky-400 via-blue-500 to-sky-500",
    iconBg: "bg-sky-50 dark:bg-sky-950/40 ring-sky-200/60 dark:ring-sky-900/40",
    iconColor: "text-sky-700 dark:text-sky-400",
    eyebrow: "text-sky-700 dark:text-sky-400",
  },
  purple: {
    stripe: "from-purple-400 via-violet-500 to-purple-500",
    iconBg: "bg-purple-50 dark:bg-purple-950/40 ring-purple-200/60 dark:ring-purple-900/40",
    iconColor: "text-purple-700 dark:text-purple-400",
    eyebrow: "text-purple-700 dark:text-purple-400",
  },
  rose: {
    stripe: "from-rose-400 via-pink-500 to-rose-500",
    iconBg: "bg-rose-50 dark:bg-rose-950/40 ring-rose-200/60 dark:ring-rose-900/40",
    iconColor: "text-rose-700 dark:text-rose-400",
    eyebrow: "text-rose-700 dark:text-rose-400",
  },
}

function SectionCard({
  eyebrow,
  title,
  icon: Icon,
  tint,
  children,
  className,
}: {
  eyebrow: string
  title: string
  icon: typeof User
  tint: SectionTint
  children: React.ReactNode
  className?: string
}) {
  const t = TINT_STYLES[tint]
  return (
    <section className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-card shadow-sm">
        <div className={`h-[3px] bg-gradient-to-r ${t.stripe}`} />
        <div className="p-6 md:p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className={`shrink-0 w-10 h-10 rounded-xl ring-1 flex items-center justify-center ${t.iconBg}`}>
              <Icon className={`w-5 h-5 ${t.iconColor}`} />
            </div>
            <div>
              <p className={`text-[10px] uppercase tracking-[0.14em] font-semibold ${t.eyebrow}`}>
                {eyebrow}
              </p>
              <h2
                className="font-serif text-foreground tracking-tight"
                style={{ fontSize: "20px", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.008em" }}
              >
                {title}
              </h2>
            </div>
          </div>
          {children}
        </div>
      </div>
    </section>
  )
}
