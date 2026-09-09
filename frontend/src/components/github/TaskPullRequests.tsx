import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, GitBranch, GitPullRequest, Loader2, PlusCircle } from "lucide-react";
import { createTaskPullRequest, getGitHubIntegration, getProjectPRs } from "../../lib/api";
import type { PullRequestResponse } from "../../types/api";
import { useToast } from "../ui/ToastProvider";

const prStatusStyle: Record<string, string> = {
  Open: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  Merged: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  Closed: "bg-elevated text-muted-foreground",
};

interface TaskPullRequestsProps {
  workspaceId: string;
  projectId: string;
  taskId: string;
}

/** Best-effort branch name from the stored head branch or the PR URL (…/pull/42). */
function deriveBranch(pr: PullRequestResponse): string | null {
  if (pr.headBranch) return pr.headBranch;
  const pullMatch = pr.url.match(/pull\/(\d+)/i);
  if (pullMatch) return `branch-${pullMatch[1]}`;
  const slug = pr.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || null;
}

export function TaskPullRequests({ workspaceId, projectId, taskId }: TaskPullRequestsProps) {
  const { t } = useTranslation();
  const { push } = useToast();
  const [prs, setPrs] = useState<PullRequestResponse[] | null>(null);
  const [repoLinked, setRepoLinked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function reload() {
    let cancelled = false;
    getProjectPRs(workspaceId, projectId)
      .then((all) => {
        if (!cancelled) {
          setPrs(all.filter((pr) => pr.linkedTaskId === taskId));
        }
      })
      .catch(() => {
        if (!cancelled) setPrs([]);
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(reload, [workspaceId, projectId, taskId]);

  // The create button only makes sense when a repo is linked for this project.
  useEffect(() => {
    let cancelled = false;
    getGitHubIntegration(workspaceId, projectId)
      .then((integration) => {
        if (!cancelled && integration?.isActive) setRepoLinked(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      await createTaskPullRequest(workspaceId, projectId, taskId);
      push(t("github.branchPrCreated"), "success");
      reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t("github.createBranchPrFailed"));
    } finally {
      setCreating(false);
    }
  }

  if (prs !== null && prs.length === 0 && !repoLinked) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <GitPullRequest className="size-4 text-muted-foreground" aria-hidden />
          {t("github.linkedPrs")}{" "}
          <span className="font-mono text-xs text-muted-foreground">({prs?.length ?? 0})</span>
        </h3>
        {repoLinked && (
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <PlusCircle className="size-3.5" aria-hidden />
            )}
            {creating ? t("github.creatingBranchPr") : t("github.createBranchPr")}
          </button>
        )}
      </div>

      {createError && <p className="text-xs text-destructive">{createError}</p>}

      {!prs ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          {t("common.loading")}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {prs.map((pr) => {
            const branch = deriveBranch(pr);
            return (
              <div
                key={pr.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2 text-xs transition-colors duration-150 hover:border-primary"
              >
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                    prStatusStyle[pr.status] ?? prStatusStyle.Closed
                  }`}
                >
                  {pr.status}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pr.title}</p>
                  {branch && (
                    <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-muted-foreground">
                      <GitBranch className="size-3 shrink-0" aria-hidden />
                      {branch}
                    </p>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    {pr.author && <span>by {pr.author}</span>}
                    <span>CI: —</span>
                  </div>
                </div>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("github.viewPr")}
                  title={t("github.viewPr")}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-primary"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
