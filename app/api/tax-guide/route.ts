import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"
import { getAllSources } from "@/lib/gomate/official-sources"

const TAX_ID_MAP: Record<string, { idName: string; officeName: string }> = {
  DE: { idName: "Steueridentifikationsnummer", officeName: "Finanzamt" },
  GERMANY: { idName: "Steueridentifikationsnummer", officeName: "Finanzamt" },
  NL: { idName: "BSN (Burgerservicenummer)", officeName: "Gemeente (Municipality)" },
  NETHERLANDS: { idName: "BSN (Burgerservicenummer)", officeName: "Gemeente (Municipality)" },
  ES: { idName: "NIE / NIF", officeName: "Oficina de Extranjería" },
  SPAIN: { idName: "NIE / NIF", officeName: "Oficina de Extranjería" },
  PT: { idName: "NIF (Número de Identificação Fiscal)", officeName: "Finanças (Tax Office)" },
  PORTUGAL: { idName: "NIF (Número de Identificação Fiscal)", officeName: "Finanças (Tax Office)" },
  SE: { idName: "Personnummer", officeName: "Skatteverket" },
  SWEDEN: { idName: "Personnummer", officeName: "Skatteverket" },
  JP: { idName: "My Number (マイナンバー)", officeName: "Ward Office (区役所)" },
  JAPAN: { idName: "My Number (マイナンバー)", officeName: "Ward Office (区役所)" },
}

function lookupTaxId(destination: string): { idName: string; officeName: string } | null {
  const key = destination.toUpperCase().replace(/\s+/g, "_")
  return TAX_ID_MAP[key] || null
}

// GET: Assemble tax registration guide data
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "post_arrival_assistant")) {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 })
  }

  const { data: plan, error } = await supabase
    .from("relocation_plans")
    .select("id, profile_data, local_requirements_research")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (error || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  const profile = plan.profile_data as { destination?: string } | null
  const destination = profile?.destination || ""

  const taxIdInfo = lookupTaxId(destination)

  // Find tax + registration categories in local_requirements_research
  const localReq = plan.local_requirements_research as {
    categories?: Array<{
      category: string
      items?: Array<{
        title: string
        steps?: string[]
        documents?: string[]
        estimatedTime?: string
        cost?: string
        officialLink?: string
        tips?: string[]
      }>
    }>
  } | null

  const matchingCategories = (localReq?.categories || []).filter(
    (c) => {
      const cat = c.category?.toLowerCase() || ""
      return cat.includes("tax") || cat.includes("registration")
    }
  )

  const registrationSteps: string[] = []
  const documentsNeeded = new Set<string>()
  const tips: string[] = []
  let estimatedTime: string | null = null
  let cost: string | null = null
  const relatedOfficialLinks: Array<{ name: string; url: string }> = []

  for (const cat of matchingCategories) {
    for (const item of cat.items || []) {
      if (item.steps) registrationSteps.push(...item.steps)
      if (item.documents) {
        for (const d of item.documents) documentsNeeded.add(d)
      }
      if (item.tips) tips.push(...item.tips)
      if (item.estimatedTime && !estimatedTime) estimatedTime = item.estimatedTime
      if (item.cost && !cost) cost = item.cost
      if (item.officialLink) {
        relatedOfficialLinks.push({ name: item.title, url: item.officialLink })
      }
    }
  }

  // Official links from OFFICIAL_SOURCES
  const sources = getAllSources(destination)
  const officialLink = sources?.tax || sources?.immigration || null

  // Determine if we should fall back
  const fallbackToOfficialLink = registrationSteps.length < 2

  return NextResponse.json({
    planId: plan.id,
    destination,
    taxIdName: taxIdInfo?.idName || "Tax ID",
    officeName: taxIdInfo?.officeName || "Local Tax Office",
    registrationSteps,
    documentsNeeded: Array.from(documentsNeeded),
    officialLink,
    relatedOfficialLinks,
    estimatedTime,
    cost,
    tips,
    fallbackToOfficialLink,
  })
}
