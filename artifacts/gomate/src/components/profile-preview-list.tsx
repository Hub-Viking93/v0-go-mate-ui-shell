/**
 * ProfilePreviewList — the side-panel container that renders the user's
 * profile-so-far as a list of ProfileFieldChip in compact variant.
 *
 * Used by:
 *   - /onboarding right side panel (Wave 2.x — primary consumer)
 *   - Anywhere else a live profile preview makes sense
 *
 * Data flow:
 *   The parent (OnboardingPage) owns the SSE subscription to /api/chat
 *   and updates `profile`, `filledFields`, `pendingField` on every
 *   message-end event. This component is purely prop-driven — it does
 *   NOT subscribe to SSE itself, which keeps it reusable (a future
 *   /dashboard widget can hand it a profile snapshot from a different
 *   source). Each new field renders with a `gm-animate-in` fade-up so
 *   the user sees their answer "snap into" the panel.
 *
 * Field ordering: we render filled fields in the canonical conversation
 * order (ALL_FIELDS from profile-schema), not in the order they happen
 * to arrive over SSE. This gives a stable, predictable layout no matter
 * which order the user actually answers things.
 */

import { useEffect, useMemo, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Sparkles, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ALL_FIELDS,
  FIELD_CONFIG,
  type AllFieldKey,
  type Profile,
} from "@/lib/gomate/profile-schema"
import {
  ProfileFieldChip,
  type ProfileFieldConfidence,
} from "@/components/profile-field-chip"

export interface ProfilePreviewListProps {
  profile: Profile
  filledFields: AllFieldKey[]
  /**
   * Approximate total field count to display ("3 of ~14 fields"). Pass
   * the count of currently-required fields when you have it (it shifts
   * as conditional fields gate in/out); falls back to 14 (the rough
   * count of always-required core fields) when omitted.
   */
  requiredFieldCount?: number
  pendingField?: AllFieldKey | null
  /**
   * Optional confidence map keyed by AllFieldKey. Today the API doesn't
   * surface confidence per field, so this is reserved for Wave 2.x+ when
   * the extractor emits per-field confidence. When undefined, chips
   * render with a neutral audit dot.
   */
  confidenceMap?: Partial<Record<AllFieldKey, ProfileFieldConfidence>>
  /** Called when a chip's audit dot is clicked. */
  onAuditClick?: (field: AllFieldKey) => void
  className?: string
}

/**
 * Return the subset of `filledFields` whose value in `profile` is not
 * null / "". Sorted by ALL_FIELDS order so the layout is stable.
 */
function selectVisibleFields(
  profile: Profile,
  filledFields: AllFieldKey[],
): AllFieldKey[] {
  const filledSet = new Set(filledFields)
  return ALL_FIELDS.filter((field) => {
    if (!filledSet.has(field)) return false
    const v = profile[field as keyof Profile]
    return v != null && v !== ""
  })
}

export function ProfilePreviewList({
  profile,
  filledFields,
  requiredFieldCount,
  pendingField,
  confidenceMap,
  onAuditClick,
  className,
}: ProfilePreviewListProps) {
  const visibleFields = useMemo(
    () => selectVisibleFields(profile, filledFields),
    [profile, filledFields],
  )
  const total = requiredFieldCount ?? 14
  const filledCount = visibleFields.length

  const isEmpty = filledCount === 0

  /**
   * Track which fields were already visible on the previous render so
   * we can stagger-animate ONLY the newly-arrived ones. Without this,
   * `gm-animate-in` would replay on every parent re-render — every
   * existing chip would re-fade every time a new SSE message arrives,
   * which is jarring. Newly-arrived fields get a 60 ms cumulative
   * stagger so a burst (e.g. extractor fills 3 fields at once) appears
   * as a cascade instead of a single flash.
   */
  const prevFieldsRef = useRef<Set<AllFieldKey>>(new Set())
  const newFieldDelays = useMemo(() => {
    const prev = prevFieldsRef.current
    const map = new Map<AllFieldKey, number>()
    let i = 0
    for (const field of visibleFields) {
      if (!prev.has(field)) {
        map.set(field, i * 60)
        i++
      }
    }
    return map
  }, [visibleFields])
  useEffect(() => {
    prevFieldsRef.current = new Set(visibleFields)
  }, [visibleFields])

  const body = (
    <>
      {isEmpty && (
        <p
          className="px-3 py-4 text-sm italic text-muted-foreground"
          data-testid="profile-preview-empty"
        >
          Your profile will appear here as we get to know you.
        </p>
      )}

      {!isEmpty && (
        <ul className="-mx-3 flex flex-col">
          {visibleFields.map((field) => {
            const delay = newFieldDelays.get(field)
            const isNew = delay !== undefined
            return (
              <li
                key={field}
                className={isNew ? "gm-animate-in" : undefined}
                style={isNew ? { animationDelay: `${delay}ms` } : undefined}
              >
                <ProfileFieldChip
                  fieldKey={field}
                  value={profile[field as keyof Profile]}
                  confidence={confidenceMap?.[field]}
                  onAuditClick={
                    onAuditClick ? () => onAuditClick(field) : undefined
                  }
                  variant="compact"
                />
              </li>
            )
          })}
        </ul>
      )}

      {pendingField && (
        <div
          className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"
          data-testid="profile-preview-next-up"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          <span>
            Next up:{" "}
            {FIELD_CONFIG[pendingField]?.label ||
              pendingField.replace(/_/g, " ")}
          </span>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Desktop — sticky card always visible */}
      <Card
        className={cn(
          "sticky top-4 hidden p-4 lg:block",
          className,
        )}
        data-testid="profile-preview-list-desktop"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-[#5EE89C]" />
            Your profile so far
          </h2>
          <span
            className="text-xs font-medium tabular-nums text-muted-foreground"
            data-testid="profile-preview-count"
          >
            {filledCount} of ~{total} fields
          </span>
        </header>
        {body}
      </Card>

      {/* Mobile — collapsible <details> */}
      <details
        className={cn("rounded-lg border border-border p-3 lg:hidden", className)}
        data-testid="profile-preview-list-mobile"
      >
        <summary className="flex cursor-pointer items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-[#5EE89C]" />
            Your profile so far
          </span>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {filledCount} of ~{total}
          </span>
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    </>
  )
}
