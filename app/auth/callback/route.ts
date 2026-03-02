import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const ALLOWED_REDIRECTS = [
  '/', '/dashboard', '/chat', '/settling-in',
  '/guides', '/profile', '/settings', '/booking'
]

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const rawNext = searchParams.get("next") ?? "/dashboard"
  const next = ALLOWED_REDIRECTS.includes(rawNext) ? rawNext : "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error?message=Could not authenticate user`)
}
