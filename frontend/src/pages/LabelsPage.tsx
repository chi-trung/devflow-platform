import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { ArrowLeft, Plus, Trash2, Palette } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { createLabel, deleteLabel, getLabels } from "../lib/api";
import type { LabelResponse } from "../types/api";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#10b981", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#d946ef", "#f43f5e", "#6b7280",
];

export function LabelsPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [labels, setLabels] = useState<LabelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LabelResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  // The retry button is not disabled while a load is in flight, so two clicks
  // in a row put two loads in flight. Whichever response lands last wins, and
  // the loser can be an error for a retry the user already moved past. Only
  // the most recent load may write state.
  const loadGeneration = useRef(0);

  const loadLabels = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getLabels(workspaceId, projectId);
      if (generation !== loadGeneration.current) return;
      setLabels(data);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      setError(err instanceof Error ? err.message : t("label.loadFailed"));
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  function resetForm() {
    setName("");
    setColor(PRESET_COLORS[0]);
    setCreating(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createLabel(workspaceId, projectId, {
        name: name.trim(),
        color,
      });
      resetForm();
      loadLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("label.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const label = pendingDelete;
    if (!label) return;
    // Close the dialog first: on failure the page error banner renders
    // behind the open overlay and is never seen. BoardPage and GitHubPage
    // already confirm-then-close; match them so the retry banner is reachable.
    setPendingDelete(null);
    try {
      await deleteLabel(workspaceId, projectId, label.id);
      loadLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("label.deleteFailed"));
    }
  }

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
                {t("label.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("label.description")}
              </p>
            </div>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                {t("label.create")}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ErrorAlert id="labels-load-error" message={error} />
            <Button variant="outline" size="sm" onClick={loadLabels}>
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
              {t("label.createTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="labelspage-nameLabel" className="mb-1 block text-sm font-medium">
                  {t("label.nameLabel")}
                </label>
                <input id="labelspage-nameLabel"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("label.namePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="label-color-custom"
                  className="mb-1 block text-sm font-medium"
                >
                  {t("label.colorLabel")}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      aria-label={preset}
                      aria-pressed={color === preset}
                      className={`size-7 rounded-full border-2 transition-all duration-150 ${
                        color === preset
                          ? "border-foreground scale-110 ring-2 ring-foreground/35 ring-offset-2 ring-offset-card"
                          : "border-[var(--label-swatch-ring)] hover:scale-105"
                      }`}
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Palette className="size-4 text-muted-foreground" aria-hidden />
                  <input
                    id="label-color-custom"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-8 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {color}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={saving || !name.trim()}>
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
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : labels.length === 0 && !error ? (
          <EmptyState
            icon={<Palette className="size-8 text-muted-foreground" aria-hidden />}
            title={t("label.emptyTitle")}
            description={t("label.emptyDescription")}
            action={
              !creating && (
                <Button className="mt-2" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("label.create")}
                </Button>
              )
            }
          />
        ) : (
          <ul role="list" className="flex flex-col gap-2">
            {labels.map((label) => (
              <li
                key={label.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong"
              >
                <span
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                  aria-hidden
                />
                <span className="flex-1 truncate text-sm font-medium">
                  {label.name}
                </span>
                {/* Touch devices have no hover, so the delete control would
                    stay invisible there. Show it on coarse pointers and keep
                    the hover reveal on fine pointers. Focus keeps it visible
                    in both cases for keyboard users. */}
                <div className="flex shrink-0 items-center gap-1 transition-opacity duration-150 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setPendingDelete(label)}
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                    title={t("label.delete")}
                    aria-label={t("label.delete")}
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
            title={t("label.deleteTitle")}
            message={t("label.deleteMessage", { name: pendingDelete.name })}
            confirmLabel={t("label.deleteConfirm")}
            onConfirm={handleDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
