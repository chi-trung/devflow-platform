import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Bell, CheckCheck, Eye, EyeOff, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Pagination } from "../components/ui/Pagination";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { EmptyNotificationsIllustration } from "../components/illustrations/EmptyStateIllustrations";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import {
  deleteAllReadNotifications,
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../lib/api";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationItem } from "../components/notifications/NotificationItem";
import type { NotificationResponse, PagedResult } from "../types/api";

const PAGE_SIZE = 20;

interface NotificationRow {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  createdAtUtc: string;
  kind: "comment" | "sprint" | "task" | "other";
  taskId: string | null;
  taskItemId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  isRead: boolean;
}

type NotificationFilter = "all" | "unread" | "read" | "mentions";

function kindFromText(text: string): NotificationRow["kind"] {
  const t = text.toLowerCase();
  if (t.includes("comment")) return "comment";
  if (t.includes("sprint") || t.includes("backlog")) return "sprint";
  if (t.includes("task") || t.includes("assigned")) return "task";
  return "other";
}

function fromApi(n: NotificationResponse): NotificationRow {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    actorName: n.actorName ?? null,
    createdAtUtc: n.createdAtUtc,
    kind: kindFromText(n.type || n.message),
    taskId: n.taskItemId ?? null,
    taskItemId: n.taskItemId ?? null,
    workspaceId: n.workspaceId ?? null,
    projectId: n.projectId ?? null,
    isRead: n.readAtUtc != null,
  };
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const { unreadCount } = useNotifications(null, true, {
    onIncoming: () => {
      setRefreshTick((tick) => tick + 1);
    },
  });

  // Only the most recent request may write state. The filter tabs are effect
  // deps and are never disabled, so switching tabs while a page is loading
  // puts two requests in flight; the older response landing last would replace
  // the list the user is looking at (and the page counter with it), or land a
  // stale error next to a list that loaded fine. The request is not
  // abortable from here, so the late response is checked and discarded.
  const loadGeneration = useRef(0);

  const fetchNotifications = useCallback(
    async (pageNum: number, filterTab: NotificationFilter) => {
      const generation = ++loadGeneration.current;
      setLoading(true);
      setError(null);
      try {
        const data: PagedResult<NotificationResponse> = await getNotifications({
          page: pageNum,
          pageSize: PAGE_SIZE,
          unreadOnly: filterTab === "unread",
          readOnly: filterTab === "read",
          mentionsOnly: filterTab === "mentions",
        });
        if (generation !== loadGeneration.current) return;
        setNotifications(data.items.map(fromApi));
        setTotalCount(data.totalCount);
      } catch (err) {
        if (generation !== loadGeneration.current) return;
        setError(err instanceof Error ? err.message : t("notification.loadFailed"));
      } finally {
        if (generation === loadGeneration.current) setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    fetchNotifications(page, filter);
  }, [page, filter, refreshTick, fetchNotifications]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount],
  );

  const unreadVisibleCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setNotifications((current) =>
        current.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notification.markReadFailed"));
    }
  }

  async function handleMarkUnread(id: string) {
    try {
      await markNotificationUnread(id);
      setNotifications((current) =>
        current.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notification.markUnreadFailed"));
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((n) => ({ ...n, isRead: true })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notification.markAllReadFailed"));
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteNotification(id);
      setNotifications((current) => current.filter((n) => n.id !== id));
      setTotalCount((c) => c - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notification.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    try {
      await deleteAllReadNotifications();
      setNotifications((current) => current.filter((n) => !n.isRead));
      setTotalCount((c) => c - notifications.filter((n) => n.isRead).length);
      setPendingBulkDelete(false);
    } catch (err) {
      // Close the dialog first: an error rendered behind an open ConfirmDialog
      // is unreachable (same lesson as the GitHub unlink flow in #224).
      setPendingBulkDelete(false);
      setError(err instanceof Error ? err.message : t("notificationPage.bulkDeleteFailed"));
    }
  }

  // Structural parameter: NotificationItem calls back with the hook's
  // AppNotification shape, which carries taskId; the page's NotificationRow
  // also has it, so one handler serves both.
  const openNotification = useCallback(
    (n: { workspaceId: string | null; projectId: string | null; taskId: string | null }) => {
      if (n.workspaceId && n.projectId) {
        const base = `/workspaces/${n.workspaceId}/projects/${n.projectId}`;
        navigate(n.taskId ? `${base}?task=${n.taskId}` : base);
      }
    },
    [navigate],
  );

  const filterTabs: { key: NotificationFilter; label: string }[] = [
    { key: "all", label: t("notificationPage.filterAll") },
    { key: "unread", label: t("notificationPage.filterUnread") },
    { key: "read", label: t("notificationPage.filterRead") },
    { key: "mentions", label: t("notificationPage.filterMentions") },
  ];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-4">
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("notification.notifications")}
              </h1>
              {unreadCount > 0 && (
                <Badge tone="red">{String(unreadCount)}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleMarkAllRead}
                disabled={loading || unreadVisibleCount === 0}
              >
                <CheckCheck className="size-4" aria-hidden />
                {t("notification.markAllRead")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPendingBulkDelete(true)}
                disabled={loading || notifications.filter((n) => n.isRead).length === 0}
              >
                <Trash2 className="size-4" aria-hidden />
                {t("notificationPage.deleteAllRead")}
              </Button>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setPage(1);
                  setFilter(tab.key);
                }}
                className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  filter === tab.key
                    ? "bg-primary text-on-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ErrorAlert id="notifications-load-error" message={error} />
            <Button variant="outline" size="sm" onClick={() => fetchNotifications(page, filter)}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : notifications.length === 0 && !error ? (
          <EmptyState
            icon={<Bell className="size-8 text-muted-foreground/60" aria-hidden />}
            illustration={<EmptyNotificationsIllustration className="size-24" />}
            title={t("notificationPage.emptyTitle")}
            description={
              filter === "unread"
                ? t("notificationPage.emptyUnread")
                : filter === "read"
                  ? t("notificationPage.emptyRead")
                  : t("notification.noNotifications")
            }
          />
        ) : (
          <>
            <ul role="list" className="flex flex-1 flex-col divide-y divide-border/60 overflow-y-auto rounded-xl border border-border bg-card">
              {notifications.map((n) => (
                <li key={n.id}>
                  <div className="group relative flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <NotificationItem
                        notification={n}
                        unread={!n.isRead}
                        onClick={openNotification}
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-1 transition-opacity duration-150 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                      {n.isRead ? (
                        <button
                          type="button"
                          onClick={() => handleMarkUnread(n.id)}
                          className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                          title={t("notificationPage.markAsUnread")}
                          aria-label={t("notificationPage.markAsUnread")}
                        >
                          <EyeOff className="size-3.5" aria-hidden />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                          title={t("notification.markAllRead")}
                          aria-label={t("notification.markAllRead")}
                        >
                          <Eye className="size-3.5" aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(n.id)}
                        disabled={deletingId === n.id}
                        className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                        title={t("notificationPage.delete")}
                        aria-label={t("notificationPage.deleteAria", {
                          id: n.id,
                        })}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination
                  page={page}
                  pageCount={totalPages}
                  onChange={setPage}
                />
              </div>
            )}
          </>
        )}

        {pendingBulkDelete && (
          <ConfirmDialog
            title={t("notificationPage.bulkDeleteTitle")}
            message={t("notificationPage.bulkDeleteMessage")}
            confirmLabel={t("notificationPage.bulkDeleteConfirm")}
            onConfirm={handleBulkDelete}
            onCancel={() => setPendingBulkDelete(false)}
          />
        )}
      </div>
    </AppShell>
  );
}
