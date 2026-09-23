import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { TaskDetailPanel } from "../components/board/TaskDetailPanel";
import { Button } from "../components/ui/Button";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { Skeleton } from "../components/ui/Skeleton";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { api, getTask, pagedItems } from "../lib/api";
import type {
  SprintResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
} from "../types/api";

// Stable identities for the memoised panel: a `?? []` / inline `.filter()`
// at the render site mints a fresh reference every render and releases the
// memo for the whole loading window.
const EMPTY_MEMBERS: WorkspaceMemberResponse[] = [];
const EMPTY_TASKS: TaskItemResponse[] = [];

/**
 * Full-page task detail (IG/FB-post layout). Owns the data fan-out so a
 * hard refresh works without the board's filter state, and keeps every
 * secondary read fail-closed: an errored roster/sprint/task list renders an
 * honest banner + retry, never a fabricated empty list the panel would
 * present as "none exist".
 */
export function TaskDetailPage() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { workspaceId = "", projectId = "", taskId = "" } = useParams();

  // The task is the page's hard gate: never hand the panel a null task.
  const {
    data: task,
    error: taskError,
    loading: taskLoading,
    reload: reloadTask,
  } = useApi<TaskItemResponse>(() => getTask(workspaceId, projectId, taskId), [
    workspaceId,
    projectId,
    taskId,
  ]);

  const {
    data: members,
    error: membersError,
    reload: reloadMembers,
  } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
    { snapshotKey: `board:members:${workspaceId}` },
  );

  const {
    data: sprintsRaw,
    error: sprintsError,
    reload: reloadSprints,
  } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/sprints`),
    [workspaceId, projectId],
    { snapshotKey: `board:sprints:${workspaceId}:${projectId}` },
  );
  const sprints = useMemo(
    () => pagedItems<SprintResponse>(sprintsRaw),
    [sprintsRaw],
  );
  // Completed sprints stay out of the dropdown — same filter BoardPage
  // handed the panel. Memoised so the panel's prop identity is stable.
  const panelSprints = useMemo(
    () => sprints.filter((s) => s.status !== "Completed"),
    [sprints],
  );

  // DependencySection needs the sibling list (blocked-by / blocking).
  const {
    data: allTasksRaw,
    error: allTasksError,
    reload: reloadAllTasks,
  } = useApi<unknown>(
    () =>
      api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks?page=1&pageSize=100`,
      ),
    [workspaceId, projectId],
    { snapshotKey: `board:tasks:${workspaceId}:${projectId}` },
  );
  const allTasks = useMemo(
    () => pagedItems<TaskItemResponse>(allTasksRaw),
    [allTasksRaw],
  );

  const membersFailed = membersError !== null && members === null;
  const sprintsFailed = sprintsError !== null && sprintsRaw === null;
  const allTasksFailed = allTasksError !== null && allTasksRaw === null;

  const back = useCallback(() => {
    navigate(`/workspaces/${workspaceId}/projects/${projectId}`);
  }, [navigate, workspaceId, projectId]);

  // A mutation (status, comment, subtask…) must re-base the dirty check and
  // every list the panel reads — otherwise a save leaves stale siblings.
  const handleTaskChanged = useCallback(() => {
    reloadTask();
    reloadAllTasks();
    reloadSprints();
  }, [reloadTask, reloadAllTasks, reloadSprints]);

  // Escape returns to the board, but never while typing — the title and
  // comment fields live on this page and must keep Escape for their own use.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target.closest("input, textarea, select, [contenteditable=true]")
      ) {
        return;
      }
      back();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [back]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <Link
            to={`/workspaces/${workspaceId}/projects/${projectId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("taskDetail.backToBoard")}
          </Link>
        </div>

        {taskLoading && task === null ? (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : taskError !== null && task === null ? (
          // Fail-closed: a failed GET never renders an empty article.
          <div className="flex flex-wrap items-center gap-2">
            <ErrorAlert
              id="task-detail-load-error"
              message={taskError || t("taskDetail.taskLoadFailed")}
            />
            <Button variant="outline" size="sm" onClick={reloadTask}>
              {t("common.retry")}
            </Button>
          </div>
        ) : task !== null ? (
          <>
            {membersFailed && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ErrorAlert
                  id="task-detail-members-error"
                  message={t("board.membersLoadFailed")}
                />
                <Button variant="outline" size="sm" onClick={reloadMembers}>
                  {t("common.retry")}
                </Button>
              </div>
            )}
            {sprintsFailed && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ErrorAlert
                  id="task-detail-sprints-error"
                  message={t("board.sprintsLoadFailed")}
                />
                <Button variant="outline" size="sm" onClick={reloadSprints}>
                  {t("common.retry")}
                </Button>
              </div>
            )}
            {allTasksFailed && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ErrorAlert
                  id="task-detail-tasks-error"
                  message={t("taskDetail.taskLoadFailed")}
                />
                <Button variant="outline" size="sm" onClick={reloadAllTasks}>
                  {t("common.retry")}
                </Button>
              </div>
            )}

            <TaskDetailPanel
              task={task}
              currentUser={currentUser}
              members={members ?? EMPTY_MEMBERS}
              sprints={panelSprints}
              allTasks={allTasks ?? EMPTY_TASKS}
              workspaceId={workspaceId}
              projectId={projectId}
              onClose={back}
              onTaskChanged={handleTaskChanged}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
