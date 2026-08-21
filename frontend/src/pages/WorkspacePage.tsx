import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import type { ProjectResponse, WorkspaceResponse } from "../types/api";

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
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All workspaces
        </Link>

        {wsLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : wsError || !workspace ? (
          <ErrorAlert message={wsError ?? "Workspace not found."} />
        ) : (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">{workspace.name}</h1>
                <p className="font-mono text-xs text-muted-foreground">
                  /{workspace.slug}
                  {workspace.description && ` — ${workspace.description}`}
                </p>
              </div>
              {!creating && (
                <Button variant="accent" onClick={() => setCreating(true)}>
                  New project
                </Button>
              )}
            </div>

            {creating && (
              <form
                onSubmit={handleCreate}
                className="mb-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
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
                    {submitting ? "Creating…" : "Create"}
                  </Button>
                  <Button variant="outline" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {projLoading ? (
              <p className="text-muted-foreground">Loading projects…</p>
            ) : projError ? (
              <ErrorAlert message={projError} />
            ) : !projects || projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
                <p className="font-medium">No projects yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a project to start tracking tasks.
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      to={`/workspaces/${workspaceId}/projects/${project.id}`}
                      className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors duration-150 hover:border-primary"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge tone="teal">{project.key}</Badge>
                        <Badge
                          tone={
                            project.status === "Active" ? "teal" : "neutral"
                          }
                        >
                          {project.status}
                        </Badge>
                      </div>
                      <h2 className="flex items-center gap-2 font-semibold">
                        <FolderKanban
                          className="size-4 text-primary"
                          aria-hidden
                        />
                        {project.name}
                      </h2>
                      {project.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {project.description}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
