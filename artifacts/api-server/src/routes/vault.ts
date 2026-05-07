// =============================================================
// Phase 2A — basic document vault API
// =============================================================
//
// Surface:
//   GET    /api/vault?planId=…    — list current user's vault entries
//   POST   /api/vault             — register a vault entry after the
//                                   browser uploaded the file directly
//                                   to the relocation-documents bucket
//   DELETE /api/vault/:id         — remove the row + the storage object
//   GET    /api/vault/:id/url     — issue a fresh signed download URL
//
// Why metadata-after-upload (and not multipart on this server):
//   The browser already authenticates against Supabase with the user's
//   JWT and the storage bucket has owner-only RLS. Letting the browser
//   upload directly is faster, cheaper to host, and means we don't have
//   to add a multipart parser dependency to express. The API is the
//   canonical *registry* — the storage bucket is the binary backing
//   store. They are kept in sync via this route.
//
// Phase 2A scope:
//   • One row per uploaded document
//   • Categories from a fixed enum
//   • plan_id linkage so future task↔document mapping (Phase 2B) is a
//     join, not a re-design
//   • Optional notes
//   • linked_task_keys[] reserved column, empty until 2B
// =============================================================

import { Router, type IRouter } from "express";
import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_CATEGORIES = [
  "passport_id",
  "visa_permit",
  "education",
  "employment",
  "financial",
  "housing",
  "civil",
  "health_insurance",
  "pet",
  "other",
] as const;
type DocumentCategory = (typeof ALLOWED_CATEGORIES)[number];

const STORAGE_BUCKET = "relocation-documents";
/** Max size we'll register. Storage itself is enforced server-side; this
 *  is a defence-in-depth check so we don't materialise rows for files
 *  the user couldn't actually upload. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Signed URL TTL — long enough to load + view, short enough to expire
 *  before being shared accidentally. */
const SIGNED_URL_TTL_SECONDS = 60 * 30;

interface VaultRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: DocumentCategory;
  notes: string | null;
  linked_task_keys: string[];
  uploaded_at: string;
  updated_at: string;
}

function isCategory(c: unknown): c is DocumentCategory {
  return typeof c === "string" && (ALLOWED_CATEGORIES as readonly string[]).includes(c);
}

// ---- GET /vault -----------------------------------------------------------

router.get("/vault", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const planIdQ = typeof req.query.planId === "string" ? req.query.planId : null;

    let q = ctx.supabase
      .from("relocation_documents")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("uploaded_at", { ascending: false });
    if (planIdQ) {
      q = q.eq("plan_id", planIdQ);
    }
    const { data, error } = await q;
    if (error) {
      logger.error({ err: error }, "vault GET failed");
      res.status(500).json({ error: "Failed to load vault" });
      return;
    }
    const rows = (data ?? []) as VaultRow[];

    // Enrich with short-lived signed URLs so the UI can preview / download
    // without an extra round-trip per row. Client-side we still ask for a
    // fresh URL on click (`/vault/:id/url`) to support longer sessions.
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await ctx.supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
        return {
          id: row.id,
          planId: row.plan_id,
          fileName: row.file_name,
          storagePath: row.storage_path,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          category: row.category,
          notes: row.notes,
          linkedTaskKeys: row.linked_task_keys,
          uploadedAt: row.uploaded_at,
          updatedAt: row.updated_at,
          signedUrl: signed?.signedUrl ?? null,
          signedUrlExpiresAt: signed?.signedUrl
            ? new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString()
            : null,
        };
      }),
    );

    res.json({ documents: enriched });
  } catch (err) {
    logger.error({ err }, "vault GET threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- POST /vault — register an upload --------------------------------------

router.post("/vault", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const body = (req.body ?? {}) as {
      planId?: string | null;
      fileName?: string;
      storagePath?: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
      category?: string;
      notes?: string | null;
      /** Phase 2B — optional initial task linkage(s) at upload time. */
      linkedTaskKeys?: string[];
    };

    if (!body.fileName || typeof body.fileName !== "string") {
      res.status(400).json({ error: "fileName is required" });
      return;
    }
    if (!body.storagePath || typeof body.storagePath !== "string") {
      res.status(400).json({ error: "storagePath is required" });
      return;
    }
    if (!isCategory(body.category)) {
      res.status(400).json({
        error: `category must be one of ${ALLOWED_CATEGORIES.join(", ")}`,
      });
      return;
    }
    if (body.sizeBytes != null && (typeof body.sizeBytes !== "number" || body.sizeBytes < 0)) {
      res.status(400).json({ error: "sizeBytes must be a non-negative number" });
      return;
    }
    if (body.sizeBytes != null && body.sizeBytes > MAX_FILE_BYTES) {
      res.status(413).json({
        error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`,
      });
      return;
    }

    // Defence in depth — the storage RLS already prevents writes outside
    // the user's own folder, but we double-check that the registered path
    // begins with the authenticated user's id before persisting metadata.
    if (!body.storagePath.startsWith(`${ctx.user.id}/`)) {
      res.status(403).json({
        error: "storagePath must begin with the authenticated user id",
      });
      return;
    }

    // If a planId is supplied, confirm the plan belongs to this user. We
    // allow planId = null for documents not yet associated with a plan
    // (rare but possible mid-onboarding).
    if (body.planId) {
      const { data: plan } = await ctx.supabase
        .from("relocation_plans")
        .select("id")
        .eq("id", body.planId)
        .eq("user_id", ctx.user.id)
        .maybeSingle();
      if (!plan) {
        res.status(404).json({ error: "plan not found for current user" });
        return;
      }
    }

    // Verify the storage object actually exists. If the upload failed
    // half-way we don't want a dangling DB row.
    const folder = body.storagePath.substring(0, body.storagePath.lastIndexOf("/"));
    const { data: storageList, error: storageErr } = await ctx.supabase.storage
      .from(STORAGE_BUCKET)
      .list(folder, { limit: 100, search: body.storagePath.split("/").pop() });
    if (storageErr) {
      logger.error({ err: storageErr, storagePath: body.storagePath }, "vault POST: storage list failed");
      res.status(502).json({ error: "Could not verify uploaded file in storage" });
      return;
    }
    const exists = (storageList ?? []).some(
      (o) => `${folder}/${o.name}` === body.storagePath,
    );
    if (!exists) {
      res.status(409).json({
        error: "No object found at storagePath. Upload to storage first, then call this endpoint.",
      });
      return;
    }

    const linkedTaskKeys = sanitiseTaskKeys(body.linkedTaskKeys);

    const { data: inserted, error: insErr } = await ctx.supabase
      .from("relocation_documents")
      .insert({
        user_id: ctx.user.id,
        plan_id: body.planId ?? null,
        file_name: body.fileName,
        storage_path: body.storagePath,
        mime_type: body.mimeType ?? null,
        size_bytes: body.sizeBytes ?? null,
        category: body.category,
        notes: body.notes ?? null,
        linked_task_keys: linkedTaskKeys,
      })
      .select("*")
      .single();
    if (insErr || !inserted) {
      logger.error({ err: insErr }, "vault POST insert failed");
      res.status(500).json({ error: "Failed to register document" });
      return;
    }

    res.status(201).json({ document: rowToDto(inserted as VaultRow) });
  } catch (err) {
    logger.error({ err }, "vault POST threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- PATCH /vault/:id — link / unlink task keys, edit metadata ------------

router.patch("/vault/:id", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const body = (req.body ?? {}) as {
      /** Add a single task ref to linked_task_keys (no-op if already present). */
      link?: string;
      /** Remove a single task ref from linked_task_keys. */
      unlink?: string;
      /** Replace linked_task_keys wholesale. */
      linkedTaskKeys?: string[];
      /** Optional metadata edits. */
      category?: string;
      notes?: string | null;
    };

    const { data: row, error: rowErr } = await ctx.supabase
      .from("relocation_documents")
      .select("id, user_id, linked_task_keys")
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (rowErr) {
      logger.error({ err: rowErr }, "vault PATCH select failed");
      res.status(500).json({ error: "Failed to look up document" });
      return;
    }
    if (!row) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.category !== undefined) {
      if (!isCategory(body.category)) {
        res.status(400).json({
          error: `category must be one of ${ALLOWED_CATEGORIES.join(", ")}`,
        });
        return;
      }
      updates.category = body.category;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    // Linkage edits — additive (link / unlink) or wholesale replacement.
    let nextLinks: string[] | null = null;
    if (Array.isArray(body.linkedTaskKeys)) {
      nextLinks = sanitiseTaskKeys(body.linkedTaskKeys);
    } else {
      const current = sanitiseTaskKeys(row.linked_task_keys);
      let mutated = false;
      const set = new Set(current);
      if (typeof body.link === "string" && isTaskRefKey(body.link)) {
        if (!set.has(body.link)) {
          set.add(body.link);
          mutated = true;
        }
      }
      if (typeof body.unlink === "string" && isTaskRefKey(body.unlink)) {
        if (set.has(body.unlink)) {
          set.delete(body.unlink);
          mutated = true;
        }
      }
      if (mutated) nextLinks = [...set];
    }
    if (nextLinks !== null) updates.linked_task_keys = nextLinks;

    if (Object.keys(updates).length === 1) {
      // Only updated_at — nothing meaningful to do.
      res.status(400).json({ error: "No updatable fields supplied" });
      return;
    }

    const { data: updated, error: updErr } = await ctx.supabase
      .from("relocation_documents")
      .update(updates)
      .eq("id", row.id)
      .eq("user_id", ctx.user.id)
      .select("*")
      .single();
    if (updErr || !updated) {
      logger.error({ err: updErr }, "vault PATCH failed");
      res.status(500).json({ error: "Failed to update document" });
      return;
    }
    res.json({ document: rowToDto(updated as VaultRow) });
  } catch (err) {
    logger.error({ err }, "vault PATCH threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- DELETE /vault/:id ----------------------------------------------------

router.delete("/vault/:id", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const { data: row, error: rowErr } = await ctx.supabase
      .from("relocation_documents")
      .select("id, storage_path, user_id")
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (rowErr) {
      logger.error({ err: rowErr }, "vault DELETE select failed");
      res.status(500).json({ error: "Failed to look up document" });
      return;
    }
    if (!row) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Remove from storage first; if storage cleanup fails we still drop
    // the row (the file becomes orphaned but is harmless — RLS prevents
    // anyone else seeing it). Log loud so an admin can sweep periodically.
    const { error: storageErr } = await ctx.supabase.storage
      .from(STORAGE_BUCKET)
      .remove([row.storage_path]);
    if (storageErr) {
      logger.warn(
        { err: storageErr, storagePath: row.storage_path },
        "vault DELETE: storage remove failed (continuing with row delete)",
      );
    }

    const { error: dropErr } = await ctx.supabase
      .from("relocation_documents")
      .delete()
      .eq("id", row.id)
      .eq("user_id", ctx.user.id);
    if (dropErr) {
      logger.error({ err: dropErr }, "vault DELETE row failed");
      res.status(500).json({ error: "Failed to delete document row" });
      return;
    }

    res.json({ success: true, id: row.id });
  } catch (err) {
    logger.error({ err }, "vault DELETE threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- GET /vault/:id/url — fresh signed download URL ------------------------

router.get("/vault/:id/url", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  try {
    const { data: row } = await ctx.supabase
      .from("relocation_documents")
      .select("id, storage_path")
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (!row) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const { data: signed, error: sErr } = await ctx.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
    if (sErr || !signed?.signedUrl) {
      logger.error({ err: sErr }, "vault signed-url failed");
      res.status(500).json({ error: "Could not issue download URL" });
      return;
    }
    res.json({
      url: signed.signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "vault signed-url threw");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- Helpers ---------------------------------------------------------------

/** Drop anything that doesn't look like a "<origin>:<key>" ref so we never
 *  persist bogus link strings into the array column. */
function isTaskRefKey(s: string): boolean {
  if (typeof s !== "string") return false;
  const idx = s.indexOf(":");
  if (idx <= 0 || idx === s.length - 1) return false;
  const origin = s.slice(0, idx);
  return origin === "settling-in" || origin === "pre-departure";
}

function sanitiseTaskKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v !== "string") continue;
    if (!isTaskRefKey(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function rowToDto(row: VaultRow) {
  return {
    id: row.id,
    planId: row.plan_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    category: row.category,
    notes: row.notes,
    linkedTaskKeys: row.linked_task_keys,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
  };
}

export default router;
