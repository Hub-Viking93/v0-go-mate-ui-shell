import { ChefHat, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoordinatorPanelProps {
  rationale: { specialist: string; reason: string }[];
  runStatus:
    | "pending"
    | "researching"
    | "synthesizing"
    | "critiquing"
    | "redispatching"
    | "completed"
    | "partial"
    | "failed";
}

function statusBanner(s: CoordinatorPanelProps["runStatus"]): { label: string; sub: string; tone: string } {
  switch (s) {
    case "pending":
      return { label: "Preparing your research team…", sub: "Lining up the right specialists for your move.", tone: "neutral" };
    case "researching":
      return { label: "Specialists are researching", sub: "Each agent is reading official sources for your destination.", tone: "active" };
    case "synthesizing":
      return { label: "Synthesizing the unified guide", sub: "Cross-checking findings for consistency between sections.", tone: "active" };
    case "critiquing":
      return { label: "Critiquing the draft", sub: "Adversarial pass — looking for gaps, weak claims, and missing pieces.", tone: "active" };
    case "redispatching":
      return { label: "Re-dispatching for follow-up", sub: "The Critic identified gaps — running additional specialists.", tone: "active" };
    case "completed":
      return { label: "Research complete", sub: "Your guide is ready. Redirecting to your dashboard…", tone: "success" };
    case "partial":
      return { label: "Research finished with warnings", sub: "Some specialists couldn't reach all sources — guide is partial.", tone: "warning" };
    case "failed":
      return { label: "Research failed", sub: "Something went wrong. You can re-trigger from the dashboard.", tone: "error" };
  }
}

export function CoordinatorPanel({ rationale, runStatus }: CoordinatorPanelProps) {
  const b = statusBanner(runStatus);
  const isActive = b.tone === "active";

  return (
    <section
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden",
        isActive && "ring-2 ring-blue-200/60 dark:ring-blue-800/60",
        b.tone === "success" && "ring-1 ring-green-200/60 dark:ring-green-800/60",
        b.tone === "warning" && "ring-1 ring-amber-200/60 dark:ring-amber-800/60",
        b.tone === "error" && "ring-1 ring-red-200/60 dark:ring-red-800/60",
      )}
      data-testid="coordinator-panel"
    >
      <header className="p-5 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <ChefHat className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Coordinator
              {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="coordinator-status">
              <span className="font-medium text-foreground/90">{b.label}</span> — {b.sub}
            </p>
          </div>
        </div>
      </header>
      <div className="p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Why these specialists ({rationale.length})
        </h3>
        <ul className="space-y-2">
          {rationale.map((r) => (
            <li key={r.specialist} className="text-xs text-foreground/80 leading-relaxed flex gap-2">
              <span className="text-primary shrink-0">•</span>
              <span>{r.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
