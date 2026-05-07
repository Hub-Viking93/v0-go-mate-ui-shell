// =============================================================
// TaskDetailSheet — Phase 1B "pocket-consultant" detail view
// =============================================================
// A right-anchored Sheet that opens when the user clicks a task in
// either checklist surface (settling-in or pre-departure). Shows:
//
//   • title + category + urgency / deadline-type / deadline date
//   • structured walkthrough sections in a stable order:
//       What this is        → 1-2 sentences
//       Why it matters      → consequence-led paragraph
//       Before you start    → bullet list
//       Steps               → numbered list, optional companion link
//       Common mistakes     → bullet list
//       What happens next   → closing paragraph
//   • supplemental: documents, official link, estimated time, cost
//   • status controls (complete / in progress / skip)
//
// When a task has no authored walkthrough we still render the
// summary block but show an explicit empty-state for the
// walkthrough sections rather than fake placeholder text.
// =============================================================

import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  CloudUpload,
  ExternalLink,
  FileSignature,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Link as LinkIcon,
  ListChecks,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  VaultUploadDialog,
  CATEGORY_LABELS as VAULT_CATEGORY_LABELS,
} from "@/components/vault-upload-dialog";
import { DOCUMENT_PREP_GUIDANCE } from "@/lib/gomate/document-prep-mirror";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---- Shared shapes (mirror @workspace/agents) -----------------------------

export interface WalkthroughStepView {
  text: string;
  link?: { url: string; label?: string };
}

/** Phase 1C — task-level structured action link. Mirrors TaskActionLink. */
export type TaskActionLinkTypeView =
  | "official_info"
  | "booking"
  | "form"
  | "portal"
  | "external_practical";

export interface TaskActionLinkView {
  url: string;
  label: string;
  linkType: TaskActionLinkTypeView;
  description?: string;
  appointmentHint?: string;
  languageHint?: string;
  primary?: boolean;
}

/** Phase 2B — document categories required by the task. */
export type DocumentCategoryView =
  | "passport_id"
  | "visa_permit"
  | "education"
  | "employment"
  | "financial"
  | "housing"
  | "civil"
  | "health_insurance"
  | "pet"
  | "other";

/** Phase 2B — vault doc reference passed into the sheet. */
export interface VaultDocRefView {
  id: string;
  fileName: string;
  category: DocumentCategoryView;
  uploadedAt: string;
  linkedTaskKeys: string[];
}

/** Phase 2C — task-level proof guidance. Mirrors ProofGuidance / ProofGoal. */
export interface AcceptableEvidenceView {
  category: DocumentCategoryView;
  description: string;
  note?: string;
}

export interface ProofGoalView {
  id: string;
  label: string;
  description?: string;
  acceptableEvidence: AcceptableEvidenceView[];
  uncoveredHint?: string;
}

export interface ProofGuidanceView {
  proofGoals: ProofGoalView[];
  disclaimer?: string;
}

export interface TaskWalkthroughView {
  whatThisIs?: string;
  whyItMatters?: string;
  beforeYouStart?: string[];
  steps?: WalkthroughStepView[];
  commonMistakes?: string[];
  whatHappensNext?: string;
  /** Phase 1C — structured "next click" links. */
  links?: TaskActionLinkView[];
  /** Phase 2B — document categories required to complete this task. */
  requiredDocumentCategories?: DocumentCategoryView[];
  /** Phase 2C — task-level proof goals + acceptable evidence. */
  proofGuidance?: ProofGuidanceView;
  notes?: string;
}

export type TaskUrgency = "overdue" | "urgent" | "approaching" | "normal";
export type TaskDeadlineType = "legal" | "practical" | "recommended";

/** Subset of fields the sheet needs — both pre-departure and settling-in
 *  rows can be normalised into this shape by the caller. */
export interface TaskDetailViewModel {
  id: string;
  title: string;
  description?: string | null;
  category?: string;
  urgency?: TaskUrgency;
  deadlineType?: TaskDeadlineType;
  /** Absolute deadline (ISO string). */
  deadlineAt?: string | null;
  daysUntilDeadline?: number | null;
  isLegalRequirement?: boolean;
  estimatedTime?: string | null;
  cost?: string | null;
  officialLink?: string | null;
  documentsNeeded?: string[];
  /** Existing free-form steps (often less polished than the walkthrough). */
  legacySteps?: string[];
  walkthrough?: TaskWalkthroughView | null;
  /** "available" / "in_progress" / "completed" / "skipped" / "locked". */
  status?: string;
  blockedBy?: string[];
  /**
   * Phase 2B — canonical task reference key for vault linkage. Format:
   * "settling-in:reg-population" / "pre-departure:visa-submit". Required
   * for the documents section to render the upload + link CTA.
   */
  taskRefKey?: string;
  /** Phase 2B — current plan id, plumbed through for upload context. */
  planId?: string | null;
}

// ---- Props -----------------------------------------------------------------

export interface TaskDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDetailViewModel | null;
  /** Surface a status change. Caller persists it. */
  onStatusChange?: (status: "completed" | "in_progress" | "skipped" | "available") => void;
  /**
   * Phase 2B — the user's vault contents. Passed in by the parent so we
   * don't fetch redundantly on every sheet open. Used to derive what the
   * task already has vs. what's still missing.
   */
  vaultDocs?: VaultDocRefView[];
  /**
   * Called after the user uploads / links / unlinks a document via the
   * sheet. The parent should re-fetch /api/vault and pass the new list in.
   */
  onVaultChange?: () => void;
}

// ---- Render ----------------------------------------------------------------

export function TaskDetailSheet({
  open,
  onOpenChange,
  task,
  onStatusChange,
  vaultDocs,
  onVaultChange,
}: TaskDetailSheetProps) {
  if (!task) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {task.category && (
              <Badge variant="outline" className="text-[10px] py-0 capitalize">
                {task.category.replace(/_/g, " ")}
              </Badge>
            )}
            <DeadlineTypeBadge type={task.deadlineType} legacyLegal={task.isLegalRequirement} />
            <UrgencyBadge urgency={task.urgency} daysLeft={task.daysUntilDeadline ?? null} />
          </div>
          <SheetTitle className="text-left text-[20px] leading-tight">
            {task.title}
          </SheetTitle>
          <DeadlineLine task={task} />
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-5 space-y-6">
            {/* Description (always present on the underlying task) */}
            {task.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Walkthrough — the real "pocket consultant" content */}
            <Walkthrough walkthrough={task.walkthrough ?? null} legacySteps={task.legacySteps ?? []} />

            {/* Phase 2B — task↔vault docs (+ Phase 2C proof / prep guidance) */}
            {((task.walkthrough?.requiredDocumentCategories?.length ?? 0) > 0 ||
              (task.walkthrough?.proofGuidance?.proofGoals?.length ?? 0) > 0) &&
              task.taskRefKey && (
                <>
                  <Separator />
                  <TaskDocumentsSection
                    taskRefKey={task.taskRefKey}
                    taskTitle={task.title}
                    planId={task.planId ?? null}
                    required={task.walkthrough?.requiredDocumentCategories ?? []}
                    proofGuidance={task.walkthrough?.proofGuidance ?? null}
                    vaultDocs={vaultDocs ?? []}
                    onVaultChange={onVaultChange ?? (() => {})}
                  />
                </>
              )}

            {/* Reference block — official link, time, cost, documents */}
            <Separator />
            <ReferenceBlock task={task} />
          </div>
        </ScrollArea>

        {/* Status controls */}
        {onStatusChange && task.status !== "locked" && (
          <div className="border-t border-stone-200 dark:border-stone-800 px-5 py-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={task.status === "completed" ? "default" : "outline"}
              onClick={() => onStatusChange(task.status === "completed" ? "available" : "completed")}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {task.status === "completed" ? "Completed" : "Mark complete"}
            </Button>
            <Button
              size="sm"
              variant={task.status === "in_progress" ? "default" : "outline"}
              onClick={() => onStatusChange("in_progress")}
              className="gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              In progress
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onStatusChange("skipped")}
              className="text-muted-foreground"
            >
              Skip
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---- Walkthrough body ------------------------------------------------------

function Walkthrough({
  walkthrough,
  legacySteps,
}: {
  walkthrough: TaskWalkthroughView | null;
  legacySteps: string[];
}) {
  const hasContent = useMemo(() => hasWalkthrough(walkthrough), [walkthrough]);
  if (!hasContent) {
    // Phase 1B explicit non-goal: no fake step-by-step. If the upstream
    // generator has only the description-level steps, fall back to those
    // labelled honestly as "Quick steps" so we're not pretending it's a
    // pocket-consultant walkthrough.
    if (legacySteps.length > 0) {
      return (
        <Section icon={ListChecks} title="Quick steps">
          <ol className="space-y-2 ml-5 list-decimal text-sm text-muted-foreground">
            {legacySteps.map((s, i) => (
              <li key={i} className="leading-relaxed">{s}</li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground italic mt-3">
            Detailed walkthrough not yet authored for this task. The summary above is from the task's generator.
          </p>
        </Section>
      );
    }
    return (
      <div className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-900/30 p-4 text-sm text-muted-foreground">
        Detailed walkthrough not yet authored for this task. Use the summary and the
        official link above to get started — the structured guide will arrive in a future update.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {walkthrough?.links && walkthrough.links.length > 0 && (
        <TakeAction links={walkthrough.links} />
      )}
      {walkthrough?.whatThisIs && (
        <Section icon={Sparkles} title="What this is">
          <p className="text-sm text-foreground leading-relaxed">{walkthrough.whatThisIs}</p>
        </Section>
      )}
      {walkthrough?.whyItMatters && (
        <Section icon={AlertCircle} title="Why it matters" tint="amber">
          <p className="text-sm text-foreground leading-relaxed">{walkthrough.whyItMatters}</p>
        </Section>
      )}
      {walkthrough?.beforeYouStart && walkthrough.beforeYouStart.length > 0 && (
        <Section icon={FileText} title="Before you start">
          <ul className="space-y-1.5 ml-5 list-disc text-sm text-muted-foreground">
            {walkthrough.beforeYouStart.map((b, i) => (
              <li key={i} className="leading-relaxed">{b}</li>
            ))}
          </ul>
        </Section>
      )}
      {walkthrough?.steps && walkthrough.steps.length > 0 && (
        <Section icon={ListChecks} title="Steps">
          <ol className="space-y-2.5 text-sm text-foreground">
            {walkthrough.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 leading-relaxed">
                  <span>{s.text}</span>
                  {s.link && (
                    <a
                      href={s.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      {s.link.label ?? "Open"}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}
      {walkthrough?.commonMistakes && walkthrough.commonMistakes.length > 0 && (
        <Section icon={AlertCircle} title="Common mistakes" tint="rose">
          <ul className="space-y-1.5 ml-5 list-disc text-sm text-muted-foreground">
            {walkthrough.commonMistakes.map((m, i) => (
              <li key={i} className="leading-relaxed">{m}</li>
            ))}
          </ul>
        </Section>
      )}
      {walkthrough?.whatHappensNext && (
        <Section icon={ChevronRight} title="What happens next">
          <p className="text-sm text-foreground leading-relaxed">{walkthrough.whatHappensNext}</p>
        </Section>
      )}
      {walkthrough?.notes && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium">Additional notes</summary>
          <p className="mt-2 leading-relaxed">{walkthrough.notes}</p>
        </details>
      )}
    </div>
  );
}

function hasWalkthrough(w: TaskWalkthroughView | null | undefined): boolean {
  if (!w) return false;
  return Boolean(
    (w.whatThisIs && w.whatThisIs.trim()) ||
      (w.whyItMatters && w.whyItMatters.trim()) ||
      (w.beforeYouStart && w.beforeYouStart.length > 0) ||
      (w.steps && w.steps.length > 0) ||
      (w.commonMistakes && w.commonMistakes.length > 0) ||
      (w.whatHappensNext && w.whatHappensNext.trim()) ||
      (w.links && w.links.length > 0),
  );
}

// ---- Take action -----------------------------------------------------------

const LINK_TYPE_META: Record<
  TaskActionLinkTypeView,
  { label: string; icon: typeof Building2; tone: "emerald" | "indigo" | "amber" | "stone" }
> = {
  booking: { label: "Booking", icon: CalendarClock, tone: "emerald" },
  official_info: { label: "Official source", icon: Building2, tone: "indigo" },
  form: { label: "Form", icon: FileSignature, tone: "amber" },
  portal: { label: "Portal", icon: KeyRound, tone: "indigo" },
  external_practical: { label: "Practical", icon: ExternalLink, tone: "stone" },
};

function TakeAction({ links }: { links: TaskActionLinkView[] }) {
  // The single primary link, if any, is rendered as the headline CTA.
  // Everything else collapses into a secondary list below — categorised
  // so users see "official info" vs "booking" vs "form" at a glance.
  const primary = links.find((l) => l.primary) ?? null;
  const secondary = links.filter((l) => l !== primary);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-md flex items-center justify-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">Take action</h3>
      </div>
      <div className="pl-8 space-y-3">
        {primary && <PrimaryActionCard link={primary} />}
        {secondary.length > 0 && (
          <ul className="space-y-2">
            {secondary.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                <SecondaryActionRow link={link} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PrimaryActionCard({ link }: { link: TaskActionLinkView }) {
  const meta = LINK_TYPE_META[link.linkType];
  const Icon = meta.icon;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block rounded-xl border bg-gradient-to-br p-3.5 transition-all hover:shadow-md",
        toneToCardClasses(meta.tone),
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
            toneToIconBgClasses(meta.tone),
          )}
        >
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge variant="outline" className="text-[9px] py-0 uppercase tracking-wide">
              {meta.label}
            </Badge>
            {link.languageHint && (
              <Badge variant="outline" className="text-[9px] py-0 text-muted-foreground">
                {link.languageHint}
              </Badge>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug flex items-center gap-1.5">
            {link.label}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </p>
          {link.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{link.description}</p>
          )}
          {link.appointmentHint && (
            <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 px-2.5 py-1.5">
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <span className="font-semibold">On the page: </span>
                {link.appointmentHint}
              </p>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

function SecondaryActionRow({ link }: { link: TaskActionLinkView }) {
  const meta = LINK_TYPE_META[link.linkType];
  const Icon = meta.icon;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2.5 rounded-md px-2.5 py-2 -mx-2 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors"
    >
      <span
        className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5",
          toneToIconBgClasses(meta.tone),
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <Badge variant="outline" className="text-[9px] py-0 uppercase tracking-wide">
            {meta.label}
          </Badge>
          {link.languageHint && (
            <Badge variant="outline" className="text-[9px] py-0 text-muted-foreground">
              {link.languageHint}
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium flex items-center gap-1.5">
          {link.label}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </p>
        {link.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{link.description}</p>
        )}
        {link.appointmentHint && (
          <p className="text-[11px] text-muted-foreground italic mt-1 leading-relaxed">
            <span className="font-semibold not-italic">On the page: </span>
            {link.appointmentHint}
          </p>
        )}
      </div>
    </a>
  );
}

function toneToCardClasses(tone: "emerald" | "indigo" | "amber" | "stone"): string {
  switch (tone) {
    case "emerald":
      return "from-emerald-50 to-emerald-50/40 dark:from-emerald-950/30 dark:to-emerald-950/10 border-emerald-200 dark:border-emerald-900/60";
    case "indigo":
      return "from-indigo-50 to-indigo-50/40 dark:from-indigo-950/30 dark:to-indigo-950/10 border-indigo-200 dark:border-indigo-900/60";
    case "amber":
      return "from-amber-50 to-amber-50/40 dark:from-amber-950/30 dark:to-amber-950/10 border-amber-200 dark:border-amber-900/60";
    case "stone":
      return "from-stone-50 to-stone-50/40 dark:from-stone-950/30 dark:to-stone-950/10 border-stone-200 dark:border-stone-800";
  }
}

function toneToIconBgClasses(tone: "emerald" | "indigo" | "amber" | "stone"): string {
  switch (tone) {
    case "emerald":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "indigo":
      return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
    case "amber":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "stone":
      return "bg-stone-500/15 text-stone-700 dark:text-stone-300";
  }
}

// ---- Reference block -------------------------------------------------------

function ReferenceBlock({ task }: { task: TaskDetailViewModel }) {
  // Hide the legacy officialLink when the same URL is already surfaced
  // through the Phase 1C structured links — avoids duplication.
  const walkthroughLinkUrls = new Set((task.walkthrough?.links ?? []).map((l) => l.url));
  const showOfficialLink = task.officialLink && !walkthroughLinkUrls.has(task.officialLink);
  const hasAny =
    showOfficialLink ||
    task.estimatedTime ||
    task.cost ||
    (task.documentsNeeded && task.documentsNeeded.length > 0) ||
    (task.blockedBy && task.blockedBy.length > 0);
  if (!hasAny) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-[0.14em] font-semibold text-stone-500 dark:text-stone-400">
        Reference
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
        {task.estimatedTime && (
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Time</p>
              <p>{task.estimatedTime}</p>
            </div>
          </div>
        )}
        {task.cost && (
          <div className="flex items-start gap-2">
            <span className="w-3.5 h-3.5 mt-0.5 text-muted-foreground font-bold text-xs leading-none">⌗</span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cost</p>
              <p>{task.cost}</p>
            </div>
          </div>
        )}
        {showOfficialLink && task.officialLink && (
          <a
            href={task.officialLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400 hover:underline col-span-full"
          >
            <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Official source ({hostnameOf(task.officialLink)})</span>
          </a>
        )}
      </div>
      {task.documentsNeeded && task.documentsNeeded.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Documents needed</p>
          <ul className="space-y-1 ml-5 list-disc text-xs text-muted-foreground">
            {task.documentsNeeded.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <div className="rounded-md bg-stone-100 dark:bg-stone-900 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold">Blocked by:</span> {task.blockedBy.join(", ")}
        </div>
      )}
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---- Section + badges ------------------------------------------------------

function Section({
  icon: Icon,
  title,
  tint,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  tint?: "amber" | "rose";
  children: React.ReactNode;
}) {
  const iconBg =
    tint === "amber"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : tint === "rose"
        ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("w-6 h-6 rounded-md flex items-center justify-center", iconBg)}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

function UrgencyBadge({
  urgency,
  daysLeft,
}: {
  urgency: TaskUrgency | undefined;
  daysLeft: number | null;
}) {
  if (!urgency || urgency === "normal") return null;
  if (urgency === "overdue") {
    return (
      <Badge variant="destructive" className="text-[10px] py-0">
        {daysLeft != null && daysLeft < 0 ? `Overdue by ${Math.abs(daysLeft)}d` : "Overdue"}
      </Badge>
    );
  }
  if (urgency === "urgent") {
    return (
      <Badge className="text-[10px] py-0 bg-red-500 text-white hover:bg-red-500">
        {daysLeft == null || daysLeft <= 0
          ? "Due today"
          : daysLeft === 1
            ? "Due tomorrow"
            : `Due in ${daysLeft}d`}
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] py-0 bg-amber-500 text-white hover:bg-amber-500">
      {daysLeft != null && daysLeft <= 7 ? "Due this week" : `Due in ${daysLeft ?? "≤14"}d`}
    </Badge>
  );
}

function DeadlineTypeBadge({
  type,
  legacyLegal,
}: {
  type: TaskDeadlineType | undefined;
  legacyLegal?: boolean;
}) {
  if (!type && !legacyLegal) return null;
  if (type === "legal" || (!type && legacyLegal)) {
    return (
      <Badge variant="destructive" className="text-[10px] py-0">
        Legal
      </Badge>
    );
  }
  if (type === "recommended") {
    return (
      <Badge variant="outline" className="text-[10px] py-0 text-stone-600 dark:text-stone-300 border-stone-400/50">
        Recommended
      </Badge>
    );
  }
  return null;
}

function DeadlineLine({ task }: { task: TaskDetailViewModel }) {
  if (!task.deadlineAt) return null;
  const d = new Date(task.deadlineAt);
  const formatted = d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <p className="text-xs text-muted-foreground mt-1.5 text-left">
      Deadline: <span className="font-medium text-foreground">{formatted}</span>
    </p>
  );
}

// ---- Phase 2B: TaskDocumentsSection ---------------------------------------

/**
 * Document section inside the detail sheet. Splits the user's vault docs
 * into "covered" (uploaded + matches a required category OR explicitly
 * linked to the task) and the still-missing required categories. Each
 * missing chip has its own "Upload for this task" CTA so the upload is
 * pre-categorised + auto-linked.
 */
function TaskDocumentsSection({
  taskRefKey,
  taskTitle,
  planId,
  required,
  proofGuidance,
  vaultDocs,
  onVaultChange,
}: {
  taskRefKey: string;
  taskTitle: string;
  planId: string | null;
  required: DocumentCategoryView[];
  proofGuidance: ProofGuidanceView | null;
  vaultDocs: VaultDocRefView[];
  onVaultChange: () => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategoryView>("other");
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkCategory, setLinkCategory] = useState<DocumentCategoryView | null>(null);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const { covered, missing, byCategory } = useMemo(() => {
    const explicit = new Set<string>(); // doc ids
    const byCat = new Map<DocumentCategoryView, VaultDocRefView[]>();

    for (const doc of vaultDocs) {
      if (doc.linkedTaskKeys.includes(taskRefKey)) {
        explicit.add(doc.id);
      }
    }

    const covered: VaultDocRefView[] = [];
    const missing: DocumentCategoryView[] = [];

    for (const cat of required) {
      const matchingByCategory = vaultDocs.filter((d) => d.category === cat);
      const explicitForCat = vaultDocs.filter(
        (d) => d.linkedTaskKeys.includes(taskRefKey) && d.category === cat,
      );
      // If we have any explicit-for-this-task in the right category, those
      // are the canonical ones for the cat. Otherwise any uploaded doc in
      // the same category counts as covering it (with a small visual
      // "matched by category" hint).
      const list = explicitForCat.length > 0 ? explicitForCat : matchingByCategory;
      if (list.length === 0) {
        missing.push(cat);
      } else {
        byCat.set(cat, list);
        for (const d of list) {
          if (!covered.find((c) => c.id === d.id)) covered.push(d);
        }
      }
    }

    return { covered, missing, byCategory: byCat, explicit };
  }, [required, vaultDocs, taskRefKey]);

  // Phase 2C — per-goal coverage. A goal counts as covered when at least
  // one acceptable-evidence category has a matching uploaded doc (explicit
  // link OR same category). The user-facing copy uses softer language —
  // "covered" / "still uncertain" — to keep it preparation-flavoured, not
  // approval-flavoured.
  const goalCoverage = useMemo(() => {
    const goals = proofGuidance?.proofGoals ?? [];
    return goals.map((goal) => {
      const wantedCategories = new Set<DocumentCategoryView>(
        goal.acceptableEvidence.map((e) => e.category),
      );
      const matchedDocs = vaultDocs.filter(
        (d) =>
          wantedCategories.has(d.category) ||
          (d.linkedTaskKeys.includes(taskRefKey) && wantedCategories.has(d.category)),
      );
      return {
        goal,
        covered: matchedDocs.length > 0,
        matchedDocs,
      };
    });
  }, [proofGuidance, vaultDocs, taskRefKey]);

  // Phase 2C — categories whose authored prep guidance has anything
  // substantive to render. Covers union of required + every category
  // referenced by a proof goal's acceptable evidence.
  const prepCategories = useMemo(() => {
    const set = new Set<DocumentCategoryView>(required);
    for (const goal of proofGuidance?.proofGoals ?? []) {
      for (const ev of goal.acceptableEvidence) set.add(ev.category);
    }
    return Array.from(set).filter((cat) => {
      const g = DOCUMENT_PREP_GUIDANCE[cat];
      return Boolean(
        g &&
          (
            (g.preparationRules && g.preparationRules.length > 0) ||
            (g.commonMistakes && g.commonMistakes.length > 0) ||
            g.validity ||
            g.translationRule ||
            g.apostilleRule ||
            g.originalVsCopy
          ),
      );
    });
  }, [required, proofGuidance]);

  function startUpload(category: DocumentCategoryView) {
    setUploadCategory(category);
    setUploadOpen(true);
  }

  function startLink(category: DocumentCategoryView) {
    setLinkCategory(category);
    setLinkPickerOpen(true);
  }

  async function handleLink(docId: string, link: string) {
    setBusyDocId(docId);
    try {
      const res = await fetch(`/api/vault/${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed (HTTP ${res.status})`);
      }
      onVaultChange();
      setLinkPickerOpen(false);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Could not link document");
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleUnlink(docId: string) {
    setBusyDocId(docId);
    try {
      const res = await fetch(`/api/vault/${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlink: taskRefKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed (HTTP ${res.status})`);
      }
      onVaultChange();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Could not unlink document");
    } finally {
      setBusyDocId(null);
    }
  }

  const allCovered = missing.length === 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center",
          allCovered
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        )}>
          {allCovered ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        </span>
        <h3 className="text-sm font-semibold text-foreground">Documents for this task</h3>
        <span className="text-xs text-muted-foreground">
          {covered.length}/{required.length} covered
        </span>
      </div>

      <div className="pl-8 space-y-4">
        {/* Required categories — always visible so the user knows what they
            owe even before uploading any. */}
        {required.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
              Required
            </p>
            <div className="flex flex-wrap gap-1.5">
              {required.map((cat) => {
                const isMissing = missing.includes(cat);
                return (
                  <Badge
                    key={cat}
                    variant="outline"
                    className={cn(
                      "text-[10px] py-0.5",
                      isMissing
                        ? "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/20"
                        : "border-emerald-500/40 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20",
                    )}
                  >
                    {isMissing ? <Circle className="w-2.5 h-2.5 mr-1" /> : <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
                    {VAULT_CATEGORY_LABELS[cat]}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 2C — what you're proving */}
        {proofGuidance && proofGuidance.proofGoals.length > 0 && (
          <ProofGoalsBlock
            goals={goalCoverage}
            taskRefKey={taskRefKey}
            onLinkExisting={(cat) => startLink(cat)}
            onUpload={(cat) => startUpload(cat)}
            availableLinkCandidates={vaultDocs}
          />
        )}

        {/* Already covered list — by category, with unlink option */}
        {covered.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
              Already in your vault
            </p>
            <ul className="space-y-1.5">
              {required
                .filter((cat) => byCategory.has(cat))
                .flatMap((cat) =>
                  (byCategory.get(cat) ?? []).map((doc) => {
                    const isExplicitlyLinked = doc.linkedTaskKeys.includes(taskRefKey);
                    return (
                      <li
                        key={`${cat}-${doc.id}`}
                        className="flex items-start gap-2.5 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 px-3 py-2"
                      >
                        <span className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 mt-0.5">
                          {(doc.fileName.match(/\.(png|jpe?g|webp|heic)$/i)) ? (
                            <ImageIcon className="w-3.5 h-3.5" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {VAULT_CATEGORY_LABELS[cat]}
                            <span className="mx-1">·</span>
                            <time dateTime={doc.uploadedAt}>
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                            </time>
                            {!isExplicitlyLinked && (
                              <>
                                <span className="mx-1">·</span>
                                <span className="italic">matched by category</span>
                              </>
                            )}
                          </p>
                        </div>
                        {isExplicitlyLinked ? (
                          <button
                            type="button"
                            onClick={() => handleUnlink(doc.id)}
                            disabled={busyDocId === doc.id}
                            className="shrink-0 text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
                          >
                            {busyDocId === doc.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Unlink
                          </button>
                        ) : (
                          // Phase 2B — promote a category-matched doc to an
                          // explicit task↔doc link. Matched-by-category covers
                          // the requirement loosely; this button lets the user
                          // firm it up so it's auditable + survives doc-level
                          // category changes.
                          <button
                            type="button"
                            onClick={() => handleLink(doc.id, taskRefKey)}
                            disabled={busyDocId === doc.id}
                            className="shrink-0 text-[11px] text-muted-foreground hover:text-emerald-700 flex items-center gap-1"
                          >
                            {busyDocId === doc.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <LinkIcon className="w-3 h-3" />
                            )}
                            Link existing
                          </button>
                        )}
                      </li>
                    );
                  }),
                )}
            </ul>
          </div>
        )}

        {/* Missing — with upload + link CTAs per category */}
        {missing.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
              Missing
            </p>
            <ul className="space-y-2">
              {missing.map((cat) => {
                const candidates = vaultDocs.filter((d) => d.category === cat);
                return (
                  <li
                    key={cat}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Circle className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" />
                      <p className="text-sm font-medium truncate">{VAULT_CATEGORY_LABELS[cat]}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {candidates.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startLink(cat)}
                          className="h-7 text-xs gap-1"
                        >
                          <LinkIcon className="w-3 h-3" />
                          Link existing
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => startUpload(cat)}
                        className="h-7 text-xs gap-1"
                      >
                        <CloudUpload className="w-3 h-3" />
                        Upload
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Phase 2C — preparation guide per relevant category */}
        {prepCategories.length > 0 && (
          <PrepGuideBlock categories={prepCategories} />
        )}

        {/* Phase 2C — preparation-guidance disclaimer (not approval). */}
        <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold not-italic">Preparation guide, not approval.</span>{" "}
            {proofGuidance?.disclaimer ??
              "We tell you what's usually accepted and how to prepare it. We can't promise the authority will accept any specific upload — final decisions stay with them."}
          </p>
        </div>
      </div>

      {/* Upload-for-task dialog — auto-links to taskRefKey */}
      <VaultUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        planId={planId}
        defaultCategory={uploadCategory}
        linkTaskKey={taskRefKey}
        linkTaskTitle={taskTitle}
        onUploaded={onVaultChange}
      />

      {/* Link-existing picker */}
      <Dialog open={linkPickerOpen} onOpenChange={setLinkPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              Link a document
            </DialogTitle>
            <DialogDescription>
              Pick a document from your vault to link to <span className="font-medium text-foreground">"{taskTitle}"</span>.
              {linkCategory && <> Showing <span className="font-medium">{VAULT_CATEGORY_LABELS[linkCategory]}</span> only.</>}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
            {vaultDocs
              .filter((d) => !linkCategory || d.category === linkCategory)
              .filter((d) => !d.linkedTaskKeys.includes(taskRefKey))
              .map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => handleLink(doc.id, taskRefKey)}
                    disabled={busyDocId === doc.id}
                    className="w-full flex items-center gap-3 rounded-md border border-stone-200 dark:border-stone-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 px-3 py-2 text-left transition-colors"
                  >
                    <span className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <FileText className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {VAULT_CATEGORY_LABELS[doc.category]} · Uploaded{" "}
                        {new Date(doc.uploadedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    {busyDocId === doc.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  </button>
                </li>
              ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Phase 2C: ProofGoalsBlock --------------------------------------------

/**
 * Renders the "What you're proving" subsection — one card per proof goal,
 * with acceptable-evidence chips + a soft coverage badge ("Covered" /
 * "Still uncertain"). When uncovered, the card surfaces a per-evidence
 * Upload / Link CTA so the user has a frictionless next step from the
 * proof view.
 */
function ProofGoalsBlock({
  goals,
  taskRefKey,
  availableLinkCandidates,
  onLinkExisting,
  onUpload,
}: {
  goals: Array<{ goal: ProofGoalView; covered: boolean; matchedDocs: VaultDocRefView[] }>;
  taskRefKey: string;
  availableLinkCandidates: VaultDocRefView[];
  onLinkExisting: (cat: DocumentCategoryView) => void;
  onUpload: (cat: DocumentCategoryView) => void;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
        What you're proving
      </p>
      <ul className="space-y-2.5">
        {goals.map(({ goal, covered, matchedDocs }) => {
          const evidenceCats = new Set(goal.acceptableEvidence.map((e) => e.category));
          return (
            <li
              key={goal.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                covered
                  ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/15"
                  : "border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30",
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5",
                    covered
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-400",
                  )}
                >
                  {covered ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{goal.label}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] py-0 ml-auto",
                        covered
                          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                          : "border-amber-500/40 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {covered ? "Covered" : "Still uncertain"}
                    </Badge>
                  </div>
                  {goal.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {goal.description}
                    </p>
                  )}
                  {/* Evidence chips */}
                  <div className="mt-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                      Usually accepted
                    </p>
                    <ul className="space-y-1">
                      {goal.acceptableEvidence.map((ev, i) => (
                        <li
                          key={`${goal.id}-${i}`}
                          className="flex items-start gap-2 text-xs"
                        >
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 shrink-0 mt-0.5"
                          >
                            {VAULT_CATEGORY_LABELS[ev.category]}
                          </Badge>
                          <span className="text-foreground leading-relaxed">
                            {ev.description}
                            {ev.note && (
                              <span className="text-muted-foreground italic"> — {ev.note}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Uncovered hint + CTAs */}
                  {!covered && (
                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                      {goal.uncoveredHint && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 italic">
                          {goal.uncoveredHint}
                        </p>
                      )}
                      <div className="flex gap-1.5 ml-auto">
                        {(() => {
                          // Pick the first acceptable category for the CTA so
                          // the upload pre-fills sensibly. The picker still
                          // lets the user change it.
                          const firstCat = goal.acceptableEvidence[0]?.category;
                          if (!firstCat) return null;
                          const hasCandidate = availableLinkCandidates.some(
                            (d) => evidenceCats.has(d.category) && !d.linkedTaskKeys.includes(taskRefKey),
                          );
                          return (
                            <>
                              {hasCandidate && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onLinkExisting(firstCat)}
                                  className="h-7 text-xs gap-1"
                                >
                                  <LinkIcon className="w-3 h-3" />
                                  Link existing
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => onUpload(firstCat)}
                                className="h-7 text-xs gap-1"
                              >
                                <CloudUpload className="w-3 h-3" />
                                Upload
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {/* Matched docs (compact) */}
                  {covered && matchedDocs.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Matched: {matchedDocs.map((d) => d.fileName).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- Phase 2C: PrepGuideBlock ---------------------------------------------

/**
 * Compact preparation-guide cards — one per category that has authored
 * prep rules. Each card shows the bullets the user actually needs to
 * follow before submitting a document of that category. Common-mistakes
 * are tagged so the user can scan for "what NOT to do".
 */
function PrepGuideBlock({ categories }: { categories: DocumentCategoryView[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
        How to prepare
      </p>
      <ul className="space-y-2">
        {categories.map((cat) => {
          const guide = DOCUMENT_PREP_GUIDANCE[cat];
          if (!guide) return null;
          return (
            <li
              key={cat}
              className="rounded-lg border border-stone-200 dark:border-stone-800 bg-card px-3 py-2.5"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                >
                  {VAULT_CATEGORY_LABELS[cat]}
                </Badge>
                {guide.description && (
                  <p className="text-[11px] text-muted-foreground italic line-clamp-1">{guide.description}</p>
                )}
              </div>
              {guide.preparationRules && guide.preparationRules.length > 0 && (
                <ul className="space-y-0.5 text-xs ml-5 list-disc text-foreground/90">
                  {guide.preparationRules.map((rule, i) => (
                    <li key={i} className="leading-relaxed">{rule}</li>
                  ))}
                </ul>
              )}
              {/* Quick-reference rule pills */}
              {(guide.validity || guide.translationRule || guide.apostilleRule || guide.originalVsCopy) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {guide.validity && <RulePill label="Validity" text={guide.validity} />}
                  {guide.originalVsCopy && <RulePill label="Original vs copy" text={guide.originalVsCopy} />}
                  {guide.translationRule && <RulePill label="Translation" text={guide.translationRule} />}
                  {guide.apostilleRule && <RulePill label="Apostille" text={guide.apostilleRule} />}
                </div>
              )}
              {guide.commonMistakes && guide.commonMistakes.length > 0 && (
                <details className="mt-2 group">
                  <summary className="cursor-pointer select-none text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Common mistakes ({guide.commonMistakes.length})
                  </summary>
                  <ul className="mt-1.5 ml-5 list-disc space-y-0.5 text-xs text-muted-foreground">
                    {guide.commonMistakes.map((m, i) => (
                      <li key={i} className="leading-relaxed">{m}</li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RulePill({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/30 px-2 py-1 text-[10px] leading-snug max-w-full">
      <span className="font-semibold text-foreground">{label}: </span>
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
