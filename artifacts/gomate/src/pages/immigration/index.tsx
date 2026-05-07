// =============================================================
// Immigration — top-level workspace
// =============================================================
// Per sitemap.md: home for primary path, plan B, denied/delayed,
// visa/immigration readiness, visa/immigration risks, immigration
// rule changes, and (link to) immigration tasks.
// =============================================================

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ReadinessSection } from "@/components/readiness-section";
import { RisksSection } from "@/components/risks-section";
import { PathwaysSection } from "@/components/pathways-section";
import { RuleChangesSection } from "@/components/rule-changes-section";
import { PageShell, SubNav } from "@/components/layout/page-shell";
import { ArrowRight } from "lucide-react";

type Tab = "overview" | "plan_b" | "rule_changes";

export default function ImmigrationPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>(() => readTabFromHash());

  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const onTab = (id: string) => {
    setTab(id as Tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  return (
    <PageShell
      title="Immigration"
      description="Entry path, legal path and immigration status. One workspace for visa, plan B and what's changing."
      tint="immigration"
      actions={
        <button
          type="button"
          onClick={() => setLocation("/pre-move")}
          data-testid="immigration-open-tasks"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium text-white bg-[#1B7A40] hover:bg-[#15663A] shadow-sm transition-colors"
        >
          Immigration tasks
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
      subnav={
        <SubNav
          items={[
            { id: "overview", label: "Overview" },
            { id: "plan_b", label: "Plan B" },
            { id: "rule_changes", label: "Rule changes" },
          ]}
          active={tab}
          onChange={onTab}
          testId="immigration-subnav"
        />
      }
      testId="immigration-page"
    >
      {tab === "overview" && (
        <div className="space-y-4">
          <ReadinessSection />
          <RisksSection />
        </div>
      )}
      {tab === "plan_b" && (
        <div className="space-y-4">
          <PathwaysSection />
        </div>
      )}
      {tab === "rule_changes" && (
        <div className="space-y-4">
          {/* Scoped to immigration — full feed lives on /guidance#rule_changes. */}
          <RuleChangesSection areaFilter={["visa_immigration", "border_entry"]} />
        </div>
      )}
    </PageShell>
  );
}

function readTabFromHash(): Tab {
  if (typeof window === "undefined") return "overview";
  const h = window.location.hash.replace(/^#/, "");
  if (h === "plan_b" || h === "rule_changes" || h === "overview") return h as Tab;
  return "overview";
}
