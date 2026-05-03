/**
 * ProfileFieldChip — the SHARED primitive for rendering one extracted
 * profile field with its audit icon.
 *
 * ──────────────────────────────────────────────────────────────────────
 *  WHERE THIS COMPONENT IS USED
 * ──────────────────────────────────────────────────────────────────────
 *  - /onboarding side panel (compact variant)            — Wave 2.x
 *  - /dashboard Profile Details Card (full variant)      — Phase 4.1
 *  - Anywhere else a single profile field is displayed
 *
 *  This component is SHARED between /onboarding (compact variant) and
 *  /dashboard Profile Details Card (full variant, Phase 4.1). Do NOT
 *  duplicate field-rendering logic — extend this component instead.
 *  See artifacts/gomate/DESIGN-SYSTEM.md for the rationale.
 *
 * ──────────────────────────────────────────────────────────────────────
 *  CONFIDENCE → AUDIT-DOT COLOR
 * ──────────────────────────────────────────────────────────────────────
 *  Each chip carries an audit dot (small circle, top-right in `full`,
 *  far-right in `compact`). Its fill encodes the extractor's confidence
 *  in the value:
 *    explicit  → primary green (user said it directly)
 *    inferred  → muted slate   (extractor inferred from context)
 *    assumed   → amber warning (extractor guessed; user should verify)
 *    undefined → neutral ring  (no confidence info attached yet)
 *  Hover the dot for the human-readable explanation; click to open the
 *  audit trail (consumer wires onAuditClick).
 */

import { cn } from "@/lib/utils"
import {
  FIELD_CONFIG,
  type AllFieldKey,
} from "@/lib/gomate/profile-schema"

export type ProfileFieldConfidence = "explicit" | "inferred" | "assumed"

export interface ProfileFieldChipProps {
  fieldKey: AllFieldKey
  value: unknown
  confidence?: ProfileFieldConfidence
  onAuditClick?: () => void
  variant?: "compact" | "full"
  className?: string
}

/**
 * Format an arbitrary profile value for human display.
 *  - null / undefined / "" → "—"
 *  - boolean               → "Yes" / "No"
 *  - number                → toString
 *  - string                → as-is
 *  - array                 → comma-joined
 *  - object                → "—" (we don't render structured values
 *                            inline; consumer should use a richer
 *                            component for those)
 */
/** Render snake_case enums + yes/no strings as human-readable labels.
 * Keeps DB shape untouched (this is purely render-time). Long free-text
 * values pass through untouched — caller should pre-summarise if needed. */
function humaniseEnum(raw: string): string {
  const lower = raw.trim().toLowerCase()
  if (lower === "yes") return "Yes"
  if (lower === "no") return "No"
  // snake_case → Title Case (digital_nomad → Digital Nomad)
  if (/^[a-z][a-z0-9_]*$/.test(lower) && lower.length <= 30) {
    return lower
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }
  return raw
}

function formatValue(value: unknown): string {
  if (value == null) return "—"
  if (typeof value === "string") return value.trim() === "" ? "—" : humaniseEnum(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => (typeof v === "string" ? v : String(v)))
      .filter((s) => s.trim() !== "")
    return parts.length === 0 ? "—" : parts.join(", ")
  }
  return "—"
}

const CONFIDENCE_LABEL: Record<ProfileFieldConfidence, string> = {
  explicit: "You told me this directly",
  inferred: "I inferred this from context",
  assumed: "I assumed this — please verify",
}

/**
 * Confidence → tailwind classes for the audit dot. We use the design-
 * system tokens directly so light/dark mode flip correctly:
 *   primary    → --primary       (#22C55E in light, same in dark)
 *   muted-fg   → --muted-foreground
 *   amber-500  → static amber (no token for warning yet — see
 *                DESIGN-SYSTEM.md for the open task)
 */
function confidenceDotClasses(confidence?: ProfileFieldConfidence): string {
  switch (confidence) {
    case "explicit":
      return "bg-primary border-primary"
    case "inferred":
      return "bg-muted-foreground/60 border-muted-foreground/60"
    case "assumed":
      return "bg-amber-500 border-amber-500"
    default:
      return "bg-transparent border-border"
  }
}

interface AuditDotProps {
  confidence?: ProfileFieldConfidence
  fieldKey: AllFieldKey
  fieldLabel: string
  onAuditClick?: () => void
  size?: "sm" | "md"
}

/**
 * The audit dot's testid uses `fieldKey` (snake_case schema key, e.g.
 * `audit-icon-current_location`), NOT the human label. Field labels can
 * change for UX without breaking tests; field keys are the stable
 * contract. The previous (pre-extraction) inline implementation used the
 * same `audit-icon-${field}` shape, so existing tests/scripts that
 * already key off field-name continue to work.
 */
function AuditDot({
  confidence,
  fieldKey,
  fieldLabel,
  onAuditClick,
  size = "sm",
}: AuditDotProps) {
  const tooltip = confidence
    ? `${CONFIDENCE_LABEL[confidence]} — click for audit trail`
    : "Audit trail (coming soon)"
  const dotSize = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2"
  const hitArea = size === "md" ? "p-2" : "p-1.5"
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onAuditClick?.()
      }}
      title={tooltip}
      aria-label={`Audit trail for ${fieldLabel}`}
      data-testid={`audit-icon-${fieldKey}`}
      className={cn(
        "flex-shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-80",
        hitArea,
      )}
    >
      <span
        className={cn(
          "block rounded-full border",
          dotSize,
          confidenceDotClasses(confidence),
        )}
        aria-hidden="true"
      />
    </button>
  )
}

export function ProfileFieldChip({
  fieldKey,
  value,
  confidence,
  onAuditClick,
  variant = "compact",
  className,
}: ProfileFieldChipProps) {
  const cfg = FIELD_CONFIG[fieldKey]
  const label = cfg?.label || fieldKey.replace(/_/g, " ")
  const displayValue = formatValue(value)

  if (variant === "full") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm",
          className,
        )}
        data-testid={`profile-chip-full-${fieldKey}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 break-words text-base font-medium text-foreground">
            {displayValue}
          </p>
        </div>
        <AuditDot
          confidence={confidence}
          fieldKey={fieldKey}
          fieldLabel={label}
          onAuditClick={onAuditClick}
          size="md"
        />
      </div>
    )
  }

  // compact — single line, label left, value right, audit dot at far right
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-accent/40",
        className,
      )}
      data-testid={`profile-chip-compact-${fieldKey}`}
    >
      <p className="flex-shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p className="min-w-0 flex-1 truncate text-right text-sm text-foreground">
        {displayValue}
      </p>
      <AuditDot
        confidence={confidence}
        fieldKey={fieldKey}
        fieldLabel={label}
        onAuditClick={onAuditClick}
      />
    </div>
  )
}
