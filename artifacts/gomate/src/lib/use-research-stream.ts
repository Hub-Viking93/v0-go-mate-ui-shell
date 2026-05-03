/**
 * useResearchStream — React hook for the GET /api/research/status SSE stream.
 *
 * Why fetch() + ReadableStream instead of EventSource: EventSource
 * doesn't support custom headers, and the api-server uses Bearer-token
 * auth. The window.fetch wrapper installed by api-fetch.ts injects the
 * Supabase access token into the Authorization header for any /api/*
 * call, so we can lean on that and read the stream manually.
 *
 * Backoff: on disconnect (other than normal terminal completion) we
 * retry with exponential backoff up to 3 attempts before surfacing
 * an error to the caller. Re-entering the page resets the counter.
 */

import { useEffect, useRef, useState } from "react";
import type { AgentLiveState } from "@/components/research/AgentPanel";

export type RunStatus =
  | "pending"
  | "researching"
  | "synthesizing"
  | "critiquing"
  | "redispatching"
  | "completed"
  | "partial"
  | "failed"
  | "missing";

export interface ResearchSnapshot {
  profileId: string;
  rationale: { specialist: string; reason: string }[];
  agents: Record<string, AgentLiveState>;
  runStatus: RunStatus;
  startedAt: string;
  completedAt?: string;
  synth?: {
    sectionCount: number;
    consistencyIssues: string[];
    unresolvedIssues: string[];
    wallClockMs: number;
    tokensUsed: number;
    modelUsed: string;
  };
  critic?: {
    gapCount: number;
    weakClaimCount: number;
    missingForUserCount: number;
    wallClockMs: number;
    tokensUsed: number;
    modelUsed: string;
  };
  redispatchRoundsRun: number;
  errorMessage?: string;
}

export interface UseResearchStreamResult {
  snapshot: ResearchSnapshot | null;
  error: string | null;
  /** True once the run has reached a terminal state. */
  isTerminal: boolean;
  /** True while the SSE connection is open. */
  isStreaming: boolean;
}

const TERMINAL: ReadonlySet<RunStatus> = new Set(["completed", "partial", "failed", "missing"]);

export function useResearchStream(profileId: string | null): UseResearchStreamResult {
  const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!profileId) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    let attempt = 0;
    const controller = new AbortController();
    abortRef.current = controller;

    async function connect() {
      while (!cancelled) {
        try {
          setIsStreaming(true);
          setError(null);
          const url = `/api/research/status?profileId=${encodeURIComponent(profileId!)}`;
          const res = await fetch(url, {
            method: "GET",
            headers: { Accept: "text/event-stream" },
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok) {
            // Hard auth/permission errors don't deserve retries.
            if (res.status === 401 || res.status === 403 || res.status === 400) {
              const body = await res.text().catch(() => "");
              throw new Error(`SSE refused (${res.status}): ${body}`);
            }
            throw new Error(`SSE non-OK: ${res.status}`);
          }
          if (!res.body) throw new Error("SSE stream missing body");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let lastSnap: ResearchSnapshot | null = null;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const evt of events) {
              const trimmed = evt.trim();
              if (!trimmed || trimmed.startsWith(":")) continue; // heartbeat / blank
              const lines = trimmed.split("\n");
              const dataLines = lines.filter((l) => l.startsWith("data:"));
              if (dataLines.length === 0) continue;
              const json = dataLines.map((l) => l.slice(5).trim()).join("");
              try {
                const parsed = JSON.parse(json) as ResearchSnapshot;
                lastSnap = parsed;
                if (!cancelled) setSnapshot(parsed);
              } catch (parseErr) {
                console.warn("[research-stream] JSON parse failed:", parseErr, json.slice(0, 200));
              }
            }
          }
          // Stream closed cleanly. If we reached a terminal state, stop;
          // otherwise reconnect (server may have closed mid-run).
          setIsStreaming(false);
          if (cancelled) return;
          if (lastSnap && TERMINAL.has(lastSnap.runStatus)) return;
          attempt += 1;
          if (attempt > 3) {
            setError("Live stream disconnected after multiple retries.");
            return;
          }
          await sleep(Math.min(8_000, 500 * 2 ** attempt));
        } catch (err) {
          setIsStreaming(false);
          if (cancelled) return;
          // AbortError surfaces as DOMException — treat as cancellation.
          if (err instanceof Error && err.name === "AbortError") return;
          attempt += 1;
          const msg = err instanceof Error ? err.message : String(err);
          // Hard refusals (auth) shouldn't loop forever.
          if (msg.startsWith("SSE refused")) {
            setError(msg);
            return;
          }
          if (attempt > 3) {
            setError(msg);
            return;
          }
          await sleep(Math.min(8_000, 500 * 2 ** attempt));
        }
      }
    }

    void connect();
    return () => {
      cancelled = true;
      controller.abort();
      setIsStreaming(false);
    };
  }, [profileId]);

  const isTerminal = snapshot ? TERMINAL.has(snapshot.runStatus) : false;
  return { snapshot, error, isTerminal, isStreaming };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
