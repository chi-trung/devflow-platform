import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Plus, ArrowUpRight, Boxes, CalendarRange } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api, pagedItems } from "../lib/api";
import { loadDashboard, type DashboardResult } from "../lib/dashboard";
import { useApi } from "../hooks/useApi";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { EmptyState } from "../components/ui/EmptyState";
import { EmptyTasksIllustration } from "../components/illustrations/EmptyStateIllustrations";
import { StatsCards } from "../components/dashboard/StatsCards";
import { CumulativeFlow } from "../components/dashboard/CumulativeFlow";
import { TaskDistribution } from "../components/dashboard/TaskDistribution";
import { ActivityFeed } from "../components/dashboard/ActivityFeed";
import { DashboardCycleLeadChart } from "../components/dashboard/DashboardCycleLeadChart";
import { TeamReportPanel } from "../components/dashboard/TeamReportPanel";
import { SprintHealthCard } from "../components/dashboard/SprintHealthCard";
import type { ProjectResponse, WorkspaceResponse } from "../types/api";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const {
    data: workspacesRaw,
    error,
    loading,
    reload,
  } = useApi<unknown>(() => api("/workspaces"), []);
  const workspaces = useMemo(
    () => pagedItems<WorkspaceResponse>(workspacesRaw),
    [workspacesRaw],
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWsId, setSelectedWsId] = useState("");

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const displayName = currentUser?.displayName ?? currentUser?.username ?? "";
  const hour = new Date().getHours();
  const greeting = useMemo(() => {
    const key =
      hour < 12
        ? "dashboard.greetingMorning"
        : hour < 18
          ? "dashboard.greetingAfternoon"
          : "dashboard.greetingEvening";
    return t(key, { name: displayName });
  }, [hour, displayName, t]);
  const todayDate = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  useEffect(() => {
    const ws = pagedItems<WorkspaceResponse>(workspacesRaw);
    if (ws.length > 0) {
      setSelectedWsId((current) =>
        ws.some((w) => w.id === current) ? current : ws[0].id,
      );
    }
  }, [workspacesRaw]);

  useEffect(() => {
    if (!selectedWsId) return;
    // Clear the previous workspace's project selection immediately so the
    // SprintHealthCard / stats don't fire requests for a project that belongs
    // to the old workspace (would 404 in the console while projects load).
    setSelectedProjectId("");
    let cancelled = false;
    void api<unknown>(`/workspaces/${selectedWsId}/projects`)
      .then((raw) => {
        if (!cancelled) {
          const list = pagedItems<ProjectResponse>(raw);
          setProjects(list);
          setSelectedProjectId(list[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedWsId]);

  const {
    data: dashboard,
    loading: dashboardLoading,
    error: dashboardError,
    reload: reloadDashboard,
  } = useApi<DashboardResult | null>(
    () => (selectedWsId ? loadDashboard(selectedWsId) : Promise.resolve(null)),
    [selectedWsId],
  );

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError(t("dashboard.workspaceRequired"));
      return;
    }

    setSubmitting(true);
    try {
      await api<{ id: string }>("/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug: slugify(name),
          description: description.trim() || null,
        }),
      });
      setName("");
      setDescription("");
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          {selectedWsId && workspaces.length > 0 ? (
            <>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {t("dashboard.dashboard")}
                </p>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
                  {greeting}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("dashboard.today", { date: todayDate })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {projects.length > 0 && (
                  <select
                    aria-label={t("dashboard.project")}
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                    className="cursor-pointer rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground transition-colors duration-150 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  aria-label={t("dashboard.workspace")}
                  value={selectedWsId}
                  onChange={(event) => setSelectedWsId(event.target.value)}
                  className="cursor-pointer rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground transition-colors duration-150 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                {!creating && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden />
                    {t("dashboard.newWorkspace")}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {t("dashboard.dashboard")}
                </p>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
                  {t("dashboard.title")}
                </h1>
              </div>
              {!creating && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("dashboard.newWorkspace")}
                </Button>
              )}
            </>
          )}
        </div>

        {creating && (
          <form
            onSubmit={handleCreate}
            className="mb-8 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 rise"
            noValidate
          >
            {formError && <ErrorAlert message={formError} />}
            <Field
              label={t("dashboard.name")}
              htmlFor="ws-name"
              hint={t("dashboard.nameHint")}
            >
              <Input
                id="ws-name"
                placeholder={t("dashboard.namePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label={t("dashboard.description")} htmlFor="ws-desc">
              <Input
                id="ws-desc"
                placeholder={t("dashboard.descPlaceholder")}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? t("dashboard.creating") : t("dashboard.createWorkspace")}
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        )}

        {selectedWsId && workspaces && workspaces.length > 0 && (
          <section aria-label={t("dashboard.overview")} className="mb-10">
            <div className="mb-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                {t("dashboard.overview")}
              </h2>
            </div>

            {dashboardLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28" />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Skeleton className="h-72" />
                  <Skeleton className="h-72" />
                </div>
              </div>
            ) : dashboardError ? (
              <div className="space-y-2">
                <ErrorAlert message={dashboardError} />
                <Button variant="outline" size="sm" onClick={reloadDashboard}>
                  {t("common.retry")}
                </Button>
              </div>
            ) : dashboard ? (
              <>
                <StatsCards data={dashboard.data} className="mb-4" />
                {selectedProjectId && (
                  <DashboardCycleLeadChart
                    workspaceId={selectedWsId}
                    projectId={selectedProjectId}
                    className="mb-4"
                  />
                )}
                <CumulativeFlow data={dashboard.data} className="mb-4" />
                <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <TaskDistribution data={dashboard.data} />
                  <ActivityFeed
                    items={dashboard.data.recentActivity}
                    workspaceId={selectedWsId}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <TeamReportPanel workspaceId={selectedWsId} />
                  {selectedProjectId && (
                    <SprintHealthCard
                      workspaceId={selectedWsId}
                      projectId={selectedProjectId}
                    />
                  )}
                </div>
                {dashboard.data.upcomingDeadlines.length > 0 ? (
                  <section aria-label={t("dashboard.upcomingDeadlines")} className="mt-4 rounded-xl border border-border bg-card p-5">
                    <h2 className="mb-3 inline-flex items-center gap-1.5 font-display font-semibold">
                      <CalendarRange className="size-4 text-primary" aria-hidden />
                      {t("dashboard.upcomingDeadlines")}
                    </h2>
                    <ul className="space-y-1">
                      {dashboard.data.upcomingDeadlines.map((deadline) => (
                        <li key={deadline.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-elevated">
                          <span className="min-w-0 flex-1 truncate">{deadline.title}</span>
                          <span className="rounded-md bg-elevated px-2 py-0.5 font-mono text-xs text-muted-foreground">
                            {deadline.projectKey}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(deadline.dueDateUtc).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center">
                    <CalendarRange className="mx-auto size-8 text-muted-foreground" aria-hidden />
                    <p className="mt-2 font-display font-semibold">{t("dashboard.noDeadlines")}</p>
                    <p className="text-sm text-muted-foreground">{t("dashboard.noDeadlinesDesc")}</p>
                  </div>
                )}
              </>
            ) : null}
          </section>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : error ? (
          <ErrorAlert message={error} />
        ) : !workspaces || workspaces.length === 0 ? (
          <div className="rise">
            <EmptyState
              icon={<Boxes className="size-8 text-primary" aria-hidden />}
              illustration={<EmptyTasksIllustration className="size-24" />}
              title={t("dashboard.noWorkspaces")}
              description={t("dashboard.noWorkspacesDesc")}
              action={
                <Button className="mt-3" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("dashboard.newWorkspace")}
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace, index) => (
              <li key={workspace.id} className="rise" style={{ animationDelay: `${index * 60}ms` }}>
                <Link
                  to={`/workspaces/${workspace.id}`}
                  className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Avatar name={workspace.name} id={workspace.id} size="md" />
                    <ArrowUpRight
                      className="size-4 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      aria-hidden
                    />
                  </div>
                  <h2 className="font-display font-semibold">{workspace.name}</h2>
                  <p className="font-mono text-xs text-muted-foreground">
                    /{workspace.slug}
                  </p>
                  {workspace.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {workspace.description}
                    </p>
                  )}
                  <div className="mt-auto pt-3">
                    <Badge tone={workspace.role === "Member" ? "neutral" : "teal"}>
                      {workspace.role}
                    </Badge>
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
