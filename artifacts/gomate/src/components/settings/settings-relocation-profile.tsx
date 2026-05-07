// =============================================================
// SettingsRelocationProfile — full relocation profile editor
// =============================================================
// Lifted from the retired Dashboard "Profile" tab during the IA
// refresh. Lives on /settings now since it represents styrdata
// (profile fields that drive recommendations) rather than overview.
//
// Loads its own plan + profile state so the surrounding Settings
// page doesn't need to change shape.
// =============================================================

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Loader2, MessageSquare, Shield } from "lucide-react";
import { ProfileDetailsCard } from "@/components/profile-details-card";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/router-compat";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/gomate/profile-schema";

interface PlanRow {
  id: string;
  is_locked: boolean | null;
  profile_data: Record<string, unknown> | null;
}

export function SettingsRelocationProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: plan } = await supabase
        .from("relocation_plans")
        .select("id, is_locked, profile_data")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .maybeSingle<PlanRow>();
      if (cancelled) return;
      if (plan) {
        setProfile((plan.profile_data ?? {}) as Profile);
        setIsLocked(Boolean(plan.is_locked));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-6 flex items-center gap-2 text-sm text-muted-foreground"
        data-testid="settings-relocation-profile"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Loading relocation profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-card p-6"
        data-testid="settings-relocation-profile"
      >
        <h3 className="text-sm font-semibold mb-1">Relocation profile</h3>
        <p className="text-xs text-muted-foreground">
          No active plan yet. Start onboarding to populate your profile.
        </p>
      </div>
    );
  }

  return (
    <section data-testid="settings-relocation-profile" className="space-y-3">
      <ProfileDetailsCard
        profile={profile}
        onFieldClick={
          isLocked
            ? undefined
            : (fieldKey, fieldLabel) => {
                router.push(
                  `/chat?field=${encodeURIComponent(fieldKey)}&label=${encodeURIComponent(fieldLabel)}`,
                );
              }
        }
      />
      {isLocked ? (
        <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-card flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>Profile is locked. Unlock from the dashboard, or chat to ask questions.</span>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0 gap-2 bg-transparent">
            <Link href="/chat">
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </Link>
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" asChild className="w-full gap-2 bg-transparent">
          <Link href="/chat">
            <MessageSquare className="w-3.5 h-3.5" />
            Update profile in chat
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      )}
    </section>
  );
}
