

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Coins,
  Home,
  CheckCircle2,
  Users,
  Sparkles,
  Check,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AuditIcon } from "@/components/audit-icon"

export interface VisaRoute {
  name?: string
  official_visa_name?: string
  difficulty?: string
  description?: string
  why_recommended?: string
  who_its_for?: string
  processing_time?: string
  estimated_cost?: string
  family_total_cost?: string
  validity_period?: string
  path_to_residence?: string
  requirements?: string[]
  how_to_apply?: string[]
  spouse_visa_type?: string
  spouse_can_work?: boolean
  children_visa_type?: string
  official_url?: string
  officialLink?: string
}

export interface VisaData {
  summary?: string
  embassyLocation?: string
  routes?: VisaRoute[]
}

interface VisaRoutesCardProps {
  visaData: VisaData
  onSelectRoute?: (index: number) => void
  selectedRouteIndex?: number
  onCompare?: () => void
}

const DIFFICULTY_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  Easy: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Easy",
  },
  Moderate: {
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    label: "Moderate",
  },
  Challenging: {
    dot: "bg-rose-500",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-300",
    label: "Challenging",
  },
}

function DifficultyChip({ difficulty }: { difficulty?: string }) {
  const c = DIFFICULTY_CONFIG[difficulty || "Moderate"] || DIFFICULTY_CONFIG.Moderate
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
        c.bg,
        c.text,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  )
}

function RouteCard({
  route,
  index,
  onSelect,
  isSelected,
}: {
  route: VisaRoute
  index: number
  onSelect?: (index: number) => void
  isSelected: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const officialUrl = route.official_url || route.officialLink

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        isSelected
          ? "border-emerald-500/60 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-card dark:to-emerald-950/20 shadow-[0_8px_30px_-12px_rgba(16,185,129,0.35)]"
          : "border-stone-200/80 dark:border-stone-800 bg-card hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md",
      )}
    >
      {/* Top accent stripe */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[3px]",
          isSelected
            ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500"
            : "bg-gradient-to-r from-stone-200 via-amber-200/60 to-stone-200 dark:from-stone-800 dark:via-amber-900/40 dark:to-stone-800",
        )}
      />

      {/* Selected check badge */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40"
        >
          <Check className="w-4 h-4 text-white" strokeWidth={3} />
        </motion.div>
      )}

      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">
                Option {index + 1}
              </span>
              <span className="text-stone-300 dark:text-stone-700">•</span>
              <DifficultyChip difficulty={route.difficulty} />
            </div>
            <h4 className="font-sans text-xl md:text-[22px] leading-tight text-foreground tracking-tight">
              {route.name || route.official_visa_name}
            </h4>
            {(route.why_recommended || route.description || route.who_its_for) && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                {route.why_recommended || route.description || route.who_its_for}
              </p>
            )}
          </div>
        </div>

        {/* Meta strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-600 dark:text-stone-300 mt-3">
          {route.processing_time && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600/70 dark:text-amber-500/70" />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{route.processing_time}</span>
              <AuditIcon size="xs" outputKey={`visa_processing_time.${index}`} label="Audit trail for processing time" />
            </span>
          )}
          {(route.family_total_cost || route.estimated_cost) && (
            <span className="inline-flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-500/70" />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{route.family_total_cost || route.estimated_cost}</span>
              <AuditIcon size="xs" outputKey={`visa_cost.${index}`} label="Audit trail for visa cost" />
            </span>
          )}
          {route.validity_period && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-stone-400" />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{route.validity_period}</span>
            </span>
          )}
          {route.path_to_residence && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
              <Home className="w-3.5 h-3.5" />
              PR possible
            </span>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="group inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-foreground mt-4 transition-colors"
        >
          <span className="border-b border-stone-300 dark:border-stone-600 group-hover:border-foreground transition-colors">
            {expanded ? "Less details" : "More details"}
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 transition-transform" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
          )}
        </button>

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-dashed border-stone-200 dark:border-stone-800 space-y-4">
                {route.requirements && route.requirements.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-500 dark:text-stone-400 mb-2">
                      Requirements
                    </p>
                    <ul className="space-y-1.5">
                      {route.requirements.slice(0, 5).map((req, i) => (
                        <li key={i} className="text-xs text-stone-700 dark:text-stone-300 flex items-start gap-2 leading-relaxed">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-500/70 mt-0.5 flex-shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(route.spouse_visa_type || route.children_visa_type) && (
                  <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-amber-700 dark:text-amber-400 mb-2 inline-flex items-center gap-1.5">
                      <Users className="w-3 h-3" /> Family Visas
                    </p>
                    <div className="space-y-1 text-xs text-stone-700 dark:text-stone-300">
                      {route.spouse_visa_type && (
                        <p>
                          <span className="font-medium">Partner:</span> {route.spouse_visa_type}{" "}
                          {route.spouse_can_work && (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">(can work)</span>
                          )}
                        </p>
                      )}
                      {route.children_visa_type && (
                        <p>
                          <span className="font-medium">Children:</span> {route.children_visa_type}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {route.how_to_apply && route.how_to_apply.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-500 dark:text-stone-400 mb-2">
                      How to apply
                    </p>
                    <ol className="space-y-1.5 list-none counter-reset-step">
                      {route.how_to_apply.slice(0, 4).map((step, i) => (
                        <li key={i} className="text-xs text-stone-700 dark:text-stone-300 flex gap-2.5 leading-relaxed">
                          <span
                            className="flex-shrink-0 w-5 h-5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] font-semibold inline-flex items-center justify-center"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {officialUrl && (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Official visa page
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        {onSelect && (
          <motion.button
            onClick={() => onSelect(index)}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full mt-5 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200",
              isSelected
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_4px_14px_-2px_rgba(16,185,129,0.45)]"
                : "bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 hover:bg-white dark:hover:bg-stone-900/60",
            )}
          >
            {isSelected ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" strokeWidth={3} />
                Selected
              </span>
            ) : (
              "Choose this route"
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

export function VisaRoutesCard({
  visaData,
  onSelectRoute,
  selectedRouteIndex,
  onCompare,
}: VisaRoutesCardProps) {
  if (!visaData?.routes?.length) return null

  return (
    <div className="space-y-4">
      {visaData.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{visaData.summary}</p>
      )}

      {visaData.embassyLocation && (
        <div className="flex items-start gap-2.5 text-xs text-stone-700 dark:text-stone-300 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/30 rounded-xl px-3.5 py-2.5">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
          <span className="leading-relaxed">
            {visaData.embassyLocation.replace(/📍\s*\*\*Where to apply\*\*:\s*/, "")}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {visaData.routes.map((route, index) => (
          <RouteCard
            key={index}
            route={route}
            index={index}
            onSelect={onSelectRoute}
            isSelected={selectedRouteIndex === index}
          />
        ))}
      </div>

      {visaData.routes.length > 1 && onCompare && (
        <button
          onClick={onCompare}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-stone-700 dark:text-stone-300 border border-dashed border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors"
        >
          Compare all options side-by-side
        </button>
      )}

      <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3.5 mt-4">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="leading-relaxed">
          <p className="font-semibold mb-0.5">Important</p>
          <p>
            Visa requirements, fees, and processing times change frequently. Always verify ALL
            information on official government websites before making decisions or applications.
          </p>
        </div>
      </div>
    </div>
  )
}
