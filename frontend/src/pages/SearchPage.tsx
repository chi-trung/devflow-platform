import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Search, FileText, FolderOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { searchWorkspace } from "../lib/api";
import type { SearchResponse } from "../types/api";

export function SearchPage() {
  const { t } = useTranslation();
  const { workspaceId = "" } = useParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await searchWorkspace(workspaceId, query.trim(), {
        status: status || undefined,
        priority: priority || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("search.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to={`/workspaces/${workspaceId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="flex items-center gap-2">
            <Search className="size-5 text-muted-foreground" aria-hidden />
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("search.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("search.description")}
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

        <form onSubmit={handleSearch} className="mb-6 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className="sm:col-span-2"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{t("search.allStatuses")}</option>
              <option value="Backlog">Backlog</option>
              <option value="InProgress">In Progress</option>
              <option value="InReview">In Review</option>
              <option value="Done">Done</option>
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{t("search.allPriorities")}</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <Button type="submit" disabled={loading}>
            <Search className="size-4" aria-hidden />
            {loading ? t("search.searching") : t("search.search")}
          </Button>
        </form>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !searched ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <Search className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-2 font-display text-lg font-semibold">
              {t("search.emptyTitle")}
            </p>
            <p className="max-w-sm mx-auto mt-1 text-sm text-muted-foreground">
              {t("search.emptyDescription")}
            </p>
          </div>
        ) : result === null ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {error || t("search.loadFailed")}
          </div>
        ) : (
          <div className="space-y-6">
            {result.tasks.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-lg font-semibold">
                  {t("search.tasksTitle", { count: result.tasks.length })}
                </h2>
                <ul className="flex flex-col gap-2">
                  {result.tasks.map((task) => (
                    <SearchTaskRow key={task.id} task={task} workspaceId={workspaceId} />
                  ))}
                </ul>
              </section>
            )}

            {result.projects.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-lg font-semibold">
                  {t("search.projectsTitle", { count: result.projects.length })}
                </h2>
                <ul className="flex flex-col gap-2">
                  {result.projects.map((project) => (
                    <SearchProjectRow key={project.id} project={project} workspaceId={workspaceId} />
                  ))}
                </ul>
              </section>
            )}

            {result.tasks.length === 0 && result.projects.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
                <p className="font-display text-lg font-semibold">
                  {t("search.noResults")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("search.noResultsDescription")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SearchTaskRow({ task, workspaceId }: { task: SearchResponse["tasks"][0]; workspaceId: string }) {
  return (
    <li className="rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong">
      <Link
        to={`/workspaces/${workspaceId}/projects/${task.projectKey.toLowerCase()}`}
        className="flex items-center gap-3"
      >
        <FileText className="size-4 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{task.title}</p>
          <p className="text-xs text-muted-foreground">
            {task.projectKey} · {task.status}
          </p>
        </div>
      </Link>
    </li>
  );
}

function SearchProjectRow({ project, workspaceId }: { project: SearchResponse["projects"][0]; workspaceId: string }) {
  return (
    <li className="rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong">
      <Link
        to={`/workspaces/${workspaceId}/projects/${project.key.toLowerCase()}`}
        className="flex items-center gap-3"
      >
        <FolderOpen className="size-4 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            {project.key} · {project.status}
          </p>
        </div>
      </Link>
    </li>
  );
}
