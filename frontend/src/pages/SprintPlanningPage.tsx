import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Flag,
  Play,
  Plus,
  SquareKanban,
} from "lucide-react";
import {
  api,
  assignTaskToSprint,
  completeSprint,
  getSprints,
  pagedItems,
  removeTaskFromSprint,
  startSprint,
} from "../lib/api";
import { createProjectConnection } from "../lib/realtime";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { CreateSprintModal } from "../components/sprint/CreateSprintModal";
import { BurndownChart } from "../components/sprint/BurndownChart";
import { SprintBoard } from "../components/sprint/SprintBoard";
import { SprintProgress } from "../components/sprint/SprintProgress";
import type {
  ProjectResponse,
  SprintResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
} from "../types/api";

function fmt(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function daysLeft(endUtc: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(endUtc).getTime() - Date.now()) / 86_400_000),
  );
}

export function SprintPlanningPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();

  const { data: project } = useApi<ProjectResponse>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}`),
    [workspaceId, projectId],
  );

  const { data: members } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
  );

  const {
    data: sprintsRaw,
    error: sprintsError,
    loading: sprintsLoading,
    reload: reloadSprints,
  } = useApi<unknown>(
    () => getSprints(workspaceId, projectId),
    [workspaceId, projectId],
  );
  const sprints = useMemo(
    () => pagedItems<SprintResponse>(sprintsRaw),
    [sprintsRaw],
  );

  const {
    data: taskDataRaw,
    error,
    loading,
    reload,
  } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/tasks`),
    [workspaceId, projectId],
  );
  const taskData = useMemo(
    () => pagedItems<TaskItemResponse>(taskDataRaw),
    [taskDataRaw],
  );

  const [tasks, setTasks] = useState<TaskItemResponse[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingComplete, setPendingComplete] =
    useState<SprintResponse | null>(null);

  const { currentUser } = useAuth();
  const { push } = useToast();

  useEffect(() => {
    if (taskDataRaw) setTasks(pagedItems<TaskItemResponse>(taskDataRaw));
  }, [taskDataRaw]);

  useEffect(() => {
    if (!projectId) return;

    const connection = createProjectConnection();
    let timer: number | undefined;
    const scheduleReload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        reload();
        reloadSprints();
      }, 400);
    };

    connection.on("project-event", scheduleReload);
    connection
      .start()
      .then(() => connection.invoke("JoinProject", projectId))
      .catch(() => {});

    return () => {
      window.clearTimeout(timer);
      void connection.stop();
    };
  }, [projectId, reload, reloadSprints]);

  const myRole = members?.find((m) => m.userId === currentUser?.id)?.role;
  const canManage = myRole === "Owner" || myRole === "Admin";

  const allSprints = sprints ?? [];
  const active = allSprints.find((s) => s.status === "Active");
  const planned = allSprints.filter((s) => s.status === "Planned");
  const completed = allSprints.filter((s) => s.status === "Completed");
  const planning = allSprints.filter((s) => s.status !== "Completed");

  function openStart(sprintId: string) {
    setStartingId(sprintId);
    setStartDate("");
    setEndDate("");
    setBoardError(null);
  }

  function closeStart() {
    setStartingId(null);
    setStartDate("");
    setEndDate("");
  }

  async function handleAssign(taskId: string, sprintId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.sprintId === sprintId) return;

    setBoardError(null);
    setTasks((current) =>
      current.map((t) => (t.id === taskId ? { ...t, sprintId } : t)),
    );

    try {
      await assignTaskToSprint(workspaceId, projectId, sprintId, taskId);
      const target = allSprints.find((s) => s.id === sprintId);
      push(t("sprint.addedTo", { name: target?.name ?? "sprint" }));
    } catch (err) {
      reload();
      setBoardError(err instanceof Error ? err.message : t("sprint.failedToMove"));
      push(t("sprint.couldntMove"), "error");
    }
  }

  async function handleRemoveFromSprint(taskId: string, sprintId: string) {
    setBoardError(null);
    setTasks((current) =>
      current.map((t) => (t.id === taskId ? { ...t, sprintId: null } : t)),
    );

    try {
      await removeTaskFromSprint(workspaceId, projectId, sprintId, taskId);
      push(t("sprint.movedToBacklog"));
    } catch (err) {
      reload();
      setBoardError(err instanceof Error ? err.message : t("sprint.failedToMove"));
      push(t("sprint.couldntMove"), "error");
    }
  }

  async function handleStart() {
    if (!startingId) return;
    if (!startDate || !endDate) {
      setBoardError(t("sprint.pickDates"));
      return;
    }
    if (endDate <= startDate) {
      setBoardError(t("sprint.endDateAfterStart"));
      return;
    }

    setBusy(true);
    setBoardError(null);
    try {
      await startSprint(workspaceId, projectId, startingId, {
        startDateUtc: new Date(`${startDate}T00:00:00Z`).toISOString(),
        endDateUtc: new Date(`${endDate}T23:59:59Z`).toISOString(),
      });
      closeStart();
      reloadSprints();
      push(t("sprint.sprintStarted"));
    } catch (err) {
      setBoardError(
        err instanceof Error ? err.message : t("sprint.failedToStart"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(sprint: SprintResponse) {
    setBusy(true);
    setBoardError(null);
    try {
      await completeSprint(workspaceId, projectId, sprint.id);
      reloadSprints();
      reload();
      push(t("sprint.completedNamed", { name: sprint.name }));
    } catch (err) {
      setBoardError(
        err instanceof Error ? err.message : t("sprint.failedToComplete"),
      );
    } finally {
      setBusy(false);
      setPendingComplete(null);
    }
  }

  const pageLoading = sprintsLoading || (loading && !taskData);

  return (
    <AppShell>
      <div className="flex min-h-full flex-col px-6 py-6">
        <Link
          to={`/workspaces/${workspaceId}/projects/${projectId}`}
          className="mb-3 inline-flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("board.projects")}
        </Link>

        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("sprint.sprintPlanning")}
              </h1>
              {project && <Badge tone="teal">{project.key}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {project
                ? t("sprint.planDescFor", { name: project.name })
                : t("sprint.planDesc")}
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="size-4" aria-hidden />
              {t("sprint.newSprint")}
            </Button>
          )}
        </header>

        {(error ?? sprintsError ?? boardError) && (
          <div className="mb-4">
            <ErrorAlert message={error ?? sprintsError ?? boardError ?? ""} />
          </div>
        )}

        {pageLoading ? (
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <Skeleton className="h-72" />
            <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-72" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {!active && planned.length === 0 && (
              <div
                className={`rise mb-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-8 py-14 text-center ${completed.length > 0 ? "hidden" : ""}`}
              >
                <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CalendarRange className="size-6" aria-hidden />
                </span>
                <p className="font-display text-lg font-semibold">
                  {t("sprint.noSprintsYet")}
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {t("sprint.noSprintsDesc")}
                </p>
                {canManage && (
                  <Button className="mt-5" onClick={() => setModalOpen(true)}>
                    <Plus className="size-4" aria-hidden />
                    {t("sprint.newSprint")}
                  </Button>
                )}
              </div>
            )}

            {active && (
              <section
                aria-label={t("sprint.activeSprint")}
                className="rise mb-4 rounded-xl border border-primary/30 bg-surface p-4"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2.5">
                  <CalendarRange
                    className="size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <h2 className="font-display text-lg font-semibold">
                    {active.name}
                  </h2>
                  <Badge tone="teal">{t("sprint.active")}</Badge>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {fmt(active.startDateUtc)} – {fmt(active.endDateUtc)}
                    {active.endDateUtc &&
                      ` · ${t("sprint.daysLeft", { days: daysLeft(active.endDateUtc) })}`}
                  </span>
                </div>
                {active.goal && (
                  <p className="text-sm text-muted-foreground">{active.goal}</p>
                )}
                <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
                  <SprintProgress
                    total={
                      tasks.filter((t) => t.sprintId === active.id).length
                    }
                    completed={
                      tasks.filter(
                        (t) =>
                          t.sprintId === active.id && t.status === "Done",
                      ).length
                    }
                    className="min-w-48 flex-1"
                  />
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setPendingComplete(active)}
                    >                    <Flag className="size-3.5" aria-hidden />
                    {t("sprint.completeSprint")}
                    </Button>
                  )}
                </div>
                {active.startDateUtc && active.endDateUtc && (
                  <BurndownChart
                    className="mt-4"
                    startDateUtc={active.startDateUtc}
                    endDateUtc={active.endDateUtc}
                    tasks={tasks.filter((t) => t.sprintId === active.id)}
                  />
                )}
              </section>
            )}

            {planned.length > 0 && (
              <section aria-label={t("sprint.plannedSprints")} className="mb-4">
                <h2 className="mb-2 px-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("sprint.planned")}
                </h2>
                <div className="flex flex-col gap-2">
                  {planned.map((sprint) => (
                    <div
                      key={sprint.id}
                      className="rounded-xl border border-border bg-surface p-4 rise"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <CalendarRange
                          className="size-4 shrink-0 text-violet-300"
                          aria-hidden
                        />
                        <h3 className="text-sm font-semibold">{sprint.name}</h3>
                        <Badge tone="violet">{t("sprint.planned")}</Badge>
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                          {t("sprint.tasksCount", {
                            count: tasks.filter(
                              (task) => task.sprintId === sprint.id,
                            ).length,
                          })}
                        </span>
                        {canManage && startingId !== sprint.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => openStart(sprint.id)}
                          >
                    <Play className="size-3.5" aria-hidden />
                    {t("sprint.start")}
                  </Button>
                        )}
                      </div>
                      {sprint.goal && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {sprint.goal}
                        </p>
                      )}

                      {startingId === sprint.id && (
                        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
                          <label className="flex flex-col gap-1 text-xs font-medium">
                            {t("sprint.startDate")}
                            <Input
                              type="date"
                              value={startDate}
                              onChange={(event) =>
                                setStartDate(event.target.value)
                              }
                              className="w-auto"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium">
                            {t("sprint.endDate")}
                            <Input
                              type="date"
                              value={endDate}
                              min={startDate || undefined}
                              onChange={(event) =>
                                setEndDate(event.target.value)
                              }
                              className="w-auto"
                            />
                          </label>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleStart()}
                          >
                            {busy ? t("sprint.starting") : t("sprint.confirmStart")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={closeStart}
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-label={t("sprint.planWork")} className="mb-2 mt-1">
              <h2 className="mb-2 px-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("sprint.planWork")}
              </h2>
              <p className="mb-3 px-1 text-sm text-muted-foreground">
                {t("sprint.planWorkDesc")}
              </p>
              <SprintBoard
                tasks={tasks}
                sprints={planning}
                onAssign={(taskId, sprintId) =>
                  void handleAssign(taskId, sprintId)
                }
                onRemove={(taskId, sprintId) =>
                  void handleRemoveFromSprint(taskId, sprintId)
                }
              />
            </section>

            {completed.length > 0 && (
              <section aria-label={t("sprint.completedSprints")} className="mt-6">
                <h2 className="mb-2 px-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("sprint.completed")}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {completed.map((sprint) => {
                    const sprintTasks = tasks.filter(
                      (t) => t.sprintId === sprint.id,
                    );
                    const done = sprintTasks.filter(
                      (t) => t.status === "Done",
                    ).length;
                    return (
                      <div
                        key={sprint.id}
                        className="rounded-xl border border-border bg-surface p-4 opacity-80"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <CheckCircle2
                            className="size-4 shrink-0 text-primary"
                            aria-hidden
                          />
                          <h3 className="min-w-0 truncate text-sm font-semibold">
                            {sprint.name}
                          </h3>
                          <Badge tone="neutral">{t("sprint.done")}</Badge>
                        </div>
                        {(sprint.startDateUtc || sprint.endDateUtc) && (
                          <p className="mb-2 font-mono text-[11px] text-muted-foreground">
                            {fmt(sprint.startDateUtc)} –{" "}
                            {fmt(sprint.endDateUtc)}
                          </p>
                        )}
                        <SprintProgress
                          total={sprintTasks.length}
                          completed={done}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {tasks.length === 0 && allSprints.length > 0 && (
              <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-8 py-10 text-center">
                <SquareKanban
                  className="mb-3 size-6 text-muted-foreground"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  {t("sprint.noTasksYetBefore")}{" "}
                  <Link
                    to={`/workspaces/${workspaceId}/projects/${projectId}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {t("sprint.boardLink")}
                  </Link>{" "}
                  {t("sprint.noTasksYetAfter")}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <CreateSprintModal
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            reloadSprints();
            push(t("sprint.sprintCreated"));
          }}
        />
      )}

      {pendingComplete && (
        <ConfirmDialog
          title={t("sprint.completeNamedTitle", { name: pendingComplete.name })}
          message={t("sprint.completeConfirm")}
          confirmLabel={t("sprint.completeSprint")}
          onConfirm={() => void handleComplete(pendingComplete)}
          onCancel={() => setPendingComplete(null)}
        />
      )}
    </AppShell>
  );
}
