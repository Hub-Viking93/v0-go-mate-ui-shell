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
  BookOpen,
  ListChecks,
  Settings,
  Globe,
  LogOut,
  Shield,
  UserCircle2,
  Plane,
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
          borderColor: "rgba(34, 197, 94, 0.30)",
          background: "rgba(34, 197, 94, 0.08)",
          color: "var(--gm-forest)",
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
      className="w-full text-left rounded-2xl p-3 border transition-all hover:border-[var(--primary)]"
      style={{
        borderColor: "rgba(34, 197, 94, 0.25)",
        background: "rgba(34, 197, 94, 0.06)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(34, 197, 94, 0.15)", color: "var(--gm-forest)" }}
        >
          <UserCircle2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: "var(--gm-forest)" }}>
            Guest mode
          </p>
          <p className="text-[11px] text-sidebar-foreground/60 leading-tight">
            Save your progress
          </p>
        </div>
      </div>
    </button>
  );
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  // Sidebar entry point for the conversational flow points at the mascot
  // /onboarding page. That page hands off to the post-onboarding chat
  // automatically when the plan is complete; routing everyone through
  // /onboarding keeps the entry consistent.
  { name: "Chat", href: "/onboarding", icon: MessageSquare },
  { name: "Visa", href: "/visa", icon: Shield },
  { name: "Checklist", href: "/checklist", icon: ListChecks },
  { name: "Guides", href: "/guides", icon: BookOpen },
  { name: "Pre-departure", href: "/pre-departure", icon: Plane },
  { name: "Settings", href: "/settings", icon: Settings },
];

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

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-60 lg:flex-col">
        <div
          className="relative flex grow flex-col gap-y-7 overflow-y-auto border-r border-sidebar-border px-5 py-8"
          style={{
            background:
              "linear-gradient(180deg, #14302A 0%, #1B3A2D 45%, #1F4031 100%)",
          }}
        >
          {/* Subtle radial sage glow at top */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_30%_-10%,rgba(94,232,156,0.18),transparent_55%)]" />
          {/* Grain overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            }}
          />

          <Link href="/dashboard" className="relative flex items-center gap-3 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:rotate-[-3deg]"
              style={{
                background: "linear-gradient(135deg, rgba(94,232,156,0.20), rgba(94,232,156,0.08))",
                boxShadow: "0 0 0 1px rgba(94,232,156,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <img src="/images/gomate-logo.png" alt="GoMate" className="w-5 h-5" />
            </div>
            <span
              className="font-serif text-sidebar-foreground"
              style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "-0.012em" }}
            >
              GoMate
            </span>
          </Link>

          <nav className="relative flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-0.5">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "text-white"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                      )}
                      style={
                        isActive
                          ? {
                              background:
                                "linear-gradient(90deg, rgba(94,232,156,0.16) 0%, rgba(94,232,156,0.04) 100%)",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                            }
                          : undefined
                      }
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                          style={{
                            background: "linear-gradient(180deg, #5EE89C, #2D6A4F)",
                            boxShadow: "0 0 8px rgba(94,232,156,0.55)",
                          }}
                        />
                      )}
                      <item.icon
                        className={cn(
                          "w-5 h-5 transition-all duration-200",
                          isActive ? "scale-110" : "group-hover:scale-105 group-hover:translate-x-0.5",
                        )}
                        strokeWidth={isActive ? 2.2 : 1.7}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="relative space-y-3">
            <GuestModeBanner variant="sidebar" />
            <a
              href="https://gomaterelocate.com/country-guides"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl p-3.5 transition-all group"
              style={{
                background: "linear-gradient(180deg, rgba(94,232,156,0.06), rgba(94,232,156,0.02))",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ background: "rgba(94,232,156,0.14)" }}
                >
                  <Globe className="w-4 h-4 text-sidebar-primary" />
                </div>
                <div>
                  <p
                    className="text-sm text-sidebar-foreground group-hover:text-sidebar-primary transition-colors"
                    style={{ fontFamily: "var(--font-serif)", fontWeight: 600, letterSpacing: "-0.005em" }}
                  >
                    Country Guides
                  </p>
                  <p className="text-[11px] text-sidebar-foreground/45 mt-0.5">gomaterelocate.com</p>
                </div>
              </div>
            </a>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-3 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-white/[0.04]"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-sidebar-border bg-sidebar px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/images/gomate-logo.png" alt="GoMate" className="w-8 h-8" />
          <span className="text-lg font-bold text-sidebar-foreground">GoMate</span>
        </Link>
        <GuestModeBanner variant="mobile" />
      </header>

      <main className="lg:pl-60">
        <div className="min-h-[calc(100vh-4rem)] lg:min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
        <LegalFooter />
      </main>

      {!pathname.startsWith("/chat") && (
        <Link
          href="/chat"
          className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 z-50 flex items-center gap-2 bg-gradient-to-r from-[#1B3A2D] to-[#2D6A4F] text-white px-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:from-[#234D3A] hover:to-[#357A5A] transition-all duration-200"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Ask GoMate</span>
        </Link>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
        <div className="flex items-center justify-around h-16 px-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[4rem]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
