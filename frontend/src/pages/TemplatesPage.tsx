import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { ArrowLeft, Plus, Trash2, Play, Copy } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
  getTemplates,
} from "../lib/api";
import type { TemplateResponse } from "../types/api";

export function TemplatesPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TemplateResponse | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [estimateMinutes, setEstimateMinutes] = useState("");

  // The retry button is not disabled while a load is in flight, so two clicks
  // in a row put two loads in flight. Whichever response lands last wins, and
  // the loser can be an error for a retry the user already moved past. Only
  // the most recent load may write state.
  const loadGeneration = useRef(0);

  const loadTemplates = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getTemplates(workspaceId, projectId);
      if (generation !== loadGeneration.current) return;
      setTemplates(data);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      setError(err instanceof Error ? err.message : t("template.loadFailed"));
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function resetForm() {
    setName("");
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setEstimateMinutes("");
    setCreating(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !title.trim()) return;
    setSaving(true);
    try {
      await createTemplate(workspaceId, projectId, {
        name: name.trim(),
        title: title.trim(),
        description: description.trim() || null,
        priority,
        estimateMinutes: estimateMinutes ? Number(estimateMinutes) : null,
      });
      resetForm();
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("template.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleApply(templateId: string) {
    // One apply in flight — a double-click mints a second task from the
    // same template before setState re-renders the disabled button.
    if (applyingId) return;
    setApplyingId(templateId);
    try {
      await applyTemplate(workspaceId, projectId, templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("template.applyFailed"));
    } finally {
      setApplyingId(null);
    }
  }

  async function handleDelete() {
    const template = pendingDelete;
    // Close the dialog first: on failure the page error banner renders
    // behind the open overlay and is never seen. Guard against a second
    // confirm click landing before the unmount — that DELETE 404s as a
    // "delete failed" right after the row already went away.
    if (!template || deleting) return;
    setDeleting(true);
    setPendingDelete(null);
    try {
      await deleteTemplate(workspaceId, projectId, template.id);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("template.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  const priorityColors: Record<string, string> = {
    Critical: "text-destructive",
    High: "text-orange-500",
    Medium: "text-yellow-600",
    Low: "text-green-600",
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("template.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("template.emptyDescription")}
              </p>
            </div>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                {t("template.create")}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ErrorAlert id="templates-load-error" message={error} />
            <Button variant="outline" size="sm" onClick={loadTemplates}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {creating && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="mb-4 font-display text-lg font-semibold">
              {t("template.createTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="templatespage-name" className="mb-1 block text-sm font-medium">
                  {t("template.name")}
                </label>
                <input id="templatespage-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("template.namePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="templatespage-titleLabel" className="mb-1 block text-sm font-medium">
                  {t("template.titleLabel")}
                </label>
                <input id="templatespage-titleLabel"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("template.titlePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="templatespage-descriptionLabel" className="mb-1 block text-sm font-medium">
                  {t("template.descriptionLabel")}
                </label>
                <textarea id="templatespage-descriptionLabel"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("template.descriptionPlaceholder")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="templatespage-priorityLabel" className="mb-1 block text-sm font-medium">
                  {t("template.priorityLabel")}
                </label>
                <select id="templatespage-priorityLabel"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="Critical">{t("task.critical")}</option>
                  <option value="High">{t("task.high")}</option>
                  <option value="Medium">{t("task.medium")}</option>
                  <option value="Low">{t("task.low")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="templatespage-estimateLabel" className="mb-1 block text-sm font-medium">
                  {t("template.estimateLabel")}
                </label>
                <input id="templatespage-estimateLabel"
                  type="number"
                  value={estimateMinutes}
                  onChange={(e) => setEstimateMinutes(e.target.value)}
                  placeholder={t("template.estimatePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={saving || !name.trim() || !title.trim()}>
                {saving ? t("common.saving") : t("common.create")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                disabled={saving}
              >
                {t("common.cancel")}
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
        ) : templates.length === 0 && !error ? (
          <EmptyState
            icon={<Copy className="size-8 text-muted-foreground" aria-hidden />}
            title={t("template.emptyTitle")}
            description={t("template.emptyDescription")}
            action={
              !creating && (
                <Button className="mt-2" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("template.create")}
                </Button>
              )
            }
          />
        ) : (
          <ul role="list" className="flex flex-col gap-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong"
              >
                <Copy className="size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{template.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {template.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {template.priority && (
                      <span className={priorityColors[template.priority] ?? ""}>
                        {template.priority}
                      </span>
                    )}
                    {template.estimateMinutes != null && (
                      <span>{template.estimateMinutes} min</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 transition-opacity duration-150 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleApply(template.id)}
                    disabled={applyingId !== null}
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-50"
                    title={t("template.apply")}
                    aria-label={t("template.apply")}
                  >
                    <Play className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(template)}
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                    title={t("template.delete")}
                    aria-label={t("template.delete")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pendingDelete && (
          <ConfirmDialog
            title={t("template.deleteTitle")}
            message={t("template.deleteMessage", { name: pendingDelete.name })}
            confirmLabel={t("template.deleteConfirm")}
            onConfirm={handleDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
