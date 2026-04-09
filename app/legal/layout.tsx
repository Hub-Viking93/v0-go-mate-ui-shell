import Link from "next/link"

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-foreground hover:text-primary transition-colors">
          GoMate
        </Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        {children}
      </main>
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        <Link href="/legal/terms" className="hover:underline">Terms</Link>
        {" · "}
        <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
        {" · "}
        <Link href="/legal/disclaimer" className="hover:underline">Disclaimer</Link>
      </footer>
    </div>
  )
}
