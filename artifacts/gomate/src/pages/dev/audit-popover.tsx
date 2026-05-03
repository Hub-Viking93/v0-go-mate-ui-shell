import { AuditIcon } from "@/components/audit-icon"
import {
  AuditTrailPopoverContent,
  type ProfileFieldAudit,
  type ResearchOutputAudit,
  type DerivedValueAudit,
  type AuditPayload,
} from "@/components/audit-trail-popover"

/* ---------- 3 profile-field audits ---------- */
const profileSamples: ProfileFieldAudit[] = [
  {
    kind: "profile_field",
    fieldKey: "annual_income",
    fieldLabel: "Annual income (€)",
    agentName: "Profile Extractor v2",
    modelUsed: "claude-sonnet-4-6",
    confidence: "high",
    sourceUserMessage:
      "I make about €62,400 a year as a senior backend engineer at a remote-first SaaS company in Berlin.",
    validationRulesApplied: [
      "Currency normalised to EUR",
      "Annualised from monthly value",
      "Within plausible band for stated role",
    ],
    retrievedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    kind: "profile_field",
    fieldKey: "destination",
    fieldLabel: "Destination country",
    agentName: "Profile Extractor v2",
    modelUsed: "claude-sonnet-4-6",
    confidence: "medium",
    sourceUserMessage:
      "We're thinking Portugal — probably Lisbon, but maybe Porto if rent gets crazy.",
    validationRulesApplied: [
      "Resolved to ISO country code",
      "Marked as soft pick (city undecided)",
    ],
    retrievedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
  {
    kind: "profile_field",
    fieldKey: "has_dependents",
    fieldLabel: "Has dependents",
    agentName: "Profile Extractor v2",
    modelUsed: "claude-haiku-4-5",
    confidence: "low",
    sourceUserMessage:
      "It's just me for now but my partner might join in 2027.",
    validationRulesApplied: ["Inferred from negative present-tense statement"],
    retrievedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
  },
]

/* ---------- 3 research-output audits ---------- */
const researchSamples: ResearchOutputAudit[] = [
  {
    kind: "research_output",
    outputKey: "visa_compliance.0",
    outputLabel: "Portugal D8 income threshold",
    specialistName: "Digital Nomad Compliance Specialist",
    sourceUrl: "https://example.gov/aima/d8-visa-requirements",
    sourceName: "AIMA — D8 Visa Requirements",
    retrievedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    quality: "full",
    confidence: "high",
    verifyOnOfficialSiteUrl: "https://example.gov/aima/d8-visa-requirements",
  },
  {
    kind: "research_output",
    outputKey: "schools.1",
    outputLabel: "Berlin International School fee range",
    specialistName: "Schools & Childcare Specialist",
    sourceUrl: "https://example.com/bis/admissions",
    sourceName: "Berlin International School — Admissions",
    retrievedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
    quality: "partial",
    confidence: "medium",
    verifyOnOfficialSiteUrl: "https://example.com/bis/admissions",
  },
  {
    kind: "research_output",
    outputKey: "posted_worker.0",
    outputLabel: "PWD filing deadline (DE)",
    specialistName: "Posted Worker Specialist",
    sourceUrl: "https://example.gov/zoll/meldeportal-mindestlohn",
    sourceName: "ZOLL — Mindestlohn-Meldeportal",
    retrievedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    quality: "full",
    confidence: "high",
    verifyOnOfficialSiteUrl: "https://example.gov/zoll/meldeportal-mindestlohn",
  },
]

/* ---------- 1 derived-value audit ---------- */
const derivedSample: DerivedValueAudit = {
  kind: "derived_value",
  outputKey: "budget.monthly_savings_target",
  outputLabel: "Monthly savings target",
  formula: "(total_savings_target − current_savings) ÷ months_until_move",
  inputs: [
    { label: "total_savings_target", value: "€18,000", auditTo: "#" },
    { label: "current_savings", value: "€4,200", auditTo: "#" },
    { label: "months_until_move", value: "9", auditTo: "#" },
  ],
  lastComputedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
}

interface PopoverWalkthroughEntry {
  fieldLabel: string
  inDashboardValue: string
  whereYouSeeIt: string
  payload: AuditPayload
}

const walkthroughs: { sectionTitle: string; subtitle: string; items: PopoverWalkthroughEntry[] }[] = [
  {
    sectionTitle: "Dashboard fields (3)",
    subtitle:
      "Click the small Info icon next to a profile field on the dashboard. Popover title: “How we got this.”",
    items: [
      {
        fieldLabel: "Annual income",
        inDashboardValue: "€62,400 / year",
        whereYouSeeIt: "Profile Details · Financial",
        payload: profileSamples[0]!,
      },
      {
        fieldLabel: "Destination country",
        inDashboardValue: "Portugal (Lisbon)",
        whereYouSeeIt: "Profile Details · Journey",
        payload: profileSamples[1]!,
      },
      {
        fieldLabel: "Has dependents",
        inDashboardValue: "No",
        whereYouSeeIt: "Profile Details · Family",
        payload: profileSamples[2]!,
      },
    ],
  },
  {
    sectionTitle: "Research outputs (3)",
    subtitle:
      "Click the small Info icon next to a researched value on a specialist card. Popover title: “Source for this claim.”",
    items: [
      {
        fieldLabel: "D8 income threshold",
        inDashboardValue: "€3,480 / month",
        whereYouSeeIt: "Income Compliance card",
        payload: researchSamples[0]!,
      },
      {
        fieldLabel: "BIS fee range",
        inDashboardValue: "€14,000 – €26,000 / yr",
        whereYouSeeIt: "Schools card · Lia (age 9)",
        payload: researchSamples[1]!,
      },
      {
        fieldLabel: "PWD filing deadline",
        inDashboardValue: "Before first day of work",
        whereYouSeeIt: "Posted Worker card · PWD sub-card",
        payload: researchSamples[2]!,
      },
    ],
  },
  {
    sectionTitle: "Derived value (bonus)",
    subtitle: "Click the Info icon next to a computed number. Popover title: “How this was calculated.”",
    items: [
      {
        fieldLabel: "Monthly savings target",
        inDashboardValue: "€1,533 / month",
        whereYouSeeIt: "Budget Plan card · Header",
        payload: derivedSample,
      },
    ],
  },
]

export default function AuditPopoverPreviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10 space-y-10">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Audit Popover Walkthrough
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Dev preview. Each row shows the dashboard value, the live audit icon (click to open),
            and the popover contents that would appear. Three profile fields, three research
            outputs, and one derived value.
          </p>
        </div>

        {walkthroughs.map((section) => (
          <section
            key={section.sectionTitle}
            className="space-y-4"
          >
            <header>
              <h2 className="text-lg font-semibold">{section.sectionTitle}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item, i) => (
                <article
                  key={i}
                  className="rounded-xl border border-border/60 bg-card overflow-hidden"
                >
                  {/* "In-dashboard" affordance — looks like the row the user actually sees */}
                  <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {item.whereYouSeeIt}
                    </p>
                    <div className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{item.fieldLabel}</span>
                      <span className="font-medium inline-flex items-center gap-1.5">
                        {item.inDashboardValue}
                        <AuditIcon
                          payload={item.payload}
                          label={`Audit trail for ${item.fieldLabel}`}
                        />
                      </span>
                    </div>
                  </div>

                  {/* Static rendering of what the popover would show */}
                  <div className="p-4 bg-card">
                    <p className="text-[11px] text-muted-foreground mb-2 font-medium">
                      ↓ Popover contents
                    </p>
                    <div className="rounded-lg border border-border/40 bg-background p-3 shadow-sm">
                      <AuditTrailPopoverContent payload={item.payload} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
