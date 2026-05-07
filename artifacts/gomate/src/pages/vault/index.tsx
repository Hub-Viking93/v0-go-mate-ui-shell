// =============================================================
// /vault — Phase 2A document vault page
// =============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CloudUpload,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Lock,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  VaultUploadDialog,
  formatBytes,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type DocumentCategory,
} from "@/components/vault-upload-dialog";
import { cn } from "@/lib/utils";

const CATEGORY_TINT: Record<DocumentCategory, string> = {
  passport_id: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  visa_permit: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  civil: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  education: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  employment: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  financial: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  housing: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
  health_insurance: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30",
  pet: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  other: "bg-stone-500/10 text-stone-700 dark:text-stone-400 border-stone-500/30",
};

interface VaultDocument {
  id: string;
  planId: string | null;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  category: DocumentCategory;
  notes: string | null;
  linkedTaskKeys: string[];
  uploadedAt: string;
  signedUrl: string | null;
}

interface VaultPageProps {
  /** When true, hides the header + privacy line and strips outer
   *  padding so the page can be embedded inside PageShell. */
  embedded?: boolean;
}

// ---- Page ------------------------------------------------------------------

export default function VaultPage({ embedded = false }: VaultPageProps) {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vault");
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in again.");
        throw new Error(`Failed to load vault (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { documents: VaultDocument[] };
      setDocs(data.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void fetch("/api/profile").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      setPlanId(data.plan?.id ?? null);
    });
  }, [refresh]);

  const grouped = useMemo(() => {
    const map = new Map<DocumentCategory, VaultDocument[]>();
    for (const d of docs) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      docs: map.get(c)!,
    }));
  }, [docs]);

  return (
    <div className={embedded ? undefined : "min-h-screen bg-background"}>
      <div className={embedded ? "space-y-4" : "max-w-4xl mx-auto p-6 space-y-6"}>
        {/* Header — only when standalone */}
        {!embedded && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                <Link href="/dashboard">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">Document vault</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your relocation papers in one place. Encrypted at rest, only you can see them.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setUploadOpen(true)}
              size="sm"
              className="gap-1.5 h-8 px-3 text-xs rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E] shrink-0"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Upload
            </Button>
          </div>
        )}

        {/* Privacy line — only when standalone */}
        {!embedded && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-md bg-stone-100/60 border border-stone-200/70 px-3 py-1.5">
            <Lock className="w-3 h-3 text-emerald-600" />
            Files are stored privately under your Supabase account. Download links are short-lived and only valid for you.
          </div>
        )}

        {/* Upload trigger — only when embedded */}
        {embedded && (
          <div className="flex justify-end">
            <Button
              onClick={() => setUploadOpen(true)}
              size="sm"
              className="gap-1.5 h-8 px-3 text-xs rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E]"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Upload
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : docs.length === 0 ? (
          <EmptyState onUpload={() => setUploadOpen(true)} />
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <CategorySection
                key={group.category}
                category={group.category}
                docs={group.docs}
                onDeleted={refresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <VaultUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        planId={planId}
        onUploaded={refresh}
      />
    </div>
  );
}

// ---- Empty state ----------------------------------------------------------

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/40 p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 mx-auto flex items-center justify-center mb-3">
        <FolderOpen className="w-6 h-6 text-emerald-700" />
      </div>
      <h2 className="text-base font-semibold text-foreground mb-0.5">
        No documents yet
      </h2>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
        Add your passport, visa decision letter, apostilled certificates and other relocation papers here.
      </p>
      <Button
        onClick={onUpload}
        size="sm"
        className="gap-1.5 h-8 px-3 text-xs rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E]"
      >
        <CloudUpload className="w-3.5 h-3.5" />
        Upload your first document
      </Button>
    </div>
  );
}

// ---- Category section ------------------------------------------------------

function CategorySection({
  category,
  docs,
  onDeleted,
}: {
  category: DocumentCategory;
  docs: VaultDocument[];
  onDeleted: () => void;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1.5">
        <h2 className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[category]}</h2>
        <span className="text-xs text-muted-foreground">{docs.length} file{docs.length === 1 ? "" : "s"}</span>
      </div>
      <ul className="rounded-lg border border-border divide-y divide-border bg-card overflow-hidden">
        {docs.map((d) => (
          <li key={d.id}>
            <DocumentRow doc={d} onDeleted={onDeleted} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DocumentRow({
  doc,
  onDeleted,
}: {
  doc: VaultDocument;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const sizeText = useMemo(() => formatBytes(doc.sizeBytes), [doc.sizeBytes]);
  const Icon = mimeIcon(doc.mimeType);

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vault/${encodeURIComponent(doc.id)}/url`);
      if (!res.ok) throw new Error(`Failed to issue download URL (HTTP ${res.status})`);
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Could not open file");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vault/${encodeURIComponent(doc.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete (HTTP ${res.status})`);
      onDeleted();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-stone-50 transition-colors">
      <div className={cn("shrink-0 w-8 h-8 rounded-md flex items-center justify-center border", CATEGORY_TINT[doc.category])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <Badge variant="outline" className={cn("text-[10px] py-0", CATEGORY_TINT[doc.category])}>
            {CATEGORY_LABELS[doc.category]}
          </Badge>
          <span>·</span>
          <span>{sizeText}</span>
          <span>·</span>
          <time dateTime={doc.uploadedAt}>
            {new Date(doc.uploadedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </time>
        </div>
        {doc.notes && (
          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{doc.notes}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={busy}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="sr-only">Download</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmingDelete(true)}
          disabled={busy}
          className="h-8 px-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{doc.fileName}</span> will be
              removed from your vault and the file deleted from storage. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy} className="gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Helpers ---------------------------------------------------------------

function mimeIcon(mime: string | null | undefined): typeof FileText {
  if (!mime) return FileText;
  if (mime.startsWith("image/")) return ImageIcon;
  return FileText;
}
