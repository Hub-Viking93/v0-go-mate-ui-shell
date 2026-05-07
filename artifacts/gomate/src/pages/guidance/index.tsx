// =============================================================
// Plan & Guidance — top-level advisory workspace
// =============================================================
// Per sitemap.md: housing support, departure / repatriation, pet
// relocation, tax overview and rule-change monitoring — but
// presented one guidance area at a time via subnav, not stacked as
// a second dashboard.
// =============================================================

import { useEffect, useState } from "react";
import { HousingSupportSection } from "@/components/housing-support-section";
import { DepartureFlowSection } from "@/components/departure-flow-section";
import { PetRelocationSection } from "@/components/pet-relocation-section";
import { TaxOverviewSection } from "@/components/tax-overview-section";
import { RuleChangesSection } from "@/components/rule-changes-section";
import { PageShell, SubNav } from "@/components/layout/page-shell";

type Tab = "housing" | "departure" | "pets" | "tax" | "rule_changes";

export default function GuidancePage() {
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
      title="Plan & Guidance"
      description="Advisory layers — housing, departure, pets, tax, rule changes. One area at a time."
      tint="guidance"
      subnav={
        <SubNav
          items={[
            { id: "housing", label: "Housing" },
            { id: "departure", label: "Departure" },
            { id: "pets", label: "Pets" },
            { id: "tax", label: "Tax" },
            { id: "rule_changes", label: "Rule changes" },
          ]}
          active={tab}
          onChange={onTab}
          testId="guidance-subnav"
        />
      }
      testId="guidance-page"
    >
      {tab === "housing" && <HousingSupportSection />}
      {tab === "departure" && <DepartureFlowSection />}
      {tab === "pets" && <PetRelocationSection />}
      {tab === "tax" && <TaxOverviewSection />}
      {tab === "rule_changes" && <RuleChangesSection />}
    </PageShell>
  );
}

function readTabFromHash(): Tab {
  if (typeof window === "undefined") return "housing";
  const h = window.location.hash.replace(/^#/, "");
  if (h === "housing" || h === "departure" || h === "pets" || h === "tax" || h === "rule_changes") {
    return h as Tab;
  }
  return "housing";
}
