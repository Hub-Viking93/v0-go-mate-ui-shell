import { motion } from "framer-motion"
import { differenceInDays, format, parseISO } from "date-fns"

interface CountdownTimerProps {
  targetDate: string | null
  targetCountry?: string | null
}

/**
 * Editorial countdown — huge serif number, animated progress ring
 * that fills based on how close the move is, urgency-tinted left rail
 * and warm card. Replaces the prior pastel icon-pill design.
 */
export function CountdownTimer({ targetDate, targetCountry }: CountdownTimerProps) {
  if (!targetDate) return null

  const target = parseISO(targetDate)
  if (isNaN(target.getTime())) return null

  const today = new Date()
  const daysUntil = differenceInDays(target, today)

  type Urgency = "past" | "critical" | "urgent" | "moderate" | "comfortable"
  const urgency: Urgency =
    daysUntil < 0
      ? "past"
      : daysUntil <= 14
        ? "critical"
        : daysUntil <= 30
          ? "urgent"
          : daysUntil <= 90
            ? "moderate"
            : "comfortable"

  const config: Record<Urgency, { color: string; tint: string; label: string }> = {
    past: { color: "#6B7280", tint: "#F1EFEC", label: "Move date passed" },
    critical: { color: "#B91C1C", tint: "#FBEDEC", label: "Very soon" },
    urgent: { color: "#D97706", tint: "#FBF3E5", label: "Coming up" },
    moderate: { color: "#16A34A", tint: "#EEF6EF", label: "On track" },
    comfortable: { color: "#234D3A", tint: "#EFF3EC", label: "Plenty of time" },
  }
  const c = config[urgency]

  // Big-number display: pick the most natural unit.
  let bigNumber: string
  let unitLabel: string
  if (daysUntil < 0) {
    const past = Math.abs(daysUntil)
    bigNumber = String(past)
    unitLabel = past === 1 ? "day ago" : "days ago"
  } else if (daysUntil === 0) {
    bigNumber = "Today"
    unitLabel = ""
  } else if (daysUntil < 14) {
    bigNumber = String(daysUntil)
    unitLabel = daysUntil === 1 ? "day" : "days"
  } else if (daysUntil < 60) {
    const weeks = Math.round(daysUntil / 7)
    bigNumber = String(weeks)
    unitLabel = weeks === 1 ? "week" : "weeks"
  } else if (daysUntil < 730) {
    const months = Math.round(daysUntil / 30)
    bigNumber = String(months)
    unitLabel = months === 1 ? "month" : "months"
  } else {
    const years = Math.floor(daysUntil / 365)
    bigNumber = `${years}+`
    unitLabel = years === 1 ? "year" : "years"
  }

  // Progress ring — fills from 365 days down to 0. Past = full red ring.
  const horizonDays = 365
  const progress =
    daysUntil < 0 ? 1 : Math.max(0, Math.min(1, 1 - daysUntil / horizonDays))
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border bg-white/75 backdrop-blur-sm p-5 md:p-6"
      style={{
        borderColor: "rgba(120,90,60,0.18)",
        background: `linear-gradient(90deg, ${c.tint} 0%, rgba(255,252,246,0.92) 70%)`,
        boxShadow:
          "0 1px 2px rgba(120,90,60,0.04), 0 6px 24px rgba(120,90,60,0.06)",
      }}
    >
      {/* Urgency left rail */}
      <div
        className="absolute inset-y-0 left-0 w-[4px]"
        style={{ background: c.color }}
      />

      <div className="relative flex items-center gap-6 pl-3">
        {/* Animated progress ring with urgency dot in centre */}
        <div
          className="relative shrink-0"
          role="img"
          aria-label={`${c.label} — ${bigNumber} ${unitLabel} until move`}
        >
          <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90" aria-hidden="true">
            <circle
              cx="38"
              cy="38"
              r={radius}
              fill="none"
              stroke={c.color}
              strokeOpacity="0.18"
              strokeWidth="3"
            />
            <motion.circle
              cx="38"
              cy="38"
              r={radius}
              fill="none"
              stroke={c.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          {urgency === "critical" && (
            <motion.div
              className="absolute inset-0 m-auto h-3 w-3 rounded-full"
              style={{ background: c.color }}
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        {/* Big serif number + label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className="font-serif tracking-tight text-foreground"
              style={{
                fontSize: "56px",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
              }}
            >
              {bigNumber}
            </span>
            {unitLabel && (
              <span className="font-serif text-[22px] text-foreground/80 leading-none">
                {unitLabel}
              </span>
            )}
            <span
              className="ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{
                color: c.color,
                background: `${c.color}14`,
                border: `1px solid ${c.color}33`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: c.color }}
              />
              {c.label}
            </span>
          </div>
          <p className="mt-2 text-[14px] text-foreground/70">
            {daysUntil >= 0 ? "Until your move" : "Move date passed"}
            {targetCountry && daysUntil >= 0 && (
              <span className="text-foreground/90 font-medium"> to {targetCountry}</span>
            )}
            <span className="mx-2 text-foreground/30">·</span>
            <span
              className="text-foreground/60"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {format(target, "MMMM d, yyyy")}
            </span>
          </p>
        </div>
      </div>
    </motion.div>
  )
}
