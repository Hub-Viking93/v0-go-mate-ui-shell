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
import { RedirectToOnboardingIfCollecting } from "@/pages/chat/redirect-to-onboarding";
// chat-v1 (legacy onboarding chat) is no longer mounted. The v2
// onboarding flow lives at /onboarding (mascot UI) and /chat (post-onboarding
// assistant). Keeping the import + route would expose a stale entry point.
// import ChatV1Page from "@/pages/chat-v1";
import MascotPreviewPage from "@/pages/mascot-preview";
import ProfileFieldChipPreviewPage from "@/pages/dev/profile-field-chip";
import SpecialistCardsPreviewPage from "@/pages/dev/specialist-cards-preview";
import AuditPopoverPreviewPage from "@/pages/dev/audit-popover";
import OnboardingPage from "@/pages/onboarding";
import ResearchPage from "@/pages/research";
import GuidesPage from "@/pages/guides";
import GuideDetailPage from "@/pages/guides/detail";
import VisaWorkspacePage from "@/pages/visa";
import SettingsPage from "@/pages/settings";
import ChecklistPage from "@/pages/checklist";

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
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setLocation(data.session ? "/dashboard" : "/auth/login");
      setResolved(true);
    });
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
      <Route path="/chat"><ProtectedRoute><RedirectToOnboardingIfCollecting><ChatPage /></RedirectToOnboardingIfCollecting></ProtectedRoute></Route>
      {/* /chat-v1 retired — see import comment. */}
      <Route path="/onboarding"><ProtectedRoute><OnboardingPage /></ProtectedRoute></Route>
      <Route path="/research"><ProtectedRoute><ResearchPage /></ProtectedRoute></Route>
      <Route path="/mascot-preview"><MascotPreviewPage /></Route>
      <Route path="/dev/profile-field-chip"><ProfileFieldChipPreviewPage /></Route>
      <Route path="/dev/specialist-cards"><SpecialistCardsPreviewPage /></Route>
      <Route path="/dev/audit-popover"><AuditPopoverPreviewPage /></Route>
      <Route path="/guides"><ProtectedRoute><GuidesPage /></ProtectedRoute></Route>
      <Route path="/guides/:id">
        {(params) => <ProtectedRoute><GuideDetailPage id={params.id} /></ProtectedRoute>}
      </Route>
      <Route path="/visa"><ProtectedRoute><VisaWorkspacePage /></ProtectedRoute></Route>
      <Route path="/pre-departure"><Redirect to="/checklist?tab=pre-move" /></Route>
      <Route path="/checklist"><ProtectedRoute><ChecklistPage /></ProtectedRoute></Route>
      <Route path="/settings"><ProtectedRoute><SettingsPage /></ProtectedRoute></Route>

      {/* Legacy route redirects (preserve query params) */}
      <Route path="/visa-tracker"><Redirect to="/visa" /></Route>
      <Route path="/settling-in"><Redirect to="/checklist?tab=post-move" /></Route>
      <Route path="/documents"><Redirect to="/checklist?tab=documents" /></Route>

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
