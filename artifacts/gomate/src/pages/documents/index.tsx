// =============================================================
// Documents — top-level vault + requirements workspace
// =============================================================
// Per sitemap.md: Documents is a real top-level workspace covering
// both what you've uploaded (vault) and what you still need to
// gather (schema-driven requirements list with prep guidance).
//
// Sub-tabs:
//   • Vault — uploaded files, categories, link/unlink, signed URLs.
//   • Requirements — schema-driven "what you need" + prep guidance.
// =============================================================

import { useEffect, useState } from "react";
import VaultPage from "@/pages/vault";
import { DocumentsRequirementsList } from "@/components/documents/documents-requirements-list";
import { PageShell, SubNav } from "@/components/layout/page-shell";

type Tab = "vault" | "requirements";

export default function DocumentsPage() {
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
      title="Documents"
      description="Your vault for uploaded files plus the requirements list of what you still need."
      tint="documents"
      subnav={
        <SubNav
          items={[
            { id: "vault", label: "Vault" },
            { id: "requirements", label: "What you need" },
          ]}
          active={tab}
          onChange={onTab}
          testId="documents-subnav"
        />
      }
      testId="documents-page"
    >
      {tab === "vault" && <VaultPage embedded />}
      {tab === "requirements" && <DocumentsRequirementsList />}
    </PageShell>
  );
}

function readTabFromHash(): Tab {
  if (typeof window === "undefined") return "vault";
  const h = window.location.hash.replace(/^#/, "");
  if (h === "requirements" || h === "vault") return h;
  return "vault";
}
