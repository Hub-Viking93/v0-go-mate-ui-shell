// =============================================================
// NotificationBell — Phase 6A "notifications"
// =============================================================
// Top-right dashboard bell with unread count + Sheet panel listing
// active notifications. Click navigates to the target route, mark
// read / dismiss controls per item, "Mark all read" bulk action.
//
// Channel = in-app surface. Model is forward-compatible with email
// once a provider is wired.
// =============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Check,
  Circle,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---- Types (mirror of API) ------------------------------------------------

type NotificationType =
  | "deadline_overdue"
  | "deadline_now"
  | "document_missing"
  | "risk_blocker"
  | "arrival_imminent";

type NotificationSeverity = "info" | "nudge" | "urgent";
type NotificationStatus = "pending" | "delivered" | "read" | "dismissed";
type NotificationChannel = "in_app" | "email";

interface NotificationStored {
  id: string;
  dedupeKey: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  targetRoute: string;
  targetRef: { kind: string; ref: string } | null;
  channel: NotificationChannel;
  createdAt: string;
  delivery: {
    channel: NotificationChannel;
    status: NotificationStatus;
    deliveredAt: string | null;
  };
  lastUserActionAt?: string | null;
}

interface NotificationsPayload {
  planId: string;
  generatedAt: string;
  notifications: NotificationStored[];
  counts: {
    total: number;
    unread: number;
    urgentUnread: number;
  };
}

// ---- Visual meta ----------------------------------------------------------

const SEVERITY_META: Record<
  NotificationSeverity,
  { label: string; tone: string; icon: LucideIcon }
> = {
  urgent: {
    label: "Urgent",
    tone: "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10",
    icon: AlertOctagon,
  },
  nudge: {
    label: "Nudge",
    tone: "border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10",
    icon: AlertTriangle,
  },
  info: {
    label: "Info",
    tone: "border-stone-500/40 text-stone-700 dark:text-stone-300 bg-stone-500/10",
    icon: Bell,
  },
};

const TYPE_LABEL: Record<NotificationType, string> = {
  deadline_overdue: "Overdue task",
  deadline_now: "Due soon",
  document_missing: "Missing document",
  risk_blocker: "Blocker",
  arrival_imminent: "Arrival imminent",
};

// ---- Helpers --------------------------------------------------------------

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function isUnread(n: NotificationStored): boolean {
  return n.delivery.status !== "read" && n.delivery.status !== "dismissed";
}

// ---- Component ------------------------------------------------------------

export function NotificationBell({
  buttonClassName,
}: {
  buttonClassName?: string;
}) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<NotificationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        if (res.status === 404) {
          setPayload(null);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as NotificationsPayload;
      setPayload(data);
    } catch (e) {
      // Non-fatal — keep prior state.
      console.warn("[notifications] refresh failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + refresh when sheet opens.
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const counts = payload?.counts ?? { total: 0, unread: 0, urgentUnread: 0 };
  const items = payload?.notifications ?? [];

  const grouped = useMemo(() => {
    const active = items.filter((n) => n.delivery.status !== "dismissed");
    const dismissed = items.filter((n) => n.delivery.status === "dismissed");
    return { active, dismissed };
  }, [items]);

  const patch = useCallback(
    async (id: string, action: "read" | "dismiss" | "unread") => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await refresh();
      } catch (e) {
        console.warn("[notifications] patch failed:", e);
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    const unread = items.filter(isUnread);
    if (unread.length === 0) return;
    await Promise.all(
      unread.map((n) =>
        fetch(`/api/notifications/${encodeURIComponent(n.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read" }),
        }),
      ),
    );
    await refresh();
  }, [items, refresh]);

  const handleClick = useCallback(
    async (n: NotificationStored) => {
      // Mark read on click, then navigate.
      if (isUnread(n)) {
        await patch(n.id, "read");
      }
      setOpen(false);
      setLocation(n.targetRoute);
    },
    [patch, setLocation],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground relative",
            buttonClassName,
          )}
          data-testid="notification-bell"
          data-notification-unread-count={counts.unread}
          aria-label={`Notifications${counts.unread > 0 ? ` — ${counts.unread} unread` : ""}`}
        >
          <Bell className="w-4 h-4" />
          {counts.unread > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1",
                counts.urgentUnread > 0
                  ? "bg-rose-500 text-white"
                  : "bg-amber-500 text-white",
              )}
              data-testid="notification-bell-count"
            >
              {counts.unread > 99 ? "99+" : counts.unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col"
        data-testid="notification-sheet"
      >
        <SheetHeader>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            {counts.unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="text-xs"
                data-testid="notification-mark-all-read"
              >
                Mark all read
              </Button>
            )}
          </div>
          <SheetDescription className="text-xs">
            Proactive nudges based on your current state. Click any item to jump to the right place.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 mt-3 pb-6">
          {loading && !payload ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Reading your notifications…
            </div>
          ) : grouped.active.length === 0 ? (
            <div
              className="rounded-2xl border border-stone-200 dark:border-stone-800 p-6 text-center"
              data-testid="notification-empty-state"
            >
              <Bell className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">All caught up</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nothing currently needs your attention. We'll nudge you when something does.
              </p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="notification-list">
              {grouped.active.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  busy={busyId === n.id}
                  onOpen={() => handleClick(n)}
                  onRead={() => patch(n.id, "read")}
                  onDismiss={() => patch(n.id, "dismiss")}
                />
              ))}
            </ul>
          )}

          {grouped.dismissed.length > 0 && (
            <details className="mt-4">
              <summary className="text-[11px] text-muted-foreground cursor-pointer">
                Dismissed ({grouped.dismissed.length})
              </summary>
              <ul className="space-y-2 mt-2" data-testid="notification-dismissed-list">
                {grouped.dismissed.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    busy={busyId === n.id}
                    onOpen={() => handleClick(n)}
                    onRead={() => patch(n.id, "unread")}
                    onDismiss={() => patch(n.id, "unread")}
                    dimmed
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NotificationRow({
  n,
  busy,
  dimmed,
  onOpen,
  onRead,
  onDismiss,
}: {
  n: NotificationStored;
  busy: boolean;
  dimmed?: boolean;
  onOpen: () => void;
  onRead: () => void;
  onDismiss: () => void;
}) {
  const meta = SEVERITY_META[n.severity];
  const Icon = meta.icon;
  const unread = isUnread(n);
  return (
    <li
      className={cn(
        "rounded-xl border p-3",
        unread
          ? "border-stone-300 dark:border-stone-700 bg-card"
          : "border-stone-200 dark:border-stone-800 bg-card/60",
        dimmed && "opacity-60",
      )}
      data-testid={`notification-${n.id}`}
      data-notification-type={n.type}
      data-notification-severity={n.severity}
      data-notification-status={n.delivery.status}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5",
            meta.tone,
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onOpen}
            className="text-left w-full block"
            data-testid={`notification-link-${n.id}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] py-0", meta.tone)}>
                {meta.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {TYPE_LABEL[n.type]} · {timeAgo(n.createdAt)}
              </span>
              {unread && (
                <Circle
                  className="w-2 h-2 fill-rose-500 stroke-rose-500"
                  aria-label="unread"
                />
              )}
            </div>
            <h4
              className={cn(
                "text-sm leading-snug",
                unread ? "font-semibold" : "font-medium text-foreground/80",
              )}
            >
              {n.title}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
          </button>
          <div className="flex items-center gap-1 mt-2">
            {unread ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRead}
                disabled={busy}
                className="h-6 text-[10px] px-2"
                data-testid={`notification-read-${n.id}`}
              >
                <Check className="w-3 h-3 mr-1" />
                Mark read
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={busy}
              className="h-6 text-[10px] px-2"
              data-testid={`notification-dismiss-${n.id}`}
            >
              <X className="w-3 h-3 mr-1" />
              {dimmed ? "Restore" : "Dismiss"}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
