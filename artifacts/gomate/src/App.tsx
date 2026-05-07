import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/client";
import { AnonymousSessionProvider } from "@/lib/anonymous-session";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/auth/login";
import SignUpPage from "@/pages/auth/sign-up";
import SignUpSuccessPage from "@/pages/auth/sign-up-success";
import AuthErrorPage from "@/pages/auth/error";
import AuthCallbackPage from "@/pages/auth/callback";
import DashboardPage from "@/pages/dashboard";
import ChatPage from "@/pages/chat";
// RedirectToOnboardingIfCollecting retired — /chat is always chat now.
// chat-v1 (legacy onboarding chat) is no longer mounted. The v2
// onboarding flow lives at /onboarding (mascot UI) and /chat (post-onboarding
// assistant). Keeping the import + route would expose a stale entry point.
// import ChatV1Page from "@/pages/chat-v1";
import MascotPreviewPage from "@/pages/mascot-preview";
import ProfileFieldChipPreviewPage from "@/pages/dev/profile-field-chip";
import SpecialistCardsPreviewPage from "@/pages/dev/specialist-cards-preview";
import AuditPopoverPreviewPage from "@/pages/dev/audit-popover";
import OnboardingPage from "@/pages/onboarding";
import OnboardingProfilePage from "@/pages/onboarding/profile";
import OnboardingDestinationPage from "@/pages/onboarding/destination";
import OnboardingStudyPage from "@/pages/onboarding/study";
import OnboardingWorkPage from "@/pages/onboarding/work";
import OnboardingSettlePage from "@/pages/onboarding/settle";
import OnboardingDigitalNomadPage from "@/pages/onboarding/digital-nomad";
import OnboardingVisaFinancePage from "@/pages/onboarding/visa-finance";
import OnboardingReviewPage from "@/pages/onboarding/review";
import ResearchPage from "@/pages/research";
// Guides retired — all the live, state-driven workspaces (Immigration,
// Pre-move, Post-move, Documents, Plan & Guidance) replace the
// generated-PDF-style guide. The composeGuide pipeline is no longer
// triggered by research, and the routes below are gone.
// import GuidesPage from "@/pages/guides";
// import GuideDetailPage from "@/pages/guides/detail";
import VisaWorkspacePage from "@/pages/visa";
import SettingsPage from "@/pages/settings";
import ChecklistPage from "@/pages/checklist";
import VaultPage from "@/pages/vault";
// IA refresh — top-level pages per sitemap.md.
import ImmigrationPage from "@/pages/immigration";
import PreMovePage from "@/pages/pre-move";
import PostMovePage from "@/pages/post-move";
import DocumentsPage from "@/pages/documents";
import GuidancePage from "@/pages/guidance";

// Redirect helper: merges query params into the target. Incoming params
// from the legacy URL win over the target's defaults — so
// /settling-in?tab=documents -> /checklist?tab=documents (preserved),
// while /settling-in (no query) -> /checklist?tab=post-move (default).
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const incoming = typeof window !== "undefined" ? window.location.search : "";
    const [path, targetSearch = ""] = to.split("?");
    const merged = new URLSearchParams(targetSearch);
    const incomingParams = new URLSearchParams(incoming);
    incomingParams.forEach((v, k) => merged.set(k, v));
    const qs = merged.toString();
    setLocation(qs ? `${path}?${qs}` : path, { replace: true });
  }, [setLocation, to]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}

function PublicAuthRoute({ children }: { children: React.ReactNode }) {
  return <AuthGuard requireAuth={false} redirectIfAuthed="/dashboard">{children}</AuthGuard>;
}

// Root redirect: signed-in -> /dashboard, signed-out -> /auth/login.
function RootRedirect() {
  const [, setLocation] = useLocation();
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!sessionData.session) {
        setLocation("/auth/login");
        setResolved(true);
        return;
      }
      // Signed in — decide between onboarding and dashboard.
      // New accounts (no plan, stage=collecting, or empty profile)
      // get sent into the wizard. Everyone else lands on dashboard.
      const userId = sessionData.session.user.id;
      const { data: plan } = await supabase
        .from("relocation_plans")
        .select("stage, profile_data")
        .eq("user_id", userId)
        .eq("is_current", true)
        .maybeSingle();
      if (!mounted) return;
      const needsOnboarding =
        !plan ||
        plan.stage === "collecting" ||
        !plan.profile_data ||
        Object.keys((plan.profile_data ?? {}) as Record<string, unknown>).length === 0;
      setLocation(needsOnboarding ? "/onboarding" : "/dashboard");
      setResolved(true);
    })();
    return () => {
      mounted = false;
    };
  }, [setLocation]);
  if (resolved) return null;
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/"><RootRedirect /></Route>

      <Route path="/auth/login"><PublicAuthRoute><LoginPage /></PublicAuthRoute></Route>
      <Route path="/auth/sign-up"><PublicAuthRoute><SignUpPage /></PublicAuthRoute></Route>
      <Route path="/auth/sign-up-success"><SignUpSuccessPage /></Route>
      <Route path="/auth/error"><AuthErrorPage /></Route>
      <Route path="/auth/callback"><AuthCallbackPage /></Route>

      <Route path="/dashboard"><ProtectedRoute><DashboardPage /></ProtectedRoute></Route>
      {/* /chat is always the assistant — no auto-redirect to /onboarding.
          The wizard stays at /onboarding for users who actually need it.
          Chat is plan-state-aware (system prompt receives stage +
          arrival_date) so it adapts before/after arrival. */}
      <Route path="/chat"><ProtectedRoute><ChatPage /></ProtectedRoute></Route>
      {/* /chat-v1 retired — see import comment. */}
      {/* Wizard onboarding (new flow). The legacy chat-driven onboarding
          still lives at /onboarding for now; once all 5 wizard steps land
          we'll repoint /onboarding -> /onboarding/profile and retire the
          chat extraction path. */}
      <Route path="/onboarding/profile"><ProtectedRoute><OnboardingProfilePage /></ProtectedRoute></Route>
      <Route path="/onboarding/destination"><ProtectedRoute><OnboardingDestinationPage /></ProtectedRoute></Route>
      <Route path="/onboarding/study"><ProtectedRoute><OnboardingStudyPage /></ProtectedRoute></Route>
      <Route path="/onboarding/work"><ProtectedRoute><OnboardingWorkPage /></ProtectedRoute></Route>
      <Route path="/onboarding/settle"><ProtectedRoute><OnboardingSettlePage /></ProtectedRoute></Route>
      <Route path="/onboarding/digital-nomad"><ProtectedRoute><OnboardingDigitalNomadPage /></ProtectedRoute></Route>
      <Route path="/onboarding/visa-finance"><ProtectedRoute><OnboardingVisaFinancePage /></ProtectedRoute></Route>
      <Route path="/onboarding/review"><ProtectedRoute><OnboardingReviewPage /></ProtectedRoute></Route>
      <Route path="/onboarding"><ProtectedRoute><OnboardingPage /></ProtectedRoute></Route>
      <Route path="/research"><ProtectedRoute><ResearchPage /></ProtectedRoute></Route>
      <Route path="/mascot-preview"><MascotPreviewPage /></Route>
      <Route path="/dev/profile-field-chip"><ProfileFieldChipPreviewPage /></Route>
      <Route path="/dev/specialist-cards"><SpecialistCardsPreviewPage /></Route>
      <Route path="/dev/audit-popover"><AuditPopoverPreviewPage /></Route>
      {/* /guides retired — see import comment. Legacy deep links bounce
          to dashboard so users aren't stranded on a 404. */}
      <Route path="/guides"><Redirect to="/dashboard" /></Route>
      <Route path="/guides/:id"><Redirect to="/dashboard" /></Route>
      {/* New IA per sitemap.md ----------------------------------------- */}
      <Route path="/immigration"><ProtectedRoute><ImmigrationPage /></ProtectedRoute></Route>
      <Route path="/pre-move"><ProtectedRoute><PreMovePage /></ProtectedRoute></Route>
      <Route path="/post-move"><ProtectedRoute><PostMovePage /></ProtectedRoute></Route>
      <Route path="/documents"><ProtectedRoute><DocumentsPage /></ProtectedRoute></Route>
      <Route path="/guidance"><ProtectedRoute><GuidancePage /></ProtectedRoute></Route>

      {/* Existing pages still mounted at their internal URLs — they
          underpin the new IA wrappers above and remain reachable for
          deep links and back-compat. */}
      <Route path="/visa"><ProtectedRoute><VisaWorkspacePage /></ProtectedRoute></Route>
      <Route path="/checklist"><ProtectedRoute><ChecklistPage /></ProtectedRoute></Route>
      <Route path="/vault"><ProtectedRoute><VaultPage /></ProtectedRoute></Route>
      <Route path="/settings"><ProtectedRoute><SettingsPage /></ProtectedRoute></Route>

      {/* Legacy route redirects ----------------------------------------- */}
      {/* Pre-IA URLs that no longer match the sidebar map to the new
          top-level destination they live under. */}
      <Route path="/visa-tracker"><Redirect to="/immigration" /></Route>
      <Route path="/pre-departure"><Redirect to="/pre-move" /></Route>
      <Route path="/settling-in"><Redirect to="/post-move" /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AnonymousSessionProvider>
            <Router />
          </AnonymousSessionProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
