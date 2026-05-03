/**
 * GET /api/research/status?profileId=… — Wave 2.x Prompt 3.5
 *
 * Server-Sent Events stream of live research-run status. Single
 * unified stream per run (per the plan: simpler than per-agent
 * endpoints, fewer connections).
 *
 * Auth: caller must own the profileId (verified against the
 * relocation_plans.user_id column with the caller's RLS-scoped
 * client — RLS would reject the read anyway, but we make the
 * intent explicit and return 403 instead of leaking).
 *
 * Lifecycle:
 *   - Send the current snapshot immediately as the first event.
 *   - Subscribe to the in-memory EventEmitter; push every change.
 *   - Heartbeat ping every 15s (SSE comment line) to defeat proxy
 *     idle-timeouts.
 *   - Close when runStatus is terminal (completed | partial | failed).
 *
 * Wire format: each event is `data: <json-snapshot>\n\n`. Heartbeats
 * are `: ping\n\n` (SSE comment lines, ignored by clients).
 *
 * NOTE on auth via SSE: EventSource doesn't support custom headers,
 * so the frontend uses fetch() + ReadableStream (same pattern as
 * the chat streaming) and passes the Bearer token in the
 * Authorization header. This route just verifies the header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { authenticate } from "../lib/supabase-auth";
import {
  getRunState,
  subscribeToRun,
  type ResearchRunSnapshot,
} from "../lib/agents/research-orchestrator";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const HEARTBEAT_MS = 15_000;

function send(res: Response, snapshot: ResearchRunSnapshot): void {
  // Per SSE spec: each "event" is a `data:` line followed by an empty line.
  // We serialize the whole snapshot — the client overwrites its local state.
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
}

router.get("/research/status", async (req: Request, res: Response) => {
  try {
    const profileId = String(req.query.profileId ?? "").trim();
    if (!profileId) {
      res.status(400).json({ error: "Missing profileId query param" });
      return;
    }

    const ctx = await authenticate(req, res);
    if (!ctx) return;

    // Verify ownership — RLS would reject a foreign read but we want a
    // crisp 403 instead of an opaque 404.
    const { data: ownerRow, error: ownerErr } = await ctx.supabase
      .from("relocation_plans")
      .select("id")
      .eq("id", profileId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (ownerErr || !ownerRow) {
      res.status(403).json({ error: "Not authorized for this profile" });
      return;
    }

    // ---- SSE handshake -------------------------------------------------
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    // Flush headers before any data so the client starts streaming.
    res.flushHeaders?.();

    let closed = false;
    const cleanups: Array<() => void> = [];
    const close = () => {
      if (closed) return;
      closed = true;
      for (const c of cleanups) {
        try { c(); } catch { /* ignore */ }
      }
      try { res.end(); } catch { /* ignore */ }
    };

    // ---- Initial snapshot ---------------------------------------------
    const initial = getRunState(profileId);
    if (initial) {
      send(res, initial);
      // If already terminal, close immediately after the snapshot.
      if (
        initial.runStatus === "completed" ||
        initial.runStatus === "partial" ||
        initial.runStatus === "failed"
      ) {
        // Allow the client a moment to flush the final state to UI.
        setTimeout(close, 50);
        return;
      }
    } else {
      // No run found — emit a `not-found` snapshot so the client can
      // distinguish from "still pending" and decide to re-trigger or redirect.
      res.write(`data: ${JSON.stringify({ profileId, runStatus: "missing", agents: {}, rationale: [], startedAt: "", redispatchRoundsRun: 0 })}\n\n`);
      setTimeout(close, 50);
      return;
    }

    // ---- Subscribe to live updates ------------------------------------
    const unsubscribe = subscribeToRun(profileId, (snap) => {
      if (closed) return;
      send(res, snap);
      if (
        snap.runStatus === "completed" ||
        snap.runStatus === "partial" ||
        snap.runStatus === "failed"
      ) {
        // Final snapshot pushed — close after a small delay so the client
        // flushes before the EOF.
        setTimeout(close, 100);
      }
    });
    cleanups.push(unsubscribe);

    // ---- Heartbeat ----------------------------------------------------
    const heartbeat = setInterval(() => {
      if (closed) return;
      try {
        res.write(": ping\n\n");
      } catch (err) {
        logger.warn({ err, profileId }, "[research/status] heartbeat write failed; closing");
        close();
      }
    }, HEARTBEAT_MS);
    cleanups.push(() => clearInterval(heartbeat));

    // ---- Tear down on client disconnect -------------------------------
    req.on("close", close);
    req.on("aborted", close);
    res.on("close", close);
    res.on("error", close);
  } catch (err) {
    logger.error({ err }, "[research/status] unhandled error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      try { res.end(); } catch { /* ignore */ }
    }
  }
});

export default router;
