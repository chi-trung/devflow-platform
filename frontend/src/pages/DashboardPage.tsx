import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { ErrorAlert } from "../components/ui/ErrorAlert";
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
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Workspaces</h1>
            <p className="text-sm text-muted-foreground">
              Pick a workspace to see its projects.
            </p>
          </div>
          {!creating && (
            <Button variant="accent" onClick={() => setCreating(true)}>
              New workspace
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
            <Field label="Name" htmlFor="ws-name" hint="A short URL slug is generated automatically.">
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
                {submitting ? "Creating…" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading workspaces…</p>
        ) : error ? (
          <ErrorAlert message={error} />
        ) : !workspaces || workspaces.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
            <p className="font-medium">No workspaces yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first workspace to start organizing projects.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  to={`/workspaces/${workspace.id}`}
                  className="block rounded-lg border border-border bg-card p-5 transition-colors duration-150 hover:border-primary"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{workspace.name}</h2>
                    <Badge tone={workspace.role === "Member" ? "neutral" : "teal"}>
                      {workspace.role}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    /{workspace.slug}
                  </p>
                  {workspace.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {workspace.description}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
