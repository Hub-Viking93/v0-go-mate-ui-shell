import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useRouter } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAnonymousSession } from "@/lib/anonymous-session";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Globe,
  LogOut,
  Shield,
  UserCircle2,
  Plane,
  HomeIcon,
  FolderClosed,
  Compass,
} from "lucide-react";
import { LegalFooter } from "@/components/legal-disclaimer";

function GuestModeBanner({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const { isAnonymous, openSaveModal } = useAnonymousSession();
  if (!isAnonymous) return null;

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={openSaveModal}
        data-testid="guest-mode-indicator"
        className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors"
        style={{
          borderColor: "rgba(15, 23, 42, 0.15)",
          background: "rgba(15, 23, 42, 0.04)",
          color: "#0F172A",
        }}
      >
        <UserCircle2 className="w-3.5 h-3.5" />
        <span>Save progress</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openSaveModal}
      data-testid="guest-mode-indicator"
      className="flex w-full items-center gap-2 px-3 py-2 text-left rounded-md transition-colors hover:bg-[#2A3830]"
    >
      <UserCircle2 className="w-3.5 h-3.5 text-[#9CB0A4] shrink-0" />
      <span className="text-[12.5px] text-[#C8D5CC] truncate">Guest — save progress</span>
    </button>
  );
}

// Phase IA — sidebar follows sitemap.md. The seven top-level
// destinations are the single source of truth for primary navigation.
const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Immigration", href: "/immigration", icon: Shield },
  { name: "Pre-move", href: "/pre-move", icon: Plane },
  { name: "Post-move", href: "/post-move", icon: HomeIcon },
  { name: "Documents", href: "/documents", icon: FolderClosed },
  { name: "Plan & Guidance", href: "/guidance", icon: Compass },
  { name: "Settings", href: "/settings", icon: Settings },
];

// Legacy routes that should highlight the corresponding new-IA item in
// the sidebar (so a visitor on /vault still sees Documents lit up).
const LEGACY_ALIAS: Record<string, string> = {
  "/vault": "/documents",
  "/checklist": "/pre-move",
  "/visa": "/immigration",
  "/settling-in": "/post-move",
  "/pre-departure": "/pre-move",
};

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [pathname] = useLocation();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // Wizard flow — no sidebar, no mobile nav. The shell owns its own
  // layout end-to-end so the wizard reads as a focused single task.
  if (pathname.startsWith("/onboarding")) {
    return <div className="min-h-screen gm-canvas">{children}</div>;
  }

  return (
    <div className="min-h-screen gm-canvas">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-56 lg:flex-col">
        <div
          className="relative flex grow flex-col gap-y-6 overflow-y-auto px-3 py-5"
          style={{
            background: "#1F2A24",
            borderRight: "1px solid #14201A",
          }}
        >
          <Link href="/dashboard" className="relative flex items-center gap-2.5 group px-1">
            <img src="/images/gomate-logo.png" alt="GoMate" className="w-7 h-7 object-contain" />
            <span
              className="font-sans text-white text-[15px] font-semibold tracking-tight"
            >
              GoMate
            </span>
          </Link>

          <nav className="relative flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-0.5">
              {navigation.map((item) => {
                // Resolve the active path: a visit to a legacy route
                // (e.g. /vault) should highlight its new-IA equivalent.
                const aliased = LEGACY_ALIAS[pathname] ?? pathname;
                const isActive =
                  aliased === item.href || aliased.startsWith(item.href + "/");
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      data-testid={`sidebar-nav-${item.href.slice(1)}`}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium",
                        "transition-colors duration-150",
                        isActive
                          ? "text-white"
                          : "text-[#C8D5CC] hover:text-white hover:bg-[#2A3830]"
                      )}
                      style={isActive ? { background: "#2C3E33" } : undefined}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#7BB091]" />
                      )}
                      <item.icon
                        className={cn(
                          "w-[16px] h-[16px] transition-colors duration-150",
                          isActive ? "text-[#7BB091]" : "text-[#9CB0A4] group-hover:text-white"
                        )}
                        strokeWidth={isActive ? 2 : 1.7}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="relative space-y-1" style={{ borderTop: "1px solid #2A3830", paddingTop: "12px" }}>
            <GuestModeBanner variant="sidebar" />
            <Link
              href="/chat"
              className="flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium text-[#C8D5CC] hover:text-white rounded-md transition-colors hover:bg-[#2A3830]"
              data-testid="sidebar-ask-gomate"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask GoMate
            </Link>
            <a
              href="https://gomaterelocate.com/country-guides"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium text-[#C8D5CC] hover:text-white rounded-md transition-colors hover:bg-[#2A3830]"
            >
              <Globe className="w-3.5 h-3.5" />
              Country Guides
            </a>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] font-medium text-[#9CB0A4] hover:text-white rounded-md transition-colors hover:bg-[#2A3830]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <header className="lg:hidden sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-border bg-background px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/images/gomate-logo.png" alt="GoMate" className="w-7 h-7 object-contain" />
          <span className="text-base font-semibold text-foreground">GoMate</span>
        </Link>
        <GuestModeBanner variant="mobile" />
      </header>

      {(() => {
        const isChatSurface =
          pathname.startsWith("/chat") || pathname.startsWith("/onboarding")
        if (isChatSurface) {
          return <main className="lg:pl-56">{children}</main>
        }
        return (
          <main className="lg:pl-56">
            <div className="min-h-[calc(100vh-4rem)] lg:min-h-screen pb-20 lg:pb-0">
              {children}
            </div>
            <LegalFooter />
          </main>
        )
      })()}

      {/* "Ask GoMate" floating-action button removed during the IA
          refresh — chat is reachable from the sidebar / dedicated routes
          and the FAB was visually competing with the workspace pages. */}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border">
        <div className="flex items-center justify-around h-14 px-2 overflow-x-auto">
          {navigation.map((item) => {
            const aliased = LEGACY_ALIAS[pathname] ?? pathname;
            const isActive = aliased === item.href || aliased.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[4rem]",
                  isActive ? "text-[#0F172A]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span className="text-[11px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
