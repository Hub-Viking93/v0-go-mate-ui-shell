// =============================================================
// Seed the TEST_EMAIL user with the data /pre-move/generate needs:
//   - profile_data with destination + arrival
//   - visa_research with applicationSteps
//   - local_requirements_research with Documents/Housing/Banking
//     categories
//   - research_status="completed"
//   - stage="ready_for_pre_departure" (route gate)
//
// One-shot script for the A1 verification — saves the cost of
// running the full wizard + research orchestrator just to land
// the data needed by the composer.
// =============================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = process.env.TEST_EMAIL!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(): Promise<string> {
  let page = 1;
  while (page < 10) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const u = data.users.find(
      (x) => (x.email ?? "").toLowerCase() === TEST_EMAIL.toLowerCase(),
    );
    if (u) return u.id;
    if (data.users.length < 100) break;
    page += 1;
  }
  throw new Error(`User ${TEST_EMAIL} not found`);
}

async function main(): Promise<void> {
  const userId = await findUserId();
  console.log(`user_id=${userId}`);

  const profile = {
    name: "Test Axel",
    destination: "Sweden",
    target_city: "Stockholm",
    citizenship: "Philippines",
    current_location: "Philippines",
    purpose: "settle",
    visa_role: "primary",
    moving_alone: "yes",
    settlement_reason: "family_reunion",
    partner_citizenship: "Sweden",
    partner_visa_status: "citizen",
    relationship_type: "fiance",
    relationship_duration: "1_2_years",
    duration: "permanent",
    timeline: "2028-05-17",
    pets: "none",
    healthcare_needs: "none",
    savings_available: "100000",
    preferred_currency: "PHP",
    prior_visa: "yes",
    prior_visa_type: "Tourist Visa",
    visa_rejections: "no",
    criminal_record: "no",
    settlement_support_source: "remote_income",
  };

  const visa_research = {
    destination: "Sweden",
    citizenship: "Philippines",
    purpose: "settle",
    researchedAt: new Date().toISOString(),
    summary:
      "Family-reunification residence permit via Migrationsverket. Engaged couples typically must marry or document established cohabitation before applying.",
    disclaimer:
      "AI-generated research synthesised from official sources. Verify critical details with cited authorities.",
    visaOptions: [
      {
        name: "Residence permit — family reunification (spouse/partner of Swedish citizen)",
        type: "family",
        recommended: true,
        eligibility: "medium",
        eligibilityReason:
          "Genuine, durable relationship + demonstrable self-sufficiency or sponsor support.",
        processingTime: "12 weeks",
        cost: "Approximately SEK 1,500 (verify before paying)",
        validity:
          "Initially 2 years, renewable; permanent residence after 3 years of continuous residence.",
        benefits: [],
        limitations: [
          "Fiancé status alone typically insufficient — marry or prove established cohabitation before applying",
          "Prepare extensive relationship evidence to counter marriage-of-convenience concerns",
        ],
        officialLink: "https://www.migrationsverket.se/English/",
        sourceUrls: [
          "https://www.migrationsverket.se/English/",
          "https://www.swedenabroad.se/en/about-sweden-non-swedish-citizens/",
        ],
        applicationSteps: [
          "Apply online via Migrationsverket's portal once relationship and cohabitation evidence is ready.",
          "Submit biometrics at the Swedish embassy or visa application centre in your origin country.",
          "Provide proof of relationship: photos, correspondence, joint travel records, witness statements.",
          "Demonstrate self-sufficiency or sponsor support — savings statement counts as evidence.",
        ],
        requirements: [
          "Genuine, durable relationship with the Swedish citizen partner",
          "Self-sufficiency or sponsor support",
          "Police clearance from origin",
        ],
      },
    ],
  };

  const local_requirements_research = {
    destination: "Sweden",
    researchedAt: new Date().toISOString(),
    summary: "Local requirements across Documents, Housing, and Banking.",
    categories: [
      {
        category: "Documents",
        icon: "FileText",
        items: [
          {
            title: "Apostilled birth certificate",
            description:
              "Issued by Philippine Statistics Authority. Required for the Migrationsverket family-reunification application.",
            steps: [
              "Request from the Philippine Statistics Authority.",
              "Get apostille from the Department of Foreign Affairs.",
              "Get certified Swedish or English translation.",
            ],
            documents: ["Birth certificate apostille"],
            estimatedTime: "Complete before departure",
            officialLink: "https://www.migrationsverket.se/English/",
            tips: [
              "Apostille older than 6 months may be rejected — re-issue close to filing.",
            ],
          },
          {
            title: "Police clearance certificate",
            description:
              "Required for primary applicants on family-reunification, work and study permits.",
            steps: [
              "Apply at NBI Manila or local equivalent.",
              "Apostille via DFA.",
              "Translate.",
            ],
            documents: ["Police clearance"],
            estimatedTime: "Complete before departure",
            officialLink: "https://www.migrationsverket.se/English/",
          },
        ],
      },
      {
        category: "Housing",
        icon: "Home",
        items: [
          {
            title: "Secure first-hand contract or sub-let in Stockholm",
            description:
              "Stockholm rental market is tight; first-hand contracts via Bostadsförmedlingen require years on the queue.",
            steps: [
              "Register with Bostadsförmedlingen as soon as possible.",
              "Use Blocket Bostad / Qasa / Samtrygg for sub-let listings.",
              "Plan for 1-3 month deposit + first month upfront.",
            ],
            documents: ["Lease agreement"],
            estimatedTime: "Complete before departure",
            officialLink: "https://bostad.stockholm.se/",
          },
        ],
      },
      {
        category: "Banking",
        icon: "CreditCard",
        items: [
          {
            title: "Open Wise or Revolut account before move",
            description:
              "Bridge account for the first 30-60 days while waiting on a Swedish account.",
            steps: [
              "Sign up online with passport.",
              "Order multi-currency card.",
              "Fund with starter SEK balance.",
            ],
            documents: ["Passport"],
            estimatedTime: "Complete before departure",
            officialLink: "https://wise.com/",
          },
        ],
      },
    ],
  };

  // Find current plan; if missing, create one.
  const { data: existing } = await sb
    .from("relocation_plans")
    .select("id, plan_version")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle<{ id: string; plan_version: number }>();

  if (existing) {
    const { error } = await sb
      .from("relocation_plans")
      .update({
        profile_data: profile,
        visa_research,
        local_requirements_research,
        research_status: "completed",
        research_completed_at: new Date().toISOString(),
        user_triggered_research_at: new Date().toISOString(),
        stage: "ready_for_pre_departure",
        arrival_date: "2028-05-17",
        onboarding_completed: true,
        plan_version: existing.plan_version + 1,
        updated_at: new Date().toISOString(),
        // Clear any prior pre-departure timeline so the test exercises
        // a fresh Regenerate.
        research_meta: null,
      })
      .eq("id", existing.id);
    if (error) throw error;
    console.log(`Updated plan ${existing.id} to A1 fixture state.`);
  } else {
    const { error } = await sb.from("relocation_plans").insert({
      user_id: userId,
      is_current: true,
      profile_data: profile,
      visa_research,
      local_requirements_research,
      research_status: "completed",
      research_completed_at: new Date().toISOString(),
      user_triggered_research_at: new Date().toISOString(),
      stage: "ready_for_pre_departure",
      arrival_date: "2028-05-17",
      onboarding_completed: true,
      plan_version: 1,
    });
    if (error) throw error;
    console.log(`Created plan for ${userId}.`);
  }
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
