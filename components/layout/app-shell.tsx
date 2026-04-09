"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Home,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  FileText,
  BookOpen,
  ListChecks,
  Settings,
  Globe,
  LogOut,
  Menu,
  Shield,
} from "lucide-react"
import { LegalFooter } from "@/components/legal-disclaimer"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Visa Tracker", href: "/visa-tracker", icon: Shield },
  { name: "Settling In", href: "/settling-in", icon: ListChecks },
  { name: "Guides", href: "/guides", icon: BookOpen },
  { name: "Settings", href: "/settings", icon: Settings },
]

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-60 lg:flex-col">
        <div className="flex grow flex-col gap-y-6 overflow-y-auto bg-sidebar border-r border-sidebar-border px-5 py-8">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sidebar-accent flex items-center justify-center">
              <img
                src="/images/gomate-logo.png"
                alt="GoMate"
                className="w-5 h-5"
              />
            </div>
            <span className="text-lg font-semibold text-sidebar-foreground">GoMate</span>
          </Link>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
                      )}
                      <item.icon className={cn("w-5 h-5 transition-transform duration-200", isActive && "stroke-[2.5] scale-110")} />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Sidebar Footer */}
          <div className="space-y-3">
            <a
              href="https://gomaterelocate.com/country-guides"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl bg-sidebar-accent p-3.5 hover:bg-sidebar-accent/[0.15] transition-colors group border border-sidebar-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sidebar-primary/15 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-sidebar-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-sidebar-foreground group-hover:text-sidebar-primary transition-colors">Country Guides</p>
                  <p className="text-xs text-sidebar-foreground/40">gomaterelocate.com</p>
                </div>
              </div>
            </a>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-3 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
            <div className="text-center">
              <p className="text-xs text-sidebar-foreground/30">
                Built by{" "}
                <a
                  href="https://www.gomaterelocate.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sidebar-foreground/40 hover:text-sidebar-primary transition-colors"
                >
                  GoMate
                </a>
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-sidebar-border bg-sidebar px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img
            src="/images/gomate-logo.png"
            alt="GoMate"
            className="w-8 h-8"
          />
          <span className="text-lg font-bold text-sidebar-foreground">GoMate</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="lg:pl-60">
        <div className="min-h-[calc(100vh-4rem)] lg:min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
        <LegalFooter />
      </main>

      {/* Floating AI Chat Button - visible on all pages except /chat */}
      {!pathname.startsWith("/chat") && (
        <Link
          href="/chat"
          className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 z-50 flex items-center gap-2 bg-gradient-to-r from-[#1B3A2D] to-[#2D6A4F] text-white px-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:from-[#234D3A] hover:to-[#357A5A] transition-all duration-200"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Ask GoMate</span>
        </Link>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
        <div className="flex items-center justify-around h-16 px-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[4rem]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
