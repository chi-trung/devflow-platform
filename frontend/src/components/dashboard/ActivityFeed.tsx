import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Activity,
  CalendarRange,
  MessageSquare,
  SquareKanban,
} from "lucide-react";
import { timeAgo } from "../notifications/NotificationItem";
import { Pagination } from "../ui/Pagination";
import type { DashboardActivityItem } from "../../types/api";

const ITEMS_PER_PAGE = 4;

function kindIcon(action: string) {
  const t = action.toLowerCase();
  if (t.includes("comment")) return MessageSquare;
  if (t.includes("sprint")) return CalendarRange;
  if (t.includes("task") || t.includes("assigned") || t.includes("moved"))
    return SquareKanban;
  return Activity;
}

interface ActivityFeedProps {
  items: DashboardActivityItem[];
  workspaceId: string;
}

export function ActivityFeed({ items, workspaceId }: ActivityFeedProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = items.slice(start, start + ITEMS_PER_PAGE);

  // Reset to page 1 when items change (e.g. workspace switch)
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    if (page !== 1) setPage(1);
  }

  return (
    <section
      aria-label={t("dashboard.recentActivity")}
      className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5"
    >
      <h2 className="mb-4 inline-flex items-center gap-1.5 font-display font-semibold">
        <Activity className="size-4 text-primary" aria-hidden />
        {t("dashboard.recentActivity")}
      </h2>

      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
          {t("dashboard.noActivity")}
        </p>
      ) : (
        <>
          <ul className="flex-1 space-y-1">
            {pageItems.map((item) => {
              const Icon = kindIcon(item.action);
              const target = item.target ? ` "${item.target}"` : "";
              const body = (
                <>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="font-medium">{item.actorName || t("dashboard.someone")}</span>{" "}
                    <span className="text-muted-foreground">
                      {item.action}
                      {target}
                    </span>
                  </span>
                  <time
                    dateTime={item.createdAtUtc}
                    className="shrink-0 self-center font-mono text-[10px] text-muted-foreground"
                  >
                    {timeAgo(item.createdAtUtc)}
                  </time>
                </>
              );
              const rowClass =
                "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors duration-150";

              return (
                <li key={`${item.projectId ?? "ws"}-${item.id}`}>
                  {item.taskItemId && item.projectId ? (
                    <Link
                      to={`/workspaces/${workspaceId}/projects/${item.projectId}?task=${item.taskItemId}`}
                      className={`${rowClass} hover:bg-elevated`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {pageCount > 1 && (
            <Pagination
              page={safePage}
              pageCount={pageCount}
              onChange={setPage}
              className="mt-3"
            />
          )}
        </>
      )}
    </section>
  );
}