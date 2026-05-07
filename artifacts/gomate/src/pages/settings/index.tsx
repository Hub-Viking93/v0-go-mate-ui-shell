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
import { SettingsRelocationProfile } from "@/components/settings/settings-relocation-profile"
import { PageShell } from "@/components/layout/page-shell"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [passwordResetSent, setPasswordResetSent] = useState(false)
  const { tier, loading: tierLoading, planCount, planLimit, refresh: refreshTier } = useTier()

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
    <PageShell
      title="Settings"
      description="Manage your account, subscription, preferences and data privacy."
      tint="settings"
      testId="settings-page"
    >
      {/* Profile */}
      <div className="gm-surface p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-secondary ring-1 ring-border flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              Identity
            </p>
            <h2 className="text-base font-semibold text-foreground tracking-tight leading-tight">
              Profile
            </h2>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-secondary ring-1 ring-border flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Full Name</Label>
              <Input id="name" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Your name" className="rounded-md h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" value={userEmail} disabled className="rounded-md h-8 text-sm bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="citizenship" className="flex items-center gap-1.5 text-xs">
                <Flag className="w-3 h-3 text-muted-foreground" />
                Citizenship
              </Label>
              <Input id="citizenship" value={citizenship} disabled placeholder="Set via chat interview" className="rounded-md h-8 text-sm bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destination" className="flex items-center gap-1.5 text-xs">
                <Plane className="w-3 h-3 text-muted-foreground" />
                Target Destination
              </Label>
              <Input id="destination" value={destination} disabled placeholder="Set via chat interview" className="rounded-md h-8 text-sm bg-muted/50" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-4">
          {saveMessage && (
            <span className={`text-xs ${saveMessage === "Saved!" ? "text-emerald-600" : "text-destructive"}`}>
              {saveMessage}
            </span>
          )}
          <Button
            size="sm"
            className="h-8 px-3 text-xs rounded-md bg-[#24332C] text-white hover:bg-[#2D3E36] shadow-sm"
            onClick={handleSaveName}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Relocation profile */}
      <div className="gm-surface p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-secondary ring-1 ring-border flex items-center justify-center">
            <Plane className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              Relocation profile
            </p>
            <h2 className="text-base font-semibold text-foreground tracking-tight leading-tight">
              What we know about your move
            </h2>
          </div>
        </div>
        <SettingsRelocationProfile />
      </div>

      {/* Subscription */}
      <div className="gm-surface p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-secondary ring-1 ring-border flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              {tier === "pro" ? "Active subscription" : "Plan"}
            </p>
            <h2 className="text-base font-semibold text-foreground tracking-tight leading-tight">
              Subscription
            </h2>
          </div>
        </div>

        {tierLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-3 w-40 rounded bg-muted" />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary ring-1 ring-border">
                {tier === "pro" ? (
                  <Crown className="w-4 h-4 text-amber-600" />
                ) : (
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{tier === "pro" ? "Pro" : "Free"}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {tier === "free" ? "Free tier" : "Active"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tier === "free"
                    ? "Upgrade to Pro for $39/mo or $299/yr (saves ~36%)."
                    : `Unlimited plans. Currently using ${planCount}${planLimit ? ` of ${planLimit}` : ""}.`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg shrink-0 gap-1.5 h-8 px-3 text-xs"
              onClick={() => setUpgradeModalOpen(true)}
            >
              {tier === "free" ? "Upgrade" : "Manage plan"}
            </Button>
          </div>
        )}
      </div>

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        currentTier={tier}
        onUpgradeComplete={() => { refreshTier() }}
      />

      {/* Preferences */}
      <div className="gm-surface p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-secondary ring-1 ring-border flex items-center justify-center">
            <Moon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              Display
            </p>
            <h2 className="text-base font-semibold text-foreground tracking-tight leading-tight">
              Preferences
            </h2>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-secondary ring-1 ring-border">
              <Moon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Switch to a darker color scheme</p>
            </div>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="gm-surface p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-secondary ring-1 ring-border flex items-center justify-center">
            <Shield className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              Your data
            </p>
            <h2 className="text-base font-semibold text-foreground tracking-tight leading-tight">
              Data & Privacy
            </h2>
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed text-xs">
          Your data privacy is important to us. GoMate stores your relocation preferences and
          planning data securely. We never share your personal information with third parties
          without your explicit consent.
        </p>

        <Separator className="my-3" />

        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg h-8 px-3 text-xs"
            onClick={() => { window.open("/api/account/export", "_blank") }}
          >
            <Download className="w-3.5 h-3.5" />
            Download my data
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Export all your GoMate data including plans, preferences, and saved guides.
          </p>
        </div>

        <Separator className="my-3" />

        <div className="space-y-1.5">
          {!deleteConfirm ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg h-8 px-3 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete my account
            </Button>
          ) : (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
              <p className="text-xs font-medium text-destructive">
                Are you sure? This will permanently delete your account, all plans, guides, and chat history. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 rounded-lg h-8 px-3 text-xs"
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
                  className="rounded-lg h-8 px-3 text-xs"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
        </div>
      </div>

      {/* Security */}
      <div className="gm-surface p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-secondary ring-1 ring-border flex items-center justify-center">
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              Sign-in
            </p>
            <h2 className="text-base font-semibold text-foreground tracking-tight leading-tight">
              Security
            </h2>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Password</p>
            <p className="text-xs text-muted-foreground">
              {passwordResetSent
                ? "Check your email for a password reset link."
                : "Send a password reset link to your email."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg h-8 px-3 text-xs shrink-0"
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
      </div>
    </PageShell>
  )
}
