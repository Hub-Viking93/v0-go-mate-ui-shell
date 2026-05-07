// =============================================================
// RefinementSheet — structured form for post-research profile
// completion. Renders one stacked form for every applicable
// RefinementPrompt, patches /api/profile on submit, then shows a
// "Thank you!" screen with a "Refresh my plan" CTA that re-fires
// the research orchestrator (same endpoint as /pre-move's
// Regenerate button).
// =============================================================

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountrySelect } from "@/components/onboarding/country-select";
import type { RefinementPrompt } from "@/lib/gomate/refinements";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: RefinementPrompt[];
  planId: string | null;
  planVersion: number | null;
  onCompleted?: () => void;
}

type Phase = "form" | "saving" | "thanks" | "refreshing";

const CURRENCY_OPTIONS = [
  "EUR", "USD", "GBP", "SEK", "NOK", "DKK", "CHF", "CAD", "AUD", "JPY", "PHP", "THB", "MXN",
];

export function RefinementSheet({
  open,
  onOpenChange,
  prompts,
  planId,
  planVersion,
  onCompleted,
}: Props) {
  const [phase, setPhase] = useState<Phase>("form");
  const [values, setValues] = useState<Record<string, string>>({});
  const [budgetCurrency, setBudgetCurrency] = useState<string>("EUR");
  const [error, setError] = useState<string | null>(null);

  // Reset phase + values when the sheet opens fresh.
  useEffect(() => {
    if (open) {
      setPhase("form");
      setValues({});
      setError(null);
    }
  }, [open]);

  const canSubmit = prompts.every((p) =>
    p.fields.every((f) => {
      const v = values[String(f.key)];
      return v !== undefined && v !== "" && v !== null;
    }),
  );

  async function handleSubmit() {
    if (!canSubmit) return;
    setPhase("saving");
    setError(null);

    // Build profile_data patch. monthly_budget gets the currency suffix
    // baked in so downstream consumers (housing/cost specialists) can
    // parse "1500 EUR" the same way they parse savings_available today.
    const patch: Record<string, unknown> = {};
    for (const p of prompts) {
      for (const f of p.fields) {
        const v = values[String(f.key)];
        if (!v) continue;
        if (f.input.kind === "amount_currency") {
          patch[String(f.key)] = `${v.trim()} ${budgetCurrency}`;
        } else {
          patch[String(f.key)] = v;
        }
      }
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileData: patch, expectedVersion: planVersion ?? 1 }),
      });
      if (!res.ok) {
        // 409 — version conflict. Refetch + retry once.
        if (res.status === 409) {
          const fresh = await fetch("/api/profile");
          if (fresh.ok) {
            const data = (await fresh.json()) as { plan?: { plan_version?: number } };
            const v = data.plan?.plan_version ?? 1;
            const retry = await fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profileData: patch, expectedVersion: v }),
            });
            if (!retry.ok) throw new Error(`HTTP ${retry.status}`);
          } else {
            throw new Error(`HTTP 409 (refetch failed)`);
          }
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      }
      onCompleted?.();
      setPhase("thanks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Try again.");
      setPhase("form");
    }
  }

  async function handleRefreshPlan() {
    setPhase("refreshing");
    try {
      const res = await fetch("/api/plans/trigger-research", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Hard-nav to dashboard so the ResearchProgressModal opens with
      // a clean fetch. Same path as the existing "Generate my plan"
      // and "/pre-move Regenerate" flows.
      window.location.href = "/dashboard?research=triggered";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't refresh. Try again.");
      setPhase("thanks");
    }
  }

  void planId; // reserved for future server-side audit

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
      >
        <div className="px-6 pt-6 pb-4">
          <SheetHeader className="p-0 mb-1">
            <span className="gm-eyebrow">Sharpen your plan</span>
            <SheetTitle className="text-[20px] font-semibold tracking-tight text-[#1F2A24] mt-2">
              {phase === "thanks" ? "Thank you!" : "Follow-up questions"}
            </SheetTitle>
            <SheetDescription className="text-[12.5px] text-[#7E9088] leading-relaxed">
              {phase === "thanks"
                ? "We've added your answers to your profile. Your plan can now be sharpened with the new details."
                : "A few quick details that improve document, immigration and budget guidance."}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-6 pb-24 space-y-6">
          {phase === "form" && (
            <>
              {prompts.map((p) => (
                <div key={p.id} className="space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[14px] font-semibold text-[#1F2A24]">
                      {p.title}
                    </h3>
                    <span className="gm-eyebrow !text-[10px]">{p.area}</span>
                  </div>
                  <p className="text-[12px] text-[#7E9088] leading-relaxed">
                    {p.body}
                  </p>
                  {p.fields.map((f) => {
                    const id = String(f.key);
                    const val = values[id] ?? "";
                    return (
                      <div key={id} className="space-y-1.5">
                        <label
                          htmlFor={id}
                          className="text-[12.5px] font-semibold text-[#1F2A24] block"
                        >
                          {f.label}
                        </label>
                        {f.input.kind === "select" && (
                          <Select
                            value={val || undefined}
                            onValueChange={(v) =>
                              setValues((prev) => ({ ...prev, [id]: v }))
                            }
                          >
                            <SelectTrigger id={id} className="h-10">
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                              {f.input.options.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {f.input.kind === "country" && (
                          <CountrySelect
                            id={id}
                            value={val || null}
                            onChange={(c) =>
                              setValues((prev) => ({ ...prev, [id]: c ?? "" }))
                            }
                          />
                        )}
                        {f.input.kind === "amount_currency" && (
                          <div className="flex gap-2">
                            <Input
                              id={id}
                              type="number"
                              inputMode="numeric"
                              value={val}
                              onChange={(e) =>
                                setValues((prev) => ({ ...prev, [id]: e.target.value }))
                              }
                              placeholder="e.g. 1500"
                              className="h-10 flex-1"
                            />
                            <Select value={budgetCurrency} onValueChange={setBudgetCurrency}>
                              <SelectTrigger className="h-10 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCY_OPTIONS.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {f.helper && (
                          <p className="text-[11.5px] text-[#7E9088] leading-relaxed">
                            {f.helper}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {error && (
                <div
                  className="text-[12px] text-[#8B2F38] gm-surface-sub px-3 py-2"
                  style={{ borderColor: "#E8B8BD" }}
                >
                  {error}
                </div>
              )}
            </>
          )}

          {phase === "saving" && (
            <div className="flex items-center gap-2 text-[12.5px] text-[#7E9088] py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Saving…
            </div>
          )}

          {phase === "thanks" && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md shrink-0"
                  style={{ background: "#E0F0E5", color: "#15663A" }}
                >
                  <CheckCircle2 className="w-4 h-4" strokeWidth={1.8} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1F2A24]">
                    Profile updated
                  </p>
                  <p className="text-[12px] text-[#7E9088] mt-1 leading-relaxed">
                    Your plan still uses the research from your initial generation.
                    Refresh now to weave the new details into visa pathway, documents
                    and budget guidance — or do it later from <span className="text-[#1F2A24] font-medium">Pre-move → Regenerate</span>.
                  </p>
                </div>
              </div>
              {error && (
                <div
                  className="text-[12px] text-[#8B2F38] gm-surface-sub px-3 py-2"
                  style={{ borderColor: "#E8B8BD" }}
                >
                  {error}
                </div>
              )}
            </div>
          )}

          {phase === "refreshing" && (
            <div className="flex items-center gap-2 text-[12.5px] text-[#7E9088] py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Starting research refresh…
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="fixed bottom-0 right-0 w-full sm:max-w-lg bg-white px-6 py-3.5"
          style={{
            borderTop: "1px solid #DCE7DF",
            boxShadow: "0 -4px 12px -8px rgba(31, 42, 36, 0.08)",
          }}
        >
          {phase === "form" && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-[12.5px] text-[#7E9088] hover:text-[#1F2A24] transition-colors"
              >
                Cancel
              </button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="gap-2 rounded-md h-9 px-5 bg-[#1B7A40] text-white hover:bg-[#15663A] shadow-sm disabled:opacity-50 disabled:bg-[#DCE7DF] disabled:text-[#7E9088]"
              >
                Save details
              </Button>
            </div>
          )}
          {phase === "thanks" && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-[12.5px] text-[#7E9088] hover:text-[#1F2A24] transition-colors"
              >
                Done
              </button>
              <Button
                type="button"
                onClick={handleRefreshPlan}
                className="gap-2 rounded-md h-9 px-5 bg-[#1B7A40] text-white hover:bg-[#15663A] shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Refresh my plan
              </Button>
            </div>
          )}
          {(phase === "saving" || phase === "refreshing") && (
            <div className="flex items-center justify-end">
              <Button disabled className="rounded-md h-9 px-5 opacity-50">
                <Loader2 className="w-4 h-4 animate-spin" />
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
