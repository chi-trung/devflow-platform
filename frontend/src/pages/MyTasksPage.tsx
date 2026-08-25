import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { CalendarClock, ListTodo, Boxes } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { EmptyTasksIllustration } from "../components/illustrations/EmptyStateIllustrations";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { useApi } from "../hooks/useApi";
import { getMyTasks } from "../lib/api";
import type { MyTaskItem } from "../lib/api";

const statusBadge: Record<string, string> = {
  Backlog: "bg-muted-foreground/10 text-muted-foreground",
  InProgress: "bg-primary/10 text-primary",
  InReview: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  Done: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
};

const priorityDot: Record<string, string> = {
  Critical: "bg-destructive",
  High: "bg-amber-300",
  Medium: "bg-primary",
  Low: "bg-muted-foreground/50",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function MyTasksPage() {
  const { t } = useTranslation();
  const { workspaceId = "" } = useParams();

  const {
    data: tasks,
    loading,
    error,
  } = useApi<MyTaskItem[]>(
    () => (workspaceId ? getMyTasks(workspaceId) : Promise.resolve([])),
    [workspaceId],
  );

  const taskList = tasks ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ListTodo className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {t("myTasks.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("myTasks.subtitle")}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} />
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : taskList.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-8 text-muted-foreground/50" aria-hidden />}
            illustration={<EmptyTasksIllustration className="size-24" />}
            title={t("myTasks.empty")}
          />
        ) : (
          <ul className="space-y-2">
            {taskList.map((task) => (
              <li key={task.id}>
                <Link
                  to={`/workspaces/${workspaceId}/projects/${task.projectId}`}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-border-strong hover:bg-elevated"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {task.projectKey}
                      </span>
                      <span className="truncate text-sm font-medium group-hover:text-foreground">
                        {task.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="truncate">{task.projectName}</span>
                      {task.sprintName && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Boxes className="size-3" aria-hidden />
                          {task.sprintName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-full ${priorityDot[task.priority]}`}
                        aria-hidden
                      />
                    </span>
                    {task.dueDateUtc && (
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                          task.status !== "Done" &&
                          new Date(task.dueDateUtc).getTime() < Date.now()
                            ? "font-semibold text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        <CalendarClock className="size-3" aria-hidden />
                        {formatDate(task.dueDateUtc)}
                      </span>
                    )}
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                        statusBadge[task.status] ?? statusBadge.Backlog
                      }`}
                    >
                      {t(`task.${task.status.toLowerCase()}Status`)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
