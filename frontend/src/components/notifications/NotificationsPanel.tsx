import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import type { IncomingNotification } from "../../lib/realtime";
import { useToast } from "../ui/ToastProvider";
import { NotificationItem } from "./NotificationItem";

interface NotificationsPanelProps {
  workspaceId?: string | null;
  direction?: "up" | "down";
}

export function NotificationsPanel({
  workspaceId,
  direction = "down",
}: NotificationsPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { push } = useToast();

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
    readIds,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications(workspaceId, true, { onIncoming: handleIncoming });

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function handleItemClick(notification: {
    id: string;
    workspaceId: string | null;
    projectId: string | null;
  }) {
    markRead(notification.id);
    setOpen(false);
    if (notification.workspaceId && notification.projectId) {
      navigate(
        `/workspaces/${notification.workspaceId}/projects/${notification.projectId}`,
      );
    }
  }

  const triggerRef = useRef<HTMLButtonElement>(null);

  function getDropdownStyle(): React.CSSProperties {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 320; // w-80
    const alignRight = rect.right + dropdownWidth > window.innerWidth;
    const left = alignRight ? rect.right - dropdownWidth : rect.left;
    if (direction === "up") {
      return { position: "fixed" as const, left, bottom: window.innerHeight - rect.top + 8, zIndex: 80 };
    }
    return { position: "fixed" as const, left, top: rect.bottom + 8, zIndex: 80 };
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

      {open && (
        <div
          style={getDropdownStyle()}
          className="w-80 overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
          role="dialog"
          aria-label={t("notification.notifications")}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("notification.notifications")}
            </h2>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              {t("notification.markAllRead")}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
                <Bell className="size-5 text-muted-foreground/60" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  {t("notification.noNotifications")}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <NotificationItem
                      notification={notification}
                      unread={!readIds.has(notification.id)}
                      onClick={() => void handleItemClick(notification)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
