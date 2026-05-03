/**
 * /dev/profile-field-chip — visual QA for ProfileFieldChip + ProfilePreviewList.
 *
 * Renders the same fields in BOTH variants side by side so you can
 * verify they share label, audit-dot placement, color tokens, hover
 * state, and font sizing.
 */

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { ProfileFieldChip } from "@/components/profile-field-chip"
import { ProfilePreviewList } from "@/components/profile-preview-list"
import {
  EMPTY_PROFILE,
  type AllFieldKey,
  type Profile,
} from "@/lib/gomate/profile-schema"

const SAMPLE_PROFILE: Profile = {
  ...EMPTY_PROFILE,
  name: "Axel Berg",
  citizenship: "Sweden",
  birth_year: "1992",
  current_location: "Stockholm",
  destination: "Portugal",
  target_city: "Lisbon",
  purpose: "digital_nomad",
  duration: "12 months",
  remote_income: "yes",
  monthly_income: "4800",
  preferred_currency: "EUR",
  moving_alone: "yes",
}

const SAMPLE_FIELDS: AllFieldKey[] = [
  "name",
  "citizenship",
  "birth_year",
  "current_location",
  "destination",
  "target_city",
  "purpose",
  "duration",
  "remote_income",
  "monthly_income",
  "preferred_currency",
  "moving_alone",
]

const VARIANT_PREVIEW_FIELDS: AllFieldKey[] = [
  "name",
  "destination",
  "monthly_income",
]

export default function ProfileFieldChipPreviewPage() {
  const [auditClicks, setAuditClicks] = useState<string[]>([])

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          ProfileFieldChip · ProfilePreviewList
        </h1>
        <p className="text-sm text-muted-foreground">
          Visual QA for the shared profile-field rendering primitives.
          Compact variant (left column) feeds the /onboarding side panel;
          full variant (right column) feeds the future /dashboard
          Profile Details Card (Phase 4.1).
        </p>
      </header>

      {/* Section 1 — same fields in both variants for direct comparison */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Side-by-side: compact vs full
        </h2>
        <p className="text-sm text-muted-foreground">
          Same fields, same audit-dot placement, same color tokens.
          Confidence levels rotate so you can see all four states.
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              compact variant
            </h3>
            <div className="-mx-4">
              {VARIANT_PREVIEW_FIELDS.map((field, idx) => (
                <ProfileFieldChip
                  key={field}
                  fieldKey={field}
                  value={SAMPLE_PROFILE[field as keyof Profile]}
                  confidence={
                    (
                      ["explicit", "inferred", "assumed"] as const
                    )[idx % 3]
                  }
                  variant="compact"
                  onAuditClick={() =>
                    setAuditClicks((prev) => [
                      ...prev,
                      `compact:${field}@${new Date().toISOString()}`,
                    ])
                  }
                />
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              full variant
            </h3>
            <div className="space-y-3">
              {VARIANT_PREVIEW_FIELDS.map((field, idx) => (
                <ProfileFieldChip
                  key={field}
                  fieldKey={field}
                  value={SAMPLE_PROFILE[field as keyof Profile]}
                  confidence={
                    (
                      ["explicit", "inferred", "assumed"] as const
                    )[idx % 3]
                  }
                  variant="full"
                  onAuditClick={() =>
                    setAuditClicks((prev) => [
                      ...prev,
                      `full:${field}@${new Date().toISOString()}`,
                    ])
                  }
                />
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Section 2 — confidence states matrix (compact only) */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Audit-dot confidence states
        </h2>
        <p className="text-sm text-muted-foreground">
          Hover the dot for the human-readable confidence label.
        </p>
        <Card className="p-4">
          <div className="-mx-4">
            <ProfileFieldChip
              fieldKey="name"
              value="Axel"
              confidence="explicit"
              variant="compact"
            />
            <ProfileFieldChip
              fieldKey="destination"
              value="Portugal"
              confidence="inferred"
              variant="compact"
            />
            <ProfileFieldChip
              fieldKey="monthly_income"
              value="4800"
              confidence="assumed"
              variant="compact"
            />
            <ProfileFieldChip
              fieldKey="moving_alone"
              value="yes"
              variant="compact"
            />
          </div>
        </Card>
      </section>

      {/* Section 3 — full ProfilePreviewList container */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          ProfilePreviewList container
        </h2>
        <p className="text-sm text-muted-foreground">
          Real container as it appears in the /onboarding side panel.
          Renders filled fields in canonical ALL_FIELDS order with a
          60ms stagger fade-in and the &ldquo;Next up&rdquo; hint.
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              empty state
            </h3>
            <ProfilePreviewList
              profile={EMPTY_PROFILE}
              filledFields={[]}
              requiredFieldCount={14}
              pendingField="name"
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              populated state
            </h3>
            <ProfilePreviewList
              profile={SAMPLE_PROFILE}
              filledFields={SAMPLE_FIELDS}
              requiredFieldCount={14}
              pendingField="job_offer"
              confidenceMap={{
                name: "explicit",
                destination: "explicit",
                target_city: "inferred",
                monthly_income: "assumed",
              }}
            />
          </div>
        </div>
      </section>

      {/* Section 4 — audit-click log (so you can verify clicks fire) */}
      {auditClicks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Audit-click log
          </h2>
          <Card className="p-3">
            <ul className="space-y-1 text-xs font-mono text-muted-foreground">
              {auditClicks.slice(-10).map((entry, i) => (
                <li key={i}>{entry}</li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}
