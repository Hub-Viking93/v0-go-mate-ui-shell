import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentLiveStatus =
  | "idle"
  | "researching"
  | "drafting"
  | "validating"
  | "complete"
  | "failed";

export interface AgentLiveState {
  name: string;
  status: AgentLiveStatus;
  currentActivity: string;
  quality?: "full" | "partial" | "fallback";
  sourceUrls?: { url: string; label: string; scraped: boolean }[];
  sourcesScraped?: number;
  sourcesTotal?: number;
  summary?: string;
  draftParagraphs?: string[];
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  redispatched?: boolean;
}

const AGENT_META: Record<string, { title: string; emoji: string }> = {
  visa_specialist: { title: "Visa Specialist", emoji: "🛂" },
  tax_strategist: { title: "Tax Strategist", emoji: "📊" },
  cost_specialist: { title: "Cost Specialist", emoji: "💰" },
  housing_specialist: { title: "Housing Specialist", emoji: "🏠" },
  cultural_adapter: { title: "Cultural Adapter", emoji: "🌍" },
  documents_specialist: { title: "Documents Specialist", emoji: "📜" },
  healthcare_navigator: { title: "Healthcare Navigator", emoji: "⚕️" },
  banking_helper: { title: "Banking Helper", emoji: "🏦" },
  schools_specialist: { title: "Schools Specialist", emoji: "🎓" },
  pet_specialist: { title: "Pet Specialist", emoji: "🐾" },
  posted_worker_specialist: { title: "Posted Worker Specialist", emoji: "🤝" },
  digital_nomad_compliance: { title: "Digital-Nomad Compliance", emoji: "💻" },
  job_compliance_specialist: { title: "Job-Compliance Specialist", emoji: "💼" },
  family_reunion_specialist: { title: "Family-Reunion Specialist", emoji: "👨‍👩‍👧" },
  departure_tax_specialist: { title: "Departure-Tax Specialist", emoji: "🛫" },
  vehicle_import_specialist: { title: "Vehicle-Import Specialist", emoji: "🚗" },
  property_purchase_specialist: { title: "Property-Purchase Specialist", emoji: "🏡" },
  trailing_spouse_career_specialist: { title: "Trailing-Spouse Career Specialist", emoji: "👥" },
  pension_continuity_specialist: { title: "Pension-Continuity Specialist", emoji: "👴" },
};

function meta(name: string): { title: string; emoji: string } {
  return AGENT_META[name] ?? { title: name.replace(/_/g, " "), emoji: "🤖" };
}

function statusPill(status: AgentLiveStatus): { label: string; className: string; icon: React.ReactNode } {
  switch (status) {
    case "idle":
      return {
        label: "Queued",
        className: "bg-muted text-muted-foreground",
        icon: <Clock className="h-3 w-3" />,
      };
    case "researching":
      return {
        label: "Researching",
        className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      };
    case "drafting":
      return {
        label: "Drafting",
        className: "bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950 dark:text-purple-300",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      };
    case "validating":
      return {
        label: "Validating",
        className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      };
    case "complete":
      return {
        label: "Complete",
        className: "bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-950 dark:text-green-300",
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300",
        icon: <XCircle className="h-3 w-3" />,
      };
  }
}

interface AgentPanelProps {
  agent: AgentLiveState;
  rationale?: string;
}

export function AgentPanel({ agent, rationale }: AgentPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const m = meta(agent.name);
  const pill = statusPill(agent.status);
  const isActive = agent.status === "researching" || agent.status === "drafting" || agent.status === "validating";
  const expandable = agent.status === "complete" || agent.status === "failed";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300",
        isActive && "ring-2 ring-blue-200/60 dark:ring-blue-800/60",
        agent.status === "failed" && "ring-1 ring-red-200/80 dark:ring-red-800/60",
        agent.status === "complete" && "opacity-95",
      )}
      data-testid={`agent-panel-${agent.name}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "text-2xl leading-none shrink-0",
                isActive && "animate-pulse",
              )}
              aria-hidden
            >
              {m.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm leading-tight truncate">{m.title}</h3>
                {agent.redispatched && (
                  <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Re-dispatched
                  </span>
                )}
              </div>
              {rationale && (
                <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{rationale}</p>
              )}
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap",
              pill.className,
            )}
          >
            {pill.icon}
            {pill.label}
          </span>
        </div>

        {/* Current activity */}
        <p className="text-xs text-foreground/80 mt-3 leading-relaxed" data-testid={`agent-activity-${agent.name}`}>
          {agent.currentActivity}
        </p>

        {/* Source counts when complete */}
        {(agent.status === "complete" || agent.status === "failed") &&
          (agent.sourcesScraped !== undefined || agent.sourcesTotal !== undefined) && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              {agent.sourcesScraped ?? 0} of {agent.sourcesTotal ?? 0} sources used
              {agent.quality && agent.quality !== "full" && (
                <span className="ml-2 italic">({agent.quality})</span>
              )}
            </div>
          )}

        {/* Brief summary line (drawn from the unified-guide first paragraph) */}
        {agent.summary && agent.status === "complete" && (
          <p className="text-xs text-foreground/70 mt-2 leading-relaxed line-clamp-2">{agent.summary}</p>
        )}

        {/* Expandable detail */}
        {expandable && (agent.draftParagraphs?.length || agent.sourceUrls?.length) && (
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid={`agent-expand-${agent.name}`}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}
        {expanded && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {agent.draftParagraphs && agent.draftParagraphs.length > 0 && (
              <div className="space-y-2">
                {agent.draftParagraphs.map((p, i) => (
                  <p key={i} className="text-xs text-foreground/85 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            )}
            {agent.sourceUrls && agent.sourceUrls.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Sources
                </h4>
                <ul className="space-y-1">
                  {agent.sourceUrls.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full mt-1.5 shrink-0",
                          s.scraped ? "bg-green-500" : "bg-gray-400",
                        )}
                        aria-label={s.scraped ? "scraped" : "whitelist only"}
                      />
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate min-w-0 flex-1 inline-flex items-center gap-1"
                      >
                        {s.label || s.url}
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {agent.errorMessage && (
              <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded p-2">
                {agent.errorMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
