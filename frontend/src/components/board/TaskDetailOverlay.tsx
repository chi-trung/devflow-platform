import { useCallback, useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useApi } from "../../hooks/useApi";
import { getTask } from "../../lib/api";
import { Button } from "../ui/Button";
import { ErrorAlert } from "../ui/ErrorAlert";
import { Skeleton } from "../ui/Skeleton";
import { TaskDetailPanel } from "./TaskDetailPanel";
import type {
  SprintResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
} from "../../types/api";
import type { CurrentUser } from "../../auth/AuthContext";

// Stable identities for the memoised panel: a `?? []` / inline `.filter()`
// at the render site mints a fresh reference every render and releases the
// memo for the whole loading window.
const EMPTY_MEMBERS: WorkspaceMemberResponse[] = [];
const EMPTY_TASKS: TaskItemResponse[] = [];

interface TaskDetailOverlayProps {
  taskId: string;
  workspaceId: string;
  projectId: string;
  currentUser: CurrentUser | null;
  /** Resolved roster from the board (never `undefined`). */
  members: WorkspaceMemberResponse[];
  membersFailed: boolean;
  onRetryMembers: () => void;
  /** Board sprint list; Completed is filtered inside for the panel. */
  sprints: SprintResponse[];
  sprintsFailed: boolean;
  onRetrySprints: () => void;
  /** Project task list for DependencySection siblings. */
  allTasks: TaskItemResponse[];
  allTasksFailed: boolean;
  onRetryTasks: () => void;
  onClose: () => void;
  onTaskChanged: () => void;
}

/**
 * In-page task detail (IG/FB-post style) over the board. The board keeps
 * `?task=<id>` as the open state so share links and browser Back stay on
 * the same route — this portal is the visual, not a second page.
 *
 * Fail-closed: a failed GET never mounts the panel as an empty article;
 * secondary roster/sprint/task-list failures surface as banners + retry,
 * never as fabricated empty lists the panel would present as "none exist".
 *
 * Chrome (scrim, dialog, focus trap, Escape) lives on the wrapper — the
 * panel itself stays a non-modal `article` so its contract tests hold.
 */
export function TaskDetailOverlay({
  taskId,
  workspaceId,
  projectId,
  currentUser,
  members,
  membersFailed,
  onRetryMembers,
  sprints,
  sprintsFailed,
  onRetrySprints,
  allTasks,
  allTasksFailed,
  onRetryTasks,
  onClose,
  onTaskChanged,
}: TaskDetailOverlayProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { ref: dialogRef, onKeyDown: trapTab } = useFocusTrap<HTMLDivElement>(
    true,
  );

  // The task is the hard gate: never hand the panel a null task.
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

  // Completed sprints stay out of the dropdown — same filter the full-page
  // detail used. Memoised so the panel's prop identity is stable.
  const panelSprints = useMemo(
    () => sprints.filter((s) => s.status !== "Completed"),
    [sprints],
  );

  // A mutation must re-base the dirty check and every list the panel reads.
  const handleTaskChanged = useCallback(() => {
    reloadTask();
    onTaskChanged();
  }, [reloadTask, onTaskChanged]);

  // Escape returns to the board, but never while typing — title/comment
  // fields keep Escape for their own use. stopPropagation keeps the board's
  // window-level handler (selection-clear, character shortcuts) from also
  // firing on the same keystroke.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // keydown can land on Document/Window (no Element API) — only walk
      // the ancestor chain when we actually have an Element.
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable=true]")
      ) {
        return;
      }
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Portal into the shell's main region so AppShell's h1 → document.title
  // MutationObserver sees the panel's heading (same mirror the full-page
  // route used). Fall back to body if the shell hasn't mounted yet.
  const portalRoot =
    document.getElementById("devflow-content") ?? document.body;

  return createPortal(
    // z-[55]: above board layers (graph/activity z-50), below toasts (60)
    // and Dialog/ConfirmDialog (70) so panel-initiated confirms still stack.
    <div className="fixed inset-0 z-[55]">
      <button
        type="button"
        data-testid="overlay-backdrop"
        aria-label={t("ui.closeDialogAria")}
        onClick={onClose}
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
      />
      <div
        ref={dialogRef}
        onKeyDown={trapTab}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden bg-card shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:my-6 sm:h-[calc(100%-3rem)] sm:rounded-2xl sm:border sm:border-border"
      >
        {/* Visible close sits outside the panel article (panel owns content). */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-semibold text-foreground">
            {t("taskDetail.details")}
          </p>
          <button
            type="button"
            aria-label={t("ui.closeDialogAria")}
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {/* Label target only — the panel owns the page's single h1 (plus
              its sr-only mirror for document.title). A second h1 here would
              put two level-1 headings in the a11y tree. */}
          <span id={titleId} className="sr-only">
            {task?.title ?? t("taskDetail.details")}
          </span>

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
                  <Button variant="outline" size="sm" onClick={onRetryMembers}>
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
                  <Button variant="outline" size="sm" onClick={onRetrySprints}>
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
                  <Button variant="outline" size="sm" onClick={onRetryTasks}>
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
                onClose={onClose}
                onTaskChanged={handleTaskChanged}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
