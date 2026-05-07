// =============================================================
// Post-move — operational post-arrival workspace
// =============================================================
// Per sitemap.md: settling-in checklist as the main work surface,
// with subnav tabs for arrival playbook, setup flows (banking +
// healthcare), licence/insurance and cultural orientation.
// Not a long vertical dump — tabs + compact panels.
// =============================================================

import { useEffect, useState } from "react";
import SettlingInPage from "@/pages/settling-in";
import { ArrivalPlaybookSection } from "@/components/arrival-playbook-section";
import { SetupFlowsSection } from "@/components/setup-flows-section";
import { LicenseInsuranceSection } from "@/components/license-insurance-section";
import { OrientationSection } from "@/components/orientation-section";
import { PageShell, SubNav } from "@/components/layout/page-shell";

type Tab = "checklist" | "playbook" | "setup" | "license" | "orientation";

export default function PostMovePage() {
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
      title="Post-move"
      description="What needs to happen after you land — checklist, playbook, setup flows and orientation."
      tint="postMove"
      subnav={
        <SubNav
          items={[
            { id: "checklist", label: "Checklist" },
            { id: "playbook", label: "Arrival playbook" },
            { id: "setup", label: "Setup flows" },
            { id: "license", label: "Licence + insurance" },
            { id: "orientation", label: "Orientation" },
          ]}
          active={tab}
          onChange={onTab}
          testId="post-move-subnav"
        />
      }
      testId="post-move-page"
    >
      {tab === "checklist" && <SettlingInPage />}
      {tab === "playbook" && <ArrivalPlaybookSection />}
      {tab === "setup" && <SetupFlowsSection />}
      {tab === "license" && <LicenseInsuranceSection />}
      {tab === "orientation" && <OrientationSection />}
    </PageShell>
  );
}

function readTabFromHash(): Tab {
  if (typeof window === "undefined") return "checklist";
  const h = window.location.hash.replace(/^#/, "");
  if (h === "playbook" || h === "setup" || h === "license" || h === "orientation" || h === "checklist") {
    return h as Tab;
  }
  return "checklist";
}
