import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Pencil, Trash2, Milestone as MilestoneIcon, List, Flag } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/ToastProvider";
import { MilestoneTimeline } from "../components/milestone/MilestoneTimeline";
import { api, createMilestone, deleteMilestone, getEpics, getMilestones, updateMilestone } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import type {
  CreateMilestoneRequest,
  EpicResponse,
  MilestoneResponse,
  MilestoneStatus,
  UpdateMilestoneRequest,
  WorkspaceMemberResponse,
} from "../types/api";

type ViewMode = "list" | "timeline";

const statusTone: Record<MilestoneStatus, "teal" | "amber" | "violet"> = {
  Planned: "violet",
  Active: "amber",
  Completed: "teal",
};

export function MilestonesPage() {
  const { t } = useTranslation();
  const { push } = useToast();
  const { workspaceId = "", projectId = "" } = useParams();
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [epics, setEpics] = useState<EpicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MilestoneResponse | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MilestoneResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("list");

  const { currentUser } = useAuth();
  const { data: members = [] } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
  );

  const myRole = (members ?? []).find((m) => m.userId === currentUser?.id)?.role;
  const isAdmin = myRole === "Owner" || myRole === "Admin";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("Planned");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [milestoneData, epicData] = await Promise.all([
        getMilestones(workspaceId, projectId),
        getEpics(workspaceId, projectId),
      ]);
      setMilestones(milestoneData);
      setEpics(epicData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("milestone.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function resetForm() {
    setName("");
    setDescription("");
    setTargetDate("");
    setStatus("Planned");
    setEditing(null);
    setCreating(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const payload: UpdateMilestoneRequest = {
          name: name.trim(),
          description: description.trim() || null,
          targetDateUtc: targetDate || null,
          status,
        };
        await updateMilestone(workspaceId, projectId, editing.id, payload);
        push(t("milestone.updated"));
      } else {
        const payload: CreateMilestoneRequest = {
          name: name.trim(),
          description: description.trim() || null,
          targetDateUtc: targetDate || null,
        };
        await createMilestone(workspaceId, projectId, payload);
        push(t("milestone.created"));
      }
      resetForm();
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("milestone.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(milestone: MilestoneResponse) {
    setEditing(milestone);
    setName(milestone.name);
    setDescription(milestone.description ?? "");
    setTargetDate(milestone.targetDateUtc ?? "");
    setStatus(milestone.status);
    setCreating(true);
  }

  async function handleDelete() {
    const milestone = pendingDelete;
    if (!milestone) return;
    try {
      await deleteMilestone(workspaceId, projectId, milestone.id);
      setPendingDelete(null);
      push(t("milestone.deleted"));
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("milestone.deleteFailed"));
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

  const overdue = (milestone: MilestoneResponse) =>
    milestone.status !== "Completed" &&
    milestone.targetDateUtc !== null &&
    new Date(milestone.targetDateUtc).getTime() < Date.now();

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
                {t("milestone.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("milestone.description")}
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
                  {t("milestone.listView")}
                </button>
                <button
                  type="button"
                  onClick={() => setView("timeline")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                    view === "timeline"
                      ? "bg-elevated font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Flag className="size-3.5" aria-hidden />
                  {t("milestone.timelineView")}
                </button>
              </div>
              {!creating && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("milestone.create")}
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
              {editing ? t("milestone.edit") : t("milestone.createTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("milestone.nameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("milestone.namePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("milestone.descriptionLabel")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("milestone.descriptionPlaceholder")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("milestone.targetDate")}
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              {editing && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {t("milestone.statusLabel")}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                    className="w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="Planned">{t("milestone.status.Planned")}</option>
                    <option value="Active">{t("milestone.status.Active")}</option>
                    <option value="Completed">{t("milestone.status.Completed")}</option>
                  </select>
                </div>
              )}
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
        ) : milestones.length === 0 ? (
          <EmptyState
            icon={<MilestoneIcon className="size-8 text-muted-foreground" aria-hidden />}
            title={t("milestone.emptyTitle")}
            description={t("milestone.emptyDescription")}
            action={
              !creating && (
                <Button className="mt-2" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("milestone.create")}
                </Button>
              )
            }
          />
        ) : view === "timeline" ? (
          <MilestoneTimeline milestones={milestones} epics={epics} onSelect={handleEdit} />
        ) : (
          <ul className="flex flex-col gap-3">
            {milestones.map((milestone) => {
              const milestoneEpics = epics.filter((epic) => epic.milestoneId === milestone.id);
              const completed = milestoneEpics.filter((epic) => epic.completionPercent >= 100).length;
              const pct = milestoneEpics.length === 0 ? 0 : Math.round((completed * 100) / milestoneEpics.length);
              const dateLabel = formatDate(milestone.targetDateUtc);

              return (
                <li
                  key={milestone.id}
                  className="group rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MilestoneIcon className="size-4 text-primary" aria-hidden />
                        <h3 className="truncate text-sm font-semibold">
                          {milestone.name}
                        </h3>
                        <Badge tone={statusTone[milestone.status]}>
                          {t(`milestone.status.${milestone.status}`)}
                        </Badge>
                      </div>
                      {milestone.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {milestone.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {dateLabel && (
                          <span className={`inline-flex items-center gap-1 ${overdue(milestone) ? "font-semibold text-destructive" : ""}`}>
                            {dateLabel}
                            {overdue(milestone) && t("milestone.overdue")}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          {milestoneEpics.length} {t("milestone.epics")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {pct}% {t("milestone.complete")}
                        </span>
                      </div>
                      {milestoneEpics.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${overdue(milestone) ? "bg-destructive" : "bg-primary"}`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {completed}/{milestoneEpics.length}
                          </span>
                        </div>
                      )}
                      {milestoneEpics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {milestoneEpics.map((epic) => (
                            <span
                              key={epic.id}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {epic.name}
                              <span className="font-mono text-[10px]">
                                {Math.round(epic.completionPercent)}%
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleEdit(milestone)}
                        className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                        title={t("milestone.edit")}
                        aria-label={t("milestone.edit")}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(milestone)}
                          className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                          title={t("milestone.delete")}
                          aria-label={t("milestone.delete")}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pendingDelete && (
          <ConfirmDialog
            title={t("milestone.deleteTitle")}
            message={t("milestone.deleteMessage", { name: pendingDelete.name })}
            confirmLabel={t("milestone.deleteConfirm")}
            onConfirm={handleDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
