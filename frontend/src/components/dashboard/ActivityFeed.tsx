import { Link } from "react-router-dom";
import {
  Activity,
  CalendarRange,
  MessageSquare,
  SquareKanban,
} from "lucide-react";
import { timeAgo } from "../notifications/NotificationItem";
import type { DashboardActivityItem } from "../../types/api";

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
  return (
    <section
      aria-label="Recent activity"
      className="rounded-xl border border-border bg-card p-5"
    >
      <h2 className="mb-4 inline-flex items-center gap-1.5 font-display font-semibold">
        <Activity className="size-4 text-primary" aria-hidden />
        Recent activity
      </h2>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No recent activity in this workspace.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = kindIcon(item.action);
            const target = item.target ? ` "${item.target}"` : "";
            const body = (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="font-medium">{item.actorName}</span>{" "}
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
      )}
    </section>
  );
}
