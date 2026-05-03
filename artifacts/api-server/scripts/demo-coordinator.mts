/**
 * Demo: print Coordinator dispatch decisions for the 3 buildathon
 * sample profiles. Run with:
 *   pnpm --filter @workspace/api-server exec tsx scripts/demo-coordinator.mts
 */
import { decideDispatch } from "../src/lib/agents/coordinator";
import type { Profile } from "../src/lib/gomate/profile-schema-snapshot";

const profiles: { label: string; profile: Profile }[] = [
  {
    label:
      "1) Filipino fiancée → Sweden as dependent, settling permanently, no kids/pets",
    profile: {
      name: "Maria",
      citizenship: "Philippines",
      current_location: "Manila, Philippines",
      destination: "Sweden",
      target_city: "Stockholm",
      purpose: "settle",
      visa_role: "dependent",
      partner_citizenship: "Sweden",
      partner_visa_status: "citizen",
      relationship_type: "fiance",
      settlement_reason: "family_reunion",
      duration: "permanent",
      timeline: "3-6_months",
      moving_alone: "yes",
      children_count: "0",
      pets: "none",
      healthcare_needs: "none",
      savings_available: "8000",
      monthly_budget: "1500",
    },
  },
  {
    label:
      "2) German engineer posted to Stockholm for 18 months, family of 4 with 2 kids",
    profile: {
      name: "Hans",
      citizenship: "Germany",
      current_location: "Berlin, Germany",
      destination: "Sweden",
      target_city: "Stockholm",
      purpose: "work",
      visa_role: "primary",
      job_offer: "yes",
      employer_sponsorship: "yes",
      highly_skilled: "yes",
      posting_or_secondment: "yes",
      home_country_employer: "Siemens AG",
      posting_duration_months: "18",
      duration: "18_months",
      timeline: "1-3_months",
      moving_alone: "no",
      spouse_joining: "yes",
      spouse_career_field: "marketing",
      spouse_seeking_work: "no",
      children_count: "2",
      children_ages: "7, 11",
      healthcare_needs: "none",
      pets: "none",
      savings_available: "60000",
      monthly_budget: "5000",
    },
  },
  {
    label:
      "3) American digital nomad → Spain solo, chronic condition, bringing a dog",
    profile: {
      name: "Jordan",
      citizenship: "United States",
      current_location: "Austin, United States",
      destination: "Spain",
      target_city: "Valencia",
      purpose: "digital_nomad",
      visa_role: "primary",
      remote_income: "yes",
      income_source: "self_employed",
      monthly_income: "6500",
      income_consistency: "stable",
      income_history_months: "24",
      duration: "1_year",
      timeline: "1-3_months",
      moving_alone: "yes",
      children_count: "0",
      pets: "dog",
      pet_breed: "labrador",
      healthcare_needs: "chronic_condition",
      chronic_condition_description: "Type 1 diabetes",
      prescription_medications: "yes",
      english_speaking_doctor_required: "yes",
      savings_available: "30000",
      monthly_budget: "2500",
    },
  },
];

for (const { label, profile } of profiles) {
  const d = decideDispatch(profile);
  console.log("\n" + "=".repeat(80));
  console.log(label);
  console.log("=".repeat(80));
  console.log(`\nDispatched specialists (${d.specialists.length}):`);
  for (const s of d.specialists) {
    console.log(`  • ${s.name}  [${Object.keys(s.inputs).length} input fields]`);
  }
  console.log(`\nRationale (${d.rationale.length}):`);
  for (const r of d.rationale) {
    console.log(`  • ${r.specialist}`);
    console.log(`      ${r.reason}`);
  }
}
console.log();
