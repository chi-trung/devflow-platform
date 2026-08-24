import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import type { IncomingNotification } from "../../lib/realtime";
import { deleteAllReadNotifications } from "../../lib/api";
import { useToast } from "../ui/ToastProvider";
import { NotificationItem } from "./NotificationItem";
import { Dialog } from "../ui/Dialog";

type NotificationFilter = "all" | "unread" | "read";

interface NotificationsPanelProps {
  workspaceId?: string | null;
  direction?: "up" | "down";
}

export function NotificationsPanel({
  workspaceId,
  direction = "down",
}: NotificationsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [pendingCleanup, setPendingCleanup] = useState(false);

  const handleIncoming = useCallback(
    (notification: IncomingNotification) => {
      push(notification.message ?? t("notification.newNotification"), "info");
    },
    [push, t],
  );

  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications(workspaceId, true, { onIncoming: handleIncoming });

  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    if (filter === "read") return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, filter]);

  const readCount = notifications.filter((n) => n.isRead).length;
  const allRead = notifications.length > 0 && readCount === notifications.length;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inside =
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target);
      if (!inside) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  function handleItemClick(notification: {
    id: string;
    workspaceId: string | null;
    projectId: string | null;
    taskId: string | null;
  }) {
    markRead(notification.id);
    setOpen(false);
    if (notification.workspaceId && notification.projectId) {
      const base = `/workspaces/${notification.workspaceId}/projects/${notification.projectId}`;
      navigate(notification.taskId ? `${base}?task=${notification.taskId}` : base);
    }
  }

  const triggerRef = useRef<HTMLButtonElement>(null);

  function getDropdownStyle(): React.CSSProperties {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 320;
    const alignRight = rect.right + dropdownWidth > window.innerWidth;
    const left = alignRight ? rect.right - dropdownWidth : rect.left;
    if (direction === "up") {
      return { position: "fixed" as const, left, bottom: window.innerHeight - rect.top + 8, zIndex: 80 };
    }
    return { position: "fixed" as const, left, top: rect.bottom + 8, zIndex: 80 };
  }

  async function handleCleanup() {
    setPendingCleanup(false);
    try {
      await deleteAllReadNotifications();
      refresh();
      push(t("notification.cleanupConfirm"));
    } catch {
      // ignore
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) refresh();
          setOpen((value) => !value);
        }}
        aria-label={`${t("notification.notifications")}${unreadCount > 0 ? ` ${t("notification.unreadSuffix", { count: unreadCount })}` : ""}`}
        aria-expanded={open}
        className="relative rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
        <div
          ref={dropdownRef}
          style={getDropdownStyle()}
          className="w-80 overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
          role="dialog"
          aria-label={t("notification.notifications")}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("notification.notifications")}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                {t("notification.markAllRead")}
              </button>
              <button
                type="button"
                onClick={() => setPendingCleanup(true)}
                disabled={readCount === 0}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t("notification.cleanup")}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
            {(["all", "unread", "read"] as NotificationFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`flex-1 cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 ${
                  filter === tab
                    ? "bg-primary text-on-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "all" ? t("notificationPage.filterAll") : tab === "unread" ? t("notificationPage.filterUnread") : t("notificationPage.filterRead")}
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : allRead && filter !== "unread" ? (
              <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
                <CheckCheck className="size-5 text-primary" aria-hidden />
                <p className="text-sm font-medium text-foreground">
                  {t("notification.allCaughtUp")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("notification.noNotifications")}
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
                <Bell className="size-5 text-muted-foreground/60" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  {filter === "unread"
                    ? t("notificationPage.emptyUnread")
                    : filter === "read"
                      ? t("notificationPage.emptyRead")
                      : t("notification.noNotifications")}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {filtered.map((notification) => (
                  <li key={notification.id}>
                    <NotificationItem
                      notification={notification}
                      unread={!notification.isRead}
                      onClick={() => handleItemClick(notification)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              {t("notification.viewAll")}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {pendingCleanup && (
        <Dialog
          open
          onClose={() => setPendingCleanup(false)}
          title={t("notification.cleanupTitle")}
          footer={
            <>
              <button
                type="button"
                onClick={() => setPendingCleanup(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleCleanup}
                className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90"
              >
                {t("notification.cleanupConfirm")}
              </button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">{t("notification.cleanupMessage")}</p>
        </Dialog>
      )}
    </div>
  );
}
