import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, GitPullRequest, Link2, Unlink } from "lucide-react";
import {
  getGitHubIntegration,
  getProjectPRs,
  linkGitHubRepo,
  unlinkGitHubRepo,
} from "../../lib/api";
import type {
  GitHubIntegrationResponse,
  PullRequestResponse,
} from "../../types/api";

const prStatusStyle: Record<string, string> = {
  Open: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  Merged: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  Closed: "bg-elevated text-muted-foreground",
};

interface GitHubCardProps {
  workspaceId: string;
  projectId: string;
}

export function GitHubIntegrationCard({ workspaceId, projectId }: GitHubCardProps) {
  const { t } = useTranslation();
  const [integration, setIntegration] = useState<GitHubIntegrationResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [prs, setPrs] = useState<PullRequestResponse[]>([]);
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [integration, pulls] = await Promise.all([
        getGitHubIntegration(workspaceId, projectId).catch(() => null),
        getProjectPRs(workspaceId, projectId).catch(() => []),
      ]);
      setIntegration(integration ?? null);
      setPrs(pulls);
    } catch {
      setError(t("github.loadFailed"));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId]);

  async function handleLink(event: FormEvent) {
    event.preventDefault();
    const url = repoUrl.trim();
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      await linkGitHubRepo(workspaceId, projectId, url);
      setRepoUrl("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("github.linkFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    setError(null);
    try {
      await unlinkGitHubRepo(workspaceId, projectId);
      setIntegration(null);
      setPrs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("github.unlinkFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="size-4 text-primary" aria-hidden />
        <h3 className="font-display text-sm font-semibold">{t("github.title")}</h3>
        {integration && (
          <button
            type="button"
            onClick={() => void handleUnlink()}
            disabled={busy}
            title={t("github.unlinkTitle")}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:border-destructive hover:text-destructive disabled:opacity-40"
          >
            <Unlink className="size-3" aria-hidden />
            {t("github.unlink")}
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      {!integration ? (
        <form onSubmit={handleLink} className="flex items-end gap-1.5">
          <input
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            placeholder="https://github.com/org/repo"
            aria-label={t("github.repoUrlLabel")}
            className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !repoUrl.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 hover:border-primary disabled:opacity-40"
          >
            <Link2 className="size-3.5" aria-hidden />
            {busy ? "…" : t("github.link")}
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <a
            href={integration.repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate rounded-md border border-border bg-card px-2 py-1.5 font-mono text-xs text-foreground transition-colors duration-150 hover:border-primary"
          >
            {integration.repositoryUrl}
          </a>

          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 pt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <GitPullRequest className="size-3" aria-hidden />
              {t("github.linkedPrs", { count: prs.length })}
            </p>
            {prs.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("github.emptyPrs")}</p>
            ) : (
              prs.slice(0, 6).map((pr) => (
                <a
                  key={pr.id}
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2 text-xs transition-colors duration-150 hover:border-border-strong"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                      prStatusStyle[pr.status] ?? prStatusStyle.Closed
                    }`}
                  >
                    {pr.status}
                  </span>
                  <span className="truncate font-medium">{pr.title}</span>
                  {pr.author && (
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                      {pr.author}
                    </span>
                  )}
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
