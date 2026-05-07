// =============================================================
// Phase 6A — email dispatcher
// =============================================================
// Real email delivery via Resend's HTTP API (no SDK dependency — we
// just POST to https://api.resend.com/emails).
//
// Modes (resolved per-call from env, so tests can flip without restart):
//   • live        — real send (requires RESEND_API_KEY + EMAIL_FROM).
//   • audit_only  — no real send; the dispatcher records every attempt
//                   to the user's research_meta.notification_deliveries
//                   ledger so the system is provably "trying" to deliver.
//                   This is the v1 default when no provider is wired.
//   • disabled    — no record, no send. Use only for noisy dev loops.
//
// The dispatcher is intentionally provider-agnostic: any HTTPS-API-style
// transactional provider (Resend, Postmark, SendGrid) follows the same
// {to, from, subject, html} pattern. Swapping is a one-function change.
// =============================================================

import { logger } from "./logger";

export type DispatchMode = "live" | "audit_only" | "disabled";

export interface EmailMessage {
  to: string;
  subject: string;
  bodyText: string;
  /** Used as the From header. Overridable per-call. */
  fromOverride?: string;
}

export interface DispatchAttempt {
  /** Notification id this dispatch tried to send. */
  notificationId: string;
  /** Stable dedupe key. */
  dedupeKey: string;
  channel: "email";
  mode: DispatchMode;
  attemptedAt: string;
  outcome: "sent" | "logged" | "skipped" | "error";
  /** Provider's message id when `mode === "live"` and the call succeeded. */
  providerMessageId?: string;
  errorMessage?: string;
}

export function resolveDispatchMode(): DispatchMode {
  const explicit = (process.env.EMAIL_DISPATCH_MODE ?? "").toLowerCase();
  if (explicit === "live" || explicit === "audit_only" || explicit === "disabled") {
    return explicit;
  }
  // Auto-detect: if the provider key + a from address are present, go live.
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "live";
  return "audit_only";
}

export interface DispatchEmailParams {
  notificationId: string;
  dedupeKey: string;
  message: EmailMessage;
  /** When set to "live", forces a live attempt regardless of env auto-detect. */
  modeOverride?: DispatchMode;
}

/**
 * Attempt to deliver an email notification.
 *
 * Returns a DispatchAttempt record describing what actually happened.
 * Never throws — errors become `outcome: "error"` records so the caller
 * always has something to write to the audit ledger.
 */
export async function dispatchEmail(
  params: DispatchEmailParams,
): Promise<DispatchAttempt> {
  const mode = params.modeOverride ?? resolveDispatchMode();
  const at = new Date().toISOString();

  const baseRecord = {
    notificationId: params.notificationId,
    dedupeKey: params.dedupeKey,
    channel: "email" as const,
    mode,
    attemptedAt: at,
  };

  if (mode === "disabled") {
    return { ...baseRecord, outcome: "skipped" };
  }

  if (mode === "audit_only") {
    logger.info(
      { notificationId: params.notificationId, dedupeKey: params.dedupeKey },
      "[email-dispatcher] audit_only — would send",
    );
    return { ...baseRecord, outcome: "logged" };
  }

  // Live path.
  const apiKey = process.env.RESEND_API_KEY;
  const from = params.message.fromOverride ?? process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    logger.warn(
      { notificationId: params.notificationId },
      "[email-dispatcher] live mode requested but missing RESEND_API_KEY or EMAIL_FROM",
    );
    return {
      ...baseRecord,
      outcome: "error",
      errorMessage: "live mode requested but RESEND_API_KEY or EMAIL_FROM is missing",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.message.to],
        subject: params.message.subject,
        text: params.message.bodyText,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        ...baseRecord,
        outcome: "error",
        errorMessage: `Resend HTTP ${res.status}: ${txt.slice(0, 240)}`,
      };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return {
      ...baseRecord,
      outcome: "sent",
      providerMessageId: json.id,
    };
  } catch (err) {
    return {
      ...baseRecord,
      outcome: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
