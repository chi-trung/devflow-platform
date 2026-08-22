import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowUpRight, Boxes } from "lucide-react";
import { api } from "../lib/api";
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
import { StatsCards } from "../components/dashboard/StatsCards";
import { TaskDistribution } from "../components/dashboard/TaskDistribution";
import { ActivityFeed } from "../components/dashboard/ActivityFeed";
import type { WorkspaceResponse } from "../types/api";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function DashboardPage() {
  const {
    data: workspaces,
    error,
    loading,
    reload,
  } = useApi<WorkspaceResponse[]>(() => api("/workspaces"), []);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWsId, setSelectedWsId] = useState("");

  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      setSelectedWsId((current) =>
        workspaces.some((w) => w.id === current) ? current : workspaces[0].id,
      );
    }
  }, [workspaces]);

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
      setFormError("Workspace name is required.");
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
      setFormError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              Workspaces
            </h1>
          </div>
          {!creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              New workspace
            </Button>
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
              label="Name"
              htmlFor="ws-name"
              hint="A short URL slug is generated automatically."
            >
              <Input
                id="ws-name"
                placeholder="Acme Team"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Description" htmlFor="ws-desc">
              <Input
                id="ws-desc"
                placeholder="What is this workspace for?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create workspace"}
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {selectedWsId && workspaces && workspaces.length > 0 && (
          <section aria-label="Overview" className="mb-10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Overview
              </h2>
              <select
                aria-label="Workspace"
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
            </div>

            {dashboardLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28" />
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Skeleton className="h-72" />
                  <Skeleton className="h-72" />
                </div>
              </div>
            ) : dashboardError ? (
              <div className="space-y-2">
                <ErrorAlert message={dashboardError} />
                <Button variant="outline" size="sm" onClick={reloadDashboard}>
                  Retry
                </Button>
              </div>
            ) : dashboard ? (
              <>
                <StatsCards data={dashboard.data} className="mb-4" />
                <div className="grid gap-4 lg:grid-cols-2">
                  <TaskDistribution data={dashboard.data} />
                  <ActivityFeed
                    items={dashboard.data.recentActivity}
                    workspaceId={selectedWsId}
                  />
                </div>
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
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-8 py-16 text-center rise">
            <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Boxes className="size-6" aria-hidden />
            </span>
            <p className="font-display text-lg font-semibold">
              No workspaces yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              A workspace holds your team, projects and boards. Create the first
              one to get going.
            </p>
            <Button className="mt-5" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              New workspace
            </Button>
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
