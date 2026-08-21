import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, FolderKanban } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import type {
  ProjectResponse,
  TaskItemResponse,
  WorkspaceResponse,
} from "../types/api";

function deriveKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 5);
  }
  return name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
}

interface ProjectWithStats extends ProjectResponse {
  total: number;
  done: number;
}

export function WorkspacePage() {
  const { workspaceId = "" } = useParams();

  const {
    data: workspace,
    error: wsError,
    loading: wsLoading,
  } = useApi<WorkspaceResponse>(
    () => api(`/workspaces/${workspaceId}`),
    [workspaceId],
  );

  const {
    data: projects,
    error: projError,
    loading: projLoading,
    reload,
  } = useApi<ProjectResponse[]>(
    () => api(`/workspaces/${workspaceId}/projects`),
    [workspaceId],
  );

  const [stats, setStats] = useState<Record<string, { total: number; done: number }>>({});

  useEffect(() => {
    if (!projects) return;
    let cancelled = false;

    Promise.all(
      projects.map(async (project) => {
        const tasks = await api<TaskItemResponse[]>(
          `/workspaces/${workspaceId}/projects/${project.id}/tasks`,
        );
        return [
          project.id,
          {
            total: tasks.length,
            done: tasks.filter((t) => t.status === "Done").length,
          },
        ] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) setStats(Object.fromEntries(entries));
      })
      .catch(() => {
        // stats are decorative — board still works without them
      });

    return () => {
      cancelled = true;
    };
  }, [projects, workspaceId]);

  const withStats: ProjectWithStats[] | null = useMemo(
    () =>
      projects?.map((p) => ({
        ...p,
        total: stats[p.id]?.total ?? 0,
        done: stats[p.id]?.done ?? 0,
      })) ?? null,
    [projects, stats],
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autoKey = useMemo(() => key || deriveKey(name), [key, name]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Project name is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api<{ id: string }>(`/workspaces/${workspaceId}/projects`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          key: autoKey,
          description: description.trim() || null,
        }),
      });
      setName("");
      setKey("");
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
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All workspaces
        </Link>

        {wsLoading ? (
          <Skeleton className="h-20" />
        ) : wsError || !workspace ? (
          <ErrorAlert message={wsError ?? "Workspace not found."} />
        ) : (
          <>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-3xl font-semibold tracking-tight">
                    {workspace.name}
                  </h1>
                  <Badge tone={workspace.role === "Member" ? "neutral" : "teal"}>
                    {workspace.role}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  /{workspace.slug}
                  {workspace.description && ` — ${workspace.description}`}
                </p>
              </div>
              {!creating && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  New project
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
                  <Field label="Name" htmlFor="proj-name">
                    <Input
                      id="proj-name"
                      placeholder="Website Ban Hang"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field label="Key" htmlFor="proj-key" hint={autoKey}>
                    <Input
                      id="proj-key"
                      placeholder="WBH"
                      value={key}
                      onChange={(event) =>
                        setKey(event.target.value.toUpperCase().slice(0, 5))
                      }
                    />
                  </Field>
                </div>
                <Field label="Description" htmlFor="proj-desc">
                  <Input
                    id="proj-desc"
                    placeholder="What does this project deliver?"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating…" : "Create project"}
                  </Button>
                  <Button variant="ghost" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {projLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-40" />
                ))}
              </div>
            ) : projError ? (
              <ErrorAlert message={projError} />
            ) : !withStats || withStats.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-8 py-16 text-center rise">
                <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FolderKanban className="size-6" aria-hidden />
                </span>
                <p className="font-display text-lg font-semibold">
                  No projects yet
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Projects hold your boards and tasks. Create the first one in
                  this workspace.
                </p>
                <Button className="mt-5" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  New project
                </Button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {withStats.map((project, index) => {
                  const percent =
                    project.total > 0
                      ? Math.round((project.done / project.total) * 100)
                      : 0;
                  return (
                    <li
                      key={project.id}
                      className="rise"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <Link
                        to={`/workspaces/${workspaceId}/projects/${project.id}`}
                        className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <Badge tone="teal">{project.key}</Badge>
                          <Badge
                            tone={project.status === "Active" ? "teal" : "neutral"}
                          >
                            {project.status}
                          </Badge>
                        </div>
                        <h2 className="font-display font-semibold">
                          {project.name}
                        </h2>
                        {project.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                        )}
                        <div className="mt-auto pt-4">
                          <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted-foreground">
                            <span>
                              {project.done}/{project.total} done
                            </span>
                            <span>{percent}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
