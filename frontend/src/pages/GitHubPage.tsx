import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { ArrowLeft, Link2, Unlink, Trash2, ExternalLink, Github } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { GitHubSettingsSection } from "../components/settings/GitHubSettingsSection";
import {
  addPR,
  deletePR,
  getGitHubIntegration,
  linkGitHubRepo,
  unlinkGitHubRepo,
  getProjectPRs,
} from "../lib/api";
import type { GitHubIntegrationResponse, PullRequestResponse } from "../types/api";

export function GitHubPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [integration, setIntegration] = useState<GitHubIntegrationResponse | null>(null);
  const [prs, setPrs] = useState<PullRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [addingPr, setAddingPr] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState(false);
  const [pendingDeletePr, setPendingDeletePr] = useState<PullRequestResponse | null>(null);
  // ConfirmDialog has no busy prop; without this a double-click on either
  // destructive confirm fires the mutation twice.
  const [mutating, setMutating] = useState(false);

  const [repoUrl, setRepoUrl] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [prStatus, setPrStatus] = useState("open");
  const [prAuthor, setPrAuthor] = useState("");
  // The old Promise.all was all-or-nothing: a PR-list failure left
  // `integration` at its null initial, so the page showed the "link a
  // repository" form for a project that IS linked — and its submit POSTs
  // linkGitHubRepo over the real binding. Track each half separately.
  const [integrationUnknown, setIntegrationUnknown] = useState(false);
  const [prsFailed, setPrsFailed] = useState(false);

  // Neither retry button is disabled while a load is in flight, so two clicks
  // put two loads in flight; whichever settles last wins, and the loser can be
  // an error for a retry that already succeeded. Only the most recent load may
  // write state.
  const loadGeneration = useRef(0);

  const loadData = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    const [integrationResult, prsResult] = await Promise.allSettled([
      getGitHubIntegration(workspaceId, projectId),
      getProjectPRs(workspaceId, projectId),
    ]);
    if (generation !== loadGeneration.current) return;
    if (integrationResult.status === "fulfilled") {
      setIntegration(integrationResult.value);
      setIntegrationUnknown(false);
    } else {
      setIntegrationUnknown(true);
      setError(integrationResult.reason instanceof Error ? integrationResult.reason.message : t("github.loadFailed"));
    }
    if (prsResult.status === "fulfilled") {
      setPrs(prsResult.value);
      setPrsFailed(false);
    } else {
      setPrsFailed(true);
    }
    setLoading(false);
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLink(event: React.FormEvent) {
    event.preventDefault();
    if (!repoUrl.trim()) return;
    setLinking(true);
    try {
      await linkGitHubRepo(workspaceId, projectId, repoUrl.trim());
      setRepoUrl("");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("github.linkFailed"));
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    if (mutating) return;
    setMutating(true);
    setLinking(true);
    try {
      await unlinkGitHubRepo(workspaceId, projectId);
      setPendingUnlink(false);
      loadData();
    } catch (err) {
      // Close the dialog so the page error banner is actually visible —
      // it renders behind the open overlay otherwise.
      setPendingUnlink(false);
      setError(err instanceof Error ? err.message : t("github.unlinkFailed"));
    } finally {
      setLinking(false);
      setMutating(false);
    }
  }

  async function handleAddPr(event: React.FormEvent) {
    event.preventDefault();
    if (!prTitle.trim() || !prUrl.trim()) return;
    setAddingPr(true);
    try {
      await addPR(workspaceId, projectId, {
        title: prTitle.trim(),
        url: prUrl.trim(),
        status: prStatus,
        author: prAuthor.trim() || undefined,
      });
      setPrTitle("");
      setPrUrl("");
      setPrStatus("open");
      setPrAuthor("");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("github.addPrFailed"));
    } finally {
      setAddingPr(false);
    }
  }

  async function handleDeletePr() {
    const pr = pendingDeletePr;
    if (!pr || mutating) return;
    setMutating(true);
    try {
      // Row-scoped delete. This used to call unlinkGitHubRepo, which drops
      // the entire integration (repo binding + every PR) for one row's
      // delete click.
      await deletePR(workspaceId, projectId, pr.id);
      setPendingDeletePr(null);
      loadData();
    } catch (err) {
      // Close the dialog so the error banner is reachable (it renders
      // behind the open overlay otherwise).
      setPendingDeletePr(null);
      setError(err instanceof Error ? err.message : t("github.deletePrFailed"));
    } finally {
      setMutating(false);
    }
  }

  // Rows are canonicalized to "Open"/"Merged"/"Closed" by the backend
  // entity; lowercase keys kept as fallback for legacy rows cached or
  // stored before the normalization shipped (case-sensitive lookup else
  // silently drops the color).
  const statusColors: Record<string, string> = {
    Open: "text-green-600",
    Merged: "text-purple-600",
    Closed: "text-red-600",
    open: "text-green-600",
    merged: "text-purple-600",
    closed: "text-red-600",
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to={`/workspaces/${workspaceId}/projects/${projectId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="flex items-center gap-2">
            <Github className="size-6" aria-hidden />
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {t("github.title")}
            </h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("github.description")}
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} />
          </div>
        )}

        {!integration ? (
          integrationUnknown ? (
            // "Unknown" is not "not linked": offering the link form here
            // lets a submit overwrite a binding the server still holds.
            <div className="mb-6 rounded-xl border border-border bg-card p-5">
              <ErrorAlert message={t("github.integrationUnknown")} />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void loadData()}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : (
          <form
            onSubmit={handleLink}
            className="mb-6 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="mb-4 font-display text-lg font-semibold">
              {t("github.linkTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="githubpage-repoUrlLabel" className="mb-1 block text-sm font-medium">
                  {t("github.repoUrlLabel")}
                </label>
                <input id="githubpage-repoUrlLabel"
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={linking || !repoUrl.trim()}>
                {linking ? t("github.linking") : t("github.link")}
              </Button>
            </div>
          </form>
          )
        ) : (
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  {t("github.linkedRepo")}
                </h2>
                <a
                  href={integration.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {integration.repositoryUrl}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
              <Button
                variant="outline"
                onClick={() => setPendingUnlink(true)}
                disabled={linking}
              >
                <Unlink className="size-4" aria-hidden />
                {t("github.unlink")}
              </Button>
            </div>
          </div>
        )}

        {integration && (
          <form
            onSubmit={handleAddPr}
            className="mb-6 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="mb-4 font-display text-lg font-semibold">
              {t("github.addPrTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="githubpage-prTitleLabel" className="mb-1 block text-sm font-medium">
                  {t("github.prTitleLabel")}
                </label>
                <input id="githubpage-prTitleLabel"
                  type="text"
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  placeholder={t("github.prTitlePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="githubpage-prUrlLabel" className="mb-1 block text-sm font-medium">
                  {t("github.prUrlLabel")}
                </label>
                <input id="githubpage-prUrlLabel"
                  type="url"
                  value={prUrl}
                  onChange={(e) => setPrUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo/pull/1"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="githubpage-prStatusLabel" className="mb-1 block text-sm font-medium">
                  {t("github.prStatusLabel")}
                </label>
                <select id="githubpage-prStatusLabel"
                  value={prStatus}
                  onChange={(e) => setPrStatus(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="open">{t("filter.prOpen")}</option>
                  <option value="closed">{t("filter.prClosed")}</option>
                  <option value="merged">{t("filter.prMerged")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="githubpage-prAuthorLabel" className="mb-1 block text-sm font-medium">
                  {t("github.prAuthorLabel")}
                </label>
                <input id="githubpage-prAuthorLabel"
                  type="text"
                  value={prAuthor}
                  onChange={(e) => setPrAuthor(e.target.value)}
                  placeholder={t("github.prAuthorPlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={addingPr || !prTitle.trim() || !prUrl.trim()}>
                {addingPr ? t("github.addingPr") : t("github.addPr")}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : prsFailed ? (
          <div className="flex flex-col items-start gap-2">
            <ErrorAlert message={t("github.loadPrsFailed")} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : prs.length === 0 ? (
          <EmptyState
            icon={<Github className="size-8 text-muted-foreground" aria-hidden />}
            title={t("github.emptyPrs")}
            description={t("github.emptyPrsDescription")}
          />
        ) : (
          <ul role="list" className="flex flex-col gap-2">
            {prs.map((pr) => (
              <li
                key={pr.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong"
              >
                <Link2 className="size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{pr.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={statusColors[pr.status] ?? ""}>{pr.status}</span>
                    {pr.author && <span>by {pr.author}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 transition-opacity duration-150 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    title={t("github.viewPr")}
                    aria-label={t("github.viewPr")}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPendingDeletePr(pr)}
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                    title={t("github.deletePr")}
                    aria-label={t("github.deletePr")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pendingUnlink && (
          <ConfirmDialog
            title={t("github.unlinkTitle")}
            message={t("github.unlinkMessage")}
            confirmLabel={t("github.unlinkConfirm")}
            onConfirm={handleUnlink}
            onCancel={() => setPendingUnlink(false)}
          />
        )}

        {pendingDeletePr && (
          <ConfirmDialog
            title={t("github.deletePrTitle")}
            message={t("github.deletePrMessage", { title: pendingDeletePr.title })}
            confirmLabel={t("github.deletePrConfirm")}
            onConfirm={handleDeletePr}
            onCancel={() => setPendingDeletePr(null)}
          />
        )}

        <GitHubSettingsSection workspaceId={workspaceId} projectId={projectId} />
      </div>
    </AppShell>
  );
}
