// =============================================================
// ReadinessSection — Phase 3A "are you ready?" surface
// =============================================================
// Renders the four readiness domains (visa / money / document / move)
// with explainable level pills, reasons, blockers, and a per-domain
// next step. Plus a single highest-priority CTA at the top.
//
// Phase 3A explicit non-goals:
//   • No "78% ready" composite score
//   • No risk classification beyond low / medium / high
//   • No alternative-pathway suggestions (Phase 3C)
// =============================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FolderLock,
  Loader2,
  ShieldCheck,
  ListChecks,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReadinessLevel = "low" | "medium" | "high";
type ReadinessDomain = "visa" | "money" | "document" | "move";

interface ReadinessSignal {
  level: ReadinessLevel;
  reasons: string[];
  blockers: string[];
  nextStep: string | null;
}

interface ReadinessReport {
  planId: string;
  generatedAt: string;
  domains: Record<ReadinessDomain, ReadinessSignal>;
  topPriority: { domain: ReadinessDomain; nextStep: string } | null;
}

const DOMAIN_META: Record<
  ReadinessDomain,
  { label: string; icon: LucideIcon; href: string; hint: string }
> = {
  visa: {
    label: "Visa",
    icon: ShieldCheck,
    href: "/visa",
    hint: "Pathway, application status, and core visa documents.",
  },
  money: {
    label: "Money",
    icon: Wallet,
    href: "/dashboard",
    hint: "Buffer for the onboarding gap before payroll lands.",
  },
  document: {
    label: "Documents",
    icon: FolderLock,
    href: "/vault",
    hint: "Coverage of categories required by your active tasks.",
  },
  move: {
    label: "Move",
    icon: ListChecks,
    href: "/checklist",
    hint: "Pre-move + settling-in tasks at this lifecycle stage.",
  },
};

// Light-sage admin styling: severity is signalled by a thin left-edge
// stripe + a small inline word, not a red AI-warning pill. Cards read
// as alert rows, not content cards.
const LEVEL_META: Record<
  ReadinessLevel,
  { label: string; stripe: string; statusText: string }
> = {
  low: {
    label: "Needs attention",
    stripe: "#B5414C",
    statusText: "text-[#B5414C]",
  },
  medium: {
    label: "In progress",
    stripe: "#C99746",
    statusText: "text-[#8C6B2F]",
  },
  high: {
    label: "Ready",
    stripe: "#7BB091",
    statusText: "text-[#3F6B53]",
  },
};

const DOMAIN_ORDER: ReadinessDomain[] = ["visa", "document", "money", "move"];

export function ReadinessSection() {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/readiness");
        if (!res.ok) {
          if (res.status === 404) {
            // No active plan yet — render a placeholder.
            setReport(null);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as ReadinessReport;
        if (!cancelled) setReport(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const orderedDomains = useMemo(() => {
    if (!report) return [] as Array<[ReadinessDomain, ReadinessSignal]>;
    // Surface the lowest-level domains first so the user lands on what
    // most needs attention.
    const rank: Record<ReadinessLevel, number> = { low: 0, medium: 1, high: 2 };
    const arr = DOMAIN_ORDER.map((d): [ReadinessDomain, ReadinessSignal] => [d, report.domains[d]]);
    arr.sort((a, b) => rank[a[1].level] - rank[b[1].level]);
    return arr;
  }, [report]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#7E9088] text-[12.5px] gm-surface px-5 py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your readiness…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="gm-surface p-5">
        <span className="gm-eyebrow mb-2">Readiness</span>
        <p className="text-[12.5px] text-[#7E9088] mt-2 leading-relaxed">
          {error
            ? `Couldn't load readiness: ${error}`
            : "Complete onboarding to see your readiness across visa, money, documents and move."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3" data-testid="readiness-section">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="gm-eyebrow">Readiness</span>
          <h2 className="text-[15px] font-semibold text-[#1F2A24] mt-1.5" data-testid="readiness-heading">
            How ready are you?
          </h2>
        </div>
      </div>

      {/* Top priority — single most-important next step */}
      {report.topPriority && (
        <TopPriorityCard
          domain={report.topPriority.domain}
          nextStep={report.topPriority.nextStep}
        />
      )}

      {/* Per-domain items */}
      <div className="grid grid-cols-1 gap-2.5" data-testid="readiness-domains">
        {orderedDomains.map(([domain, signal]) => (
          <DomainCard key={domain} domain={domain} signal={signal} />
        ))}
      </div>

      <p className="text-[11.5px] text-[#7E9088] italic" data-testid="readiness-disclaimer">
        Readiness is a guidance signal — not a prediction of approval. Authorities make
        the final decision.
      </p>
    </section>
  );
}

function TopPriorityCard({
  domain,
  nextStep,
}: {
  domain: ReadinessDomain;
  nextStep: string;
}) {
  const meta = DOMAIN_META[domain];
  const Icon = meta.icon;
  return (
    <Link
      href={meta.href}
      className="gm-surface gm-lift group flex items-center gap-3 px-3.5 py-3"
      data-testid="readiness-top-priority"
      data-priority-domain={domain}
    >
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0"
        style={{ background: "#E4F2EA", color: "#2C6440" }}
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={1.7} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="gm-eyebrow !text-[10px]">Next · {meta.label}</span>
        <p className="text-[13.5px] font-semibold text-[#1F2A24] leading-snug mt-1">{nextStep}</p>
      </div>
      <ArrowRight className="gm-lift-arrow w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
    </Link>
  );
}

function DomainCard({
  domain,
  signal,
}: {
  domain: ReadinessDomain;
  signal: ReadinessSignal;
}) {
  const meta = DOMAIN_META[domain];
  const levelMeta = LEVEL_META[signal.level];
  const Icon = meta.icon;
  return (
    <Link
      href={meta.href}
      className="gm-surface gm-lift group block relative"
      style={{ borderLeft: `3px solid ${levelMeta.stripe}` }}
      data-testid={`readiness-domain-${domain}`}
      data-readiness-level={signal.level}
    >
      <article className="px-3.5 py-3">
        <header className="flex items-center gap-2 mb-1.5">
          <Icon className="w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[13.5px] font-semibold text-[#1F2A24]">{meta.label}</h3>
              <span
                className={cn("text-[11.5px] font-medium", levelMeta.statusText)}
                data-testid={`readiness-level-${domain}`}
              >
                {levelMeta.label}
              </span>
            </div>
          </div>
          <ArrowRight className="gm-lift-arrow w-3.5 h-3.5 text-[#7E9088] shrink-0" strokeWidth={1.7} />
        </header>

        {signal.reasons.length > 0 && (
          <ul className="space-y-0.5 mb-1.5">
            {signal.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-[#4E5F57] leading-relaxed">
                <CheckCircle2 className="w-2.5 h-2.5 text-[#3F6B53] mt-1 shrink-0" strokeWidth={2} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        {signal.blockers.length > 0 && (
          <ul className="space-y-0.5 mb-1.5">
            {signal.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-[#7E9088] leading-relaxed">
                <CircleDashed className="w-2.5 h-2.5 text-[#C99746] mt-1 shrink-0" strokeWidth={1.8} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {signal.nextStep && (
          <p className="text-[11.5px] text-[#4E5F57]">
            <span className="font-semibold text-[#1F2A24]">Next:</span> {signal.nextStep}
          </p>
        )}

        {!signal.nextStep && signal.level === "high" && (
          <p className="text-[11.5px] text-[#3F6B53] flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
            All set.
          </p>
        )}
      </article>
    </Link>
  );
}
