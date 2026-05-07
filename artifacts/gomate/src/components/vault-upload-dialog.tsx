// =============================================================
// VaultUploadDialog
// =============================================================
// Shared upload modal — used by /vault and by the task detail sheet's
// "Upload for this task" CTA. Handles the two-step flow:
//
//   1. Browser PUTs the binary to Supabase Storage (RLS-restricted).
//   2. Server registers metadata via POST /api/vault.
//
// When `linkTaskKey` is supplied the registration call also includes
// `linkedTaskKeys: [linkTaskKey]`, so the document is bound to the task
// before the user even sees the success state.
// =============================================================

import { useEffect, useRef, useState } from "react";
import {
  CloudUpload,
  FileWarning,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

export type DocumentCategory =
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

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  passport_id: "Passport / ID",
  visa_permit: "Visa / Permit",
  education: "Education",
  employment: "Employment",
  financial: "Financial",
  housing: "Housing",
  civil: "Civil documents",
  health_insurance: "Health / Insurance",
  pet: "Pet documents",
  other: "Other",
};

export const CATEGORY_ORDER: DocumentCategory[] = [
  "passport_id",
  "visa_permit",
  "civil",
  "education",
  "employment",
  "financial",
  "housing",
  "health_insurance",
  "pet",
  "other",
];

const STORAGE_BUCKET = "relocation-documents";
const MAX_BYTES = 25 * 1024 * 1024;

export interface VaultUploadDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Plan id for ownership scoping. Null means orphan upload. */
  planId: string | null;
  /** Pre-fill the category select. The user can still change it. */
  defaultCategory?: DocumentCategory;
  /**
   * Optional canonical task ref (e.g. "settling-in:reg-population") to bind
   * the new document to immediately. Drives the dialog title + body copy
   * so the user understands the upload context.
   */
  linkTaskKey?: string;
  /** Optional task title for nicer dialog copy when linkTaskKey is set. */
  linkTaskTitle?: string;
  /** Called after a successful upload. */
  onUploaded: () => void;
}

export function VaultUploadDialog({
  open,
  onOpenChange,
  planId,
  defaultCategory = "passport_id",
  linkTaskKey,
  linkTaskTitle,
  onUploaded,
}: VaultUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset category when the dialog reopens with a different default.
  useEffect(() => {
    if (open) setCategory(defaultCategory);
  }, [open, defaultCategory]);

  function reset() {
    setFile(null);
    setNotes("");
    setError(null);
    setUploading(false);
  }

  function handleClose(next: boolean) {
    if (uploading) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleUpload() {
    if (!file) {
      setError("Please pick a file first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File is too large — max ${MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) throw new Error("You're not signed in.");

      const docUuid = crypto.randomUUID();
      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
      const planSegment = planId ?? "orphan";
      const storagePath = `${userId}/${planSegment}/${docUuid}-${safeName}`;

      const { error: storageErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (storageErr) throw storageErr;

      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          fileName: file.name,
          storagePath,
          mimeType: file.type || null,
          sizeBytes: file.size,
          category,
          notes: notes.trim() || null,
          linkedTaskKeys: linkTaskKey ? [linkTaskKey] : [],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload registration failed (HTTP ${res.status})`);
      }

      onUploaded();
      handleClose(false);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const titleText = linkTaskKey ? "Upload document for this task" : "Upload document";
  const descText = linkTaskKey
    ? `The file is added to your vault and immediately linked to "${linkTaskTitle ?? "this task"}". Max 25 MB.`
    : "Add a relocation paper to your vault. PDFs, images, and Office documents work best (max 25 MB).";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            {titleText}
          </DialogTitle>
          <DialogDescription>{descText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1.5 block">
              File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept=".pdf,.png,.jpg,.jpeg,.heic,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/40 dark:bg-stone-900/20 p-3 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors text-left"
            >
              <Plus className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              {file ? (
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">Pick a file</p>
                  <p className="text-xs text-muted-foreground">PDF, PNG, JPG, DOCX, XLSX, CSV…</p>
                </div>
              )}
            </button>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1.5 block">
              Category
            </label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1.5 block">
              Notes <span className="opacity-60 normal-case">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. apostilled, valid until 2027"
              rows={2}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
              <FileWarning className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !file} className="gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
