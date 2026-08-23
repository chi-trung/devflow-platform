import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitPullRequest } from "lucide-react";
import { getProjectPRs } from "../../lib/api";
import type { PullRequestResponse } from "../../types/api";

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

export function TaskPullRequests({ workspaceId, projectId, taskId }: TaskPullRequestsProps) {
  const { t } = useTranslation();
  const [prs, setPrs] = useState<PullRequestResponse[] | null>(null);

  useEffect(() => {
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
  }, [workspaceId, projectId, taskId]);

  if (prs !== null && prs.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <GitPullRequest className="size-4 text-muted-foreground" aria-hidden />
        {t("github.linkedPrs")}{" "}
        <span className="font-mono text-xs text-muted-foreground">({prs?.length ?? 0})</span>
      </h3>

      {!prs ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {prs.map((pr) => (
            <a
              key={pr.id}
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2 text-xs transition-colors duration-150 hover:border-primary"
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
          ))}
        </div>
      )}
    </section>
  );
}
