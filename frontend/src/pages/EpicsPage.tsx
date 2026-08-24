import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, List, Flag } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EpicRoadmap } from "../components/epic/EpicRoadmap";
import {
  createEpic,
  deleteEpic,
  getEpics,
  updateEpic,
} from "../lib/api";
import type { EpicResponse, CreateEpicRequest, UpdateEpicRequest } from "../types/api";

type ViewMode = "list" | "roadmap";

export function EpicsPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [epics, setEpics] = useState<EpicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EpicResponse | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EpicResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("list");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadEpics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEpics(workspaceId, projectId);
      setEpics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("epic.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadEpics();
  }, [loadEpics]);

  function resetForm() {
    setName("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setEditing(null);
    setCreating(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload: CreateEpicRequest | UpdateEpicRequest = {
        name: name.trim(),
        description: description.trim() || null,
        startDateUtc: startDate || null,
        endDateUtc: endDate || null,
      };

      if (editing) {
        await updateEpic(workspaceId, projectId, editing.id, payload);
      } else {
        await createEpic(workspaceId, projectId, payload as CreateEpicRequest);
      }
      resetForm();
      loadEpics();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("epic.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(epic: EpicResponse) {
    setEditing(epic);
    setName(epic.name);
    setDescription(epic.description ?? "");
    setStartDate(epic.startDateUtc ?? "");
    setEndDate(epic.endDateUtc ?? "");
    setCreating(true);
  }

  async function handleDelete() {
    const epic = pendingDelete;
    if (!epic) return;
    try {
      await deleteEpic(workspaceId, projectId, epic.id);
      setPendingDelete(null);
      loadEpics();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("epic.deleteFailed"));
    }
  }

  const formatDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
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
                  {t("epic.title")}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("epic.description")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                      view === "list"
                        ? "bg-elevated font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <List className="size-3.5" aria-hidden />
                    {t("epic.listView")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("roadmap")}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                      view === "roadmap"
                        ? "bg-elevated font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Flag className="size-3.5" aria-hidden />
                    {t("epic.roadmapView")}
                  </button>
                </div>
                {!creating && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden />
                    {t("epic.create")}
                  </Button>
                )}
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

        {creating && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="mb-4 font-display text-lg font-semibold">
              {editing ? t("epic.edit") : t("epic.createTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("epic.nameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("epic.namePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("epic.descriptionLabel")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("epic.descriptionPlaceholder")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("epic.startDate")}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("epic.endDate")}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? t("common.saving") : editing ? t("common.save") : t("common.create")}
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
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : epics.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold">
              {t("epic.emptyTitle")}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("epic.emptyDescription")}
            </p>
            {!creating && (
              <Button
                className="mt-2"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" aria-hidden />
                {t("epic.create")}
              </Button>
            )}
          </div>
        ) : view === "roadmap" ? (
          <EpicRoadmap epics={epics} onSelect={handleEdit} />
        ) : (
          <ul className="flex flex-col gap-3">
            {epics.map((epic) => {
              const start = formatDate(epic.startDateUtc);
              const end = formatDate(epic.endDateUtc);
              const dateLabel =
                start && end
                  ? `${start} – ${end}`
                  : start ?? end ?? null;

              return (
                <li
                  key={epic.id}
                  className="group rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <GripVertical
                          className="size-4 text-muted-foreground"
                          aria-hidden
                        />
                        <h3 className="truncate text-sm font-semibold">
                          {epic.name}
                        </h3>
                      </div>
                      {epic.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {epic.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {dateLabel && (
                          <span className="inline-flex items-center gap-1">
                            {dateLabel}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          {epic.completedTasks}/{epic.totalTasks} {t("epic.tasks")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {epic.completedStoryPoints}/{epic.totalStoryPoints} {t("epic.storyPoints")}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, epic.completionPercent))}%`,
                            }}
                          />
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                          epic.completionPercent >= 100
                            ? "bg-teal-400/10 text-teal-600 dark:text-teal-300"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {t("epic.completionBadge", { pct: Math.round(epic.completionPercent) })}
                        </span>
                        {epic.endDateUtc && (() => {
                          const now = new Date();
                          const end = new Date(epic.endDateUtc);
                          const diffDays = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
                          if (diffDays < 0) {
                            return (
                              <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-destructive">
                                {t("epic.overdue")}
                              </span>
                            );
                          }
                          if (diffDays <= 7) {
                            return (
                              <span className="shrink-0 rounded-full bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                                {t("epic.dueSoon")}
                              </span>
                            );
                          }
                          return (
                            <span className="shrink-0 rounded-full bg-teal-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-teal-600 dark:text-teal-300">
                              {t("epic.onTrack")}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleEdit(epic)}
                        className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                        title={t("epic.edit")}
                        aria-label={t("epic.edit")}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(epic)}
                        className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                        title={t("epic.delete")}
                        aria-label={t("epic.delete")}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pendingDelete && (
          <ConfirmDialog
            title={t("epic.deleteTitle")}
            message={t("epic.deleteMessage", { name: pendingDelete.name })}
            confirmLabel={t("epic.deleteConfirm")}
            onConfirm={handleDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
