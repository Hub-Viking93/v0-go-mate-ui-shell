

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
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B3A2D] via-[#234D3A] to-[#2D6A4F] p-6 md:p-8 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.15),transparent_60%)]" />
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Shield className="w-7 h-7 text-[#5EE89C]" />
            Settings
          </h1>
          <p className="text-white/60 mt-1.5 text-sm md:text-base">
            Manage your account preferences and privacy settings.
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Profile
        </h2>
        <div className="gm-card-static p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>

            {/* Profile Form */}
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
              <span className={`text-sm ${saveMessage === "Saved!" ? "text-green-600" : "text-destructive"}`}>
                {saveMessage}
              </span>
            )}
            <Button className="rounded-xl" onClick={handleSaveName} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </section>

      {/* Subscription Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Subscription
        </h2>
        <div className="gm-card-static p-6">
          {tierLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${
                  tier === "pro" ? "bg-amber-500/10" : "bg-secondary"
                }`}>
                  {tier === "pro" ? (
                    <Crown className={`w-5 h-5 text-amber-500`} />
                  ) : (
                    <Sparkles className={`w-5 h-5 text-muted-foreground`} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {tier === "pro" ? "Pro" : "Free"}
                    </p>
                    <Badge
                      variant="secondary"
                      className={
                        tier === "pro"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : ""
                      }
                    >
                      {tier === "free" ? "Free tier" : "Active"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {tier === "free"
                      ? "Upgrade to Pro for $39/mo or $299/yr (saves ~36%)."
                      : `Unlimited plans. Currently using ${planCount}.`}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="rounded-xl bg-transparent shrink-0"
                onClick={() => setUpgradeModalOpen(true)}
              >
                {tier === "free" ? "Upgrade" : "Manage plan"}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        currentTier={tier}
        onUpgradeComplete={() => {
          refreshTier()
        }}
      />

      {/* Preferences Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5 text-primary" />
          Preferences
        </h2>
        <div className="gm-card-static divide-y divide-border overflow-hidden">
          {/* Theme */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary">
                <Moon className="w-4 h-4 text-primary" />
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

        </div>
      </section>


      {/* Data & Privacy Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Data & Privacy
        </h2>
        <div className="gm-card-static p-6 space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Your data privacy is important to us. GoMate stores your relocation preferences 
            and planning data securely. We never share your personal information with third 
            parties without your explicit consent.
          </p>
          
          <Separator />
          
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 rounded-xl bg-transparent"
              onClick={() => {
                window.open("/api/account/export", "_blank")
              }}
            >
              <Download className="w-4 h-4" />
              Download my data
            </Button>
            <p className="text-xs text-muted-foreground">
              Export all your GoMate data including plans, preferences, and saved guides.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            {!deleteConfirm ? (
              <Button
                variant="outline"
                className="w-full sm:w-auto gap-2 rounded-xl text-destructive hover:text-destructive bg-transparent"
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
                    className="gap-2"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true)
                      try {
                        const res = await fetch("/api/account/delete", { method: "DELETE" })
                        if (!res.ok) throw new Error()
                        // Sign out and redirect
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
                    className="bg-transparent"
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
        </div>
      </section>

      {/* Security Section */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          Security
        </h2>
        <div className="gm-card-static p-6">
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
              className="rounded-xl bg-transparent"
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
      </section>
    </div>
  )
}
