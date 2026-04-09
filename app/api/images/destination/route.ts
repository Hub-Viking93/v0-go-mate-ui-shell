import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveGuideImage } from "@/lib/gomate/image-service"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"

/**
 * POST /api/images/destination
 * Resolve a destination hero image (with full fallback chain).
 * Body: { country: string, city?: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tier = await getUserTier(user.id)
    if (!hasFeatureAccess(tier, "guides")) {
      return NextResponse.json({ error: "Guide images require a paid plan" }, { status: 403 })
    }

    const { country, city } = await req.json()
    if (!country || typeof country !== "string") {
      return NextResponse.json({ error: "country is required" }, { status: 400 })
    }

    const image = await resolveGuideImage(country, city || null)
    return NextResponse.json({ image })
  } catch (error) {
    console.error("[GoMate] Error in POST /api/images/destination:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
