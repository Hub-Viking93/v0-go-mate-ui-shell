"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  MessageSquare, 
  BookOpen, 
  Plane, 
  Settings,
  Globe,
  LogOut
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Guides", href: "/guides", icon: BookOpen },
  { name: "Booking", href: "/booking", icon: Plane },
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
        <div className="flex grow flex-col gap-y-6 overflow-y-auto bg-transparent border-r border-border px-5 py-8">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <img 
                src="/images/gomate-logo.png" 
                alt="GoMate" 
                className="w-5 h-5"
              />
            </div>
            <span className="text-lg font-semibold text-foreground">GoMate</span>
          </Link>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Sidebar Footer */}
          <div className="space-y-4">
            <a 
              href="https://gomaterelocate.com/country-guides" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block rounded-2xl bg-accent p-3.5 hover:bg-accent/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Country Guides</p>
                  <p className="text-xs text-muted-foreground">gomaterelocate.com</p>
                </div>
              </div>
            </a>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
            <div className="text-center">
              <p className="text-xs text-muted-foreground/60">
                Built by{" "}
                <a 
                  href="https://www.gomaterelocate.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  GoMate
                </a>
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img 
            src="/images/gomate-logo.png" 
            alt="GoMate" 
            className="w-8 h-8"
          />
          <span className="text-lg font-bold text-foreground">GoMate</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="lg:pl-60">
        <div className="min-h-[calc(100vh-4rem)] lg:min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
      </main>

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
