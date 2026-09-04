import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Pencil, Trash2, Flag, List, Link2, X, Zap } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { useToast } from "../components/ui/ToastProvider";
import { EpicRoadmap } from "../components/epic/EpicRoadmap";
import {
  api,
  addEpicDependency,
  createEpic,
  deleteEpic,
  getEpicDependencies,
  getEpics,
  getMilestones,
  removeEpicDependency,
  updateEpic,
} from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import type { EpicResponse, CreateEpicRequest, UpdateEpicRequest, MilestoneResponse, WorkspaceMemberResponse } from "../types/api";

type ViewMode = "list" | "roadmap";

export function EpicsPage() {
  const { t } = useTranslation();
  const { push } = useToast();
  const navigate = useNavigate();
  const { workspaceId = "", projectId = "" } = useParams();
  const [epics, setEpics] = useState<EpicResponse[]>([]);
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EpicResponse | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EpicResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("list");

  // Epic dependency state: selected epic under inspection + picker
  const [dependencyEpicId, setDependencyEpicId] = useState<string | null>(null);
  const [blockedByIds, setBlockedByIds] = useState<string[]>([]);
  const [depsLoading, setDepsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingBlockerId, setPendingBlockerId] = useState("");
  const [addingBlocker, setAddingBlocker] = useState(false);
  const [removingBlockerId, setRemovingBlockerId] = useState<string | null>(null);

  const { currentUser } = useAuth();
  const { data: members = [] } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
  );

  const myRole = (members ?? []).find((m) => m.userId === currentUser?.id)?.role;
  const isAdmin = myRole === "Owner" || myRole === "Admin";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadEpics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, milestoneData] = await Promise.all([
        getEpics(workspaceId, projectId),
        getMilestones(workspaceId, projectId),
      ]);
      setEpics(data);
      setMilestones(milestoneData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("epic.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadEpics();
  }, [loadEpics]);

  // Load the selected epic's dependencies (blockers) from the backend.
  useEffect(() => {
    if (!dependencyEpicId) return;
    let cancelled = false;
    setDepsLoading(true);
    setPickerOpen(false);
    setPendingBlockerId("");
    getEpicDependencies(workspaceId, projectId, dependencyEpicId)
      .then((deps) => {
        if (!cancelled) setBlockedByIds(deps.map((d) => d.blockedByEpicId));
      })
      .catch(() => {
        if (!cancelled) setBlockedByIds([]);
      })
      .finally(() => {
        if (!cancelled) setDepsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, dependencyEpicId]);

  async function handleAddBlocker() {
    if (!dependencyEpicId || !pendingBlockerId) return;
    setAddingBlocker(true);
    try {
      await addEpicDependency(workspaceId, projectId, dependencyEpicId, pendingBlockerId);
      setBlockedByIds((current) =>
        current.includes(pendingBlockerId) ? current : [...current, pendingBlockerId],
      );
      setPickerOpen(false);
      setPendingBlockerId("");
      push(t("epic.blockerAdded"));
    } catch {
      push(t("epic.blockerAddFailed"), "error");
    } finally {
      setAddingBlocker(false);
    }
  }

  async function handleRemoveBlocker(blockedByEpicId: string) {
    if (!dependencyEpicId) return;
    setRemovingBlockerId(blockedByEpicId);
    try {
      await removeEpicDependency(workspaceId, projectId, dependencyEpicId, blockedByEpicId);
      setBlockedByIds((current) => current.filter((id) => id !== blockedByEpicId));
      push(t("epic.blockerRemoved"));
    } catch {
      push(t("epic.blockerRemoveFailed"), "error");
    } finally {
      setRemovingBlockerId(null);
    }
  }

  const blockedByEpics = epics.filter((epic) => blockedByIds.includes(epic.id));
  const blockerCandidates = epics.filter(
    (epic) =>
      epic.id !== dependencyEpicId && !blockedByIds.includes(epic.id),
  );

  function resetForm() {
    setName("");
    setDescription("");
    setMilestoneId("");
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
        milestoneId: milestoneId || null,
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
    setMilestoneId(epic.milestoneId ?? "");
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
            <ErrorAlert message={error} />
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
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("epic.milestoneLabel")}
                </label>
                <select
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">{t("epic.milestoneNone")}</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
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
          <EmptyState
            icon={<Flag className="size-8 text-muted-foreground" aria-hidden />}
            title={t("epic.emptyTitle")}
            description={t("epic.emptyDescription")}
            action={
              !creating && (
                <Button className="mt-2" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("epic.create")}
                </Button>
              )
            }
          />
        ) : view === "roadmap" ? (
          <EpicRoadmap
            epics={epics}
            milestones={milestones}
            onSelect={handleEdit}
            onMilestoneSelect={() =>
              navigate(`/workspaces/${workspaceId}/projects/${projectId}/milestones`)
            }
          />
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
                  className="group rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Zap className="size-3.5" aria-hidden />
                        </span>
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
                        {(epic.blockedByEpicIds?.length ?? 0) > 0 && (
                          <Badge tone="red">
                            <Link2 className="size-3" aria-hidden />
                            {t("epic.blockedBadge")}
                          </Badge>
                        )}
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
                        onClick={() => setDependencyEpicId((current) => current === epic.id ? null : epic.id)}
                        className={`rounded p-1.5 transition-colors duration-150 ${
                          dependencyEpicId === epic.id
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title={t("epic.blockedBy")}
                        aria-label={t("epic.blockedBy")}
                      >
                        <Link2 className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(epic)}
                        className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                        title={t("epic.edit")}
                        aria-label={t("epic.edit")}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(epic)}
                          className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                          title={t("epic.delete")}
                          aria-label={t("epic.delete")}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>

                  {dependencyEpicId === epic.id && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h4 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <Link2 className="size-3.5" aria-hidden />
                          {t("epic.blockedBy")}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setDependencyEpicId(null)}
                          className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                          title={t("common.cancel")}
                          aria-label={t("common.cancel")}
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </div>

                      {depsLoading ? (
                        <Skeleton className="h-12 w-full" />
                      ) : blockedByEpics.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border bg-card/40 px-3 py-2.5 text-sm text-muted-foreground">
                          {t("epic.noBlockers")}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {blockedByEpics.map((blocker) => (
                            <li
                              key={blocker.id}
                              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                            >
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {blocker.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleRemoveBlocker(blocker.id)}
                                disabled={removingBlockerId === blocker.id}
                                className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-destructive disabled:opacity-50"
                                title={t("epic.removeBlocker")}
                                aria-label={t("epic.removeBlocker")}
                              >
                                <X className="size-4" aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {isAdmin && !pickerOpen && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setPickerOpen(true)}
                        >
                          <Plus className="size-3.5" aria-hidden />
                          {t("epic.addBlocker")}
                        </Button>
                      )}

                      {isAdmin && pickerOpen && (
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={pendingBlockerId}
                            onChange={(event) => setPendingBlockerId(event.target.value)}
                            aria-label={t("epic.addBlocker")}
                            className="min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground transition-colors duration-150 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <option value="">{t("epic.addBlockerPlaceholder")}</option>
                            {blockerCandidates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            disabled={addingBlocker || !pendingBlockerId}
                            onClick={() => void handleAddBlocker()}
                          >
                            {addingBlocker ? t("common.saving") : t("common.create")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPickerOpen(false)}
                            disabled={addingBlocker}
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
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
