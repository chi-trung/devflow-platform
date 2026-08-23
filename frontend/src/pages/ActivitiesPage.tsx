import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Activity } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Skeleton } from "../components/ui/Skeleton";
import { getActivities } from "../lib/api";
import type { ActivityResponse } from "../types/api";

export function ActivitiesPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [activities, setActivities] = useState<ActivityResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActivities(workspaceId, projectId);
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activity.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to={`/workspaces/${workspaceId}/projects/${projectId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="flex items-center gap-2">
            <Activity className="size-5 text-muted-foreground" aria-hidden />
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("activity.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("activity.description")}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : activities === null ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {t("activity.loadFailed")}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <Activity className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-display text-lg font-semibold">
              {t("activity.emptyTitle")}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("activity.emptyDescription")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {activities.map((activity) => (
              <li
                key={activity.id}
                className="rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      <span className="text-foreground">{activity.actorName}</span>
                      <span className="text-muted-foreground"> {activity.action} </span>
                      <span className="text-foreground">{activity.target}</span>
                    </p>
                    {activity.taskItemId && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Task: {activity.taskItemId}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(activity.createdAtUtc)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
