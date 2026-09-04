import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, BookOpen, GitBranch } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { Input } from "../components/ui/Input";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { useToast } from "../components/ui/ToastProvider";
import { KnowledgeEntryCard } from "../components/knowledge/KnowledgeEntryCard";
import { api, createKnowledgeEntry, deleteKnowledgeEntry, getKnowledgeEntries, supersedeKnowledgeEntry, updateKnowledgeEntry } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import type {
  CreateKnowledgeEntryRequest,
  KnowledgeEntryResponse,
  KnowledgeType,
  KnowledgeStatus,
  UpdateKnowledgeEntryRequest,
  WorkspaceMemberResponse,
} from "../types/api";

export function KnowledgePage() {
  const { t } = useTranslation();
  const { push } = useToast();
  const { workspaceId = "", projectId = "" } = useParams<{ workspaceId: string; projectId: string }>();

  const { currentUser } = useAuth();
  const { data: members = [] } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
  );
  const myRole = (members ?? []).find((m) => m.userId === currentUser?.id)?.role;
  const isAdmin = myRole === "Owner" || myRole === "Admin";

  const [entries, setEntries] = useState<KnowledgeEntryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntryResponse | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<KnowledgeType>("Runbook");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<KnowledgeStatus>("Draft");
  const [saving, setSaving] = useState(false);

  // Supersede state
  const [superseding, setSuperseding] = useState<KnowledgeEntryResponse | null>(null);
  const [supersedeTargetId, setSupersedeTargetId] = useState("");
  // Delete state
  const [pendingDelete, setPendingDelete] = useState<KnowledgeEntryResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getKnowledgeEntries(workspaceId, projectId);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function resetForm() {
    setTitle("");
    setBody("");
    setType("Runbook");
    setTags("");
    setStatus("Draft");
    setEditing(null);
    setCreating(false);
  }

  const activeEntries = entries.filter((e) => e.status !== "Superseded" && e.status !== "Deprecated");
  const retiredEntries = entries.filter((e) => e.status === "Superseded" || e.status === "Deprecated");

  // Supersede candidates: other active entries in the project to pick as the replacement.
  const supersedeCandidates = superseding
    ? activeEntries.filter((e) => e.id !== superseding.id)
    : [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const payload: UpdateKnowledgeEntryRequest = {
          title: title.trim(),
          body: body.trim() || null,
          type,
          tags: tags.trim() || null,
          status,
        };
        await updateKnowledgeEntry(workspaceId, projectId, editing.id, payload);
        push(t("knowledge.updated"));
      } else {
        const payload: CreateKnowledgeEntryRequest = {
          title: title.trim(),
          body: body.trim() || null,
          type,
          tags: tags.trim() || null,
        };
        await createKnowledgeEntry(workspaceId, projectId, payload);
        push(t("knowledge.created"));
      }
      resetForm();
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(entry: KnowledgeEntryResponse) {
    setEditing(entry);
    setTitle(entry.title);
    setBody(entry.body ?? "");
    setType(entry.type);
    setTags(entry.tags ?? "");
    setStatus(entry.status);
    setCreating(true);
  }

  function handleSupersedeClick(entry: KnowledgeEntryResponse) {
    setSuperseding(entry);
    setSupersedeTargetId("");
  }

  async function handleSupersede() {
    if (!superseding || !supersedeTargetId.trim()) return;
    try {
      await supersedeKnowledgeEntry(workspaceId, projectId, superseding.id, supersedeTargetId.trim());
      setSuperseding(null);
      push(t("knowledge.superseded"));
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.supersedeFailed"));
    }
  }

  async function handleDelete() {
    const entry = pendingDelete;
    if (!entry) return;
    try {
      await deleteKnowledgeEntry(workspaceId, projectId, entry.id);
      setPendingDelete(null);
      push(t("knowledge.deleted"));
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.deleteFailed"));
    }
  }

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
                {t("knowledge.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("knowledge.description")}
              </p>
            </div>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                {t("knowledge.create")}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} />
          </div>
        )}

        {/* Create / Edit form */}
        <Dialog
          open={creating}
          onClose={resetForm}
          title={editing ? t("knowledge.edit") : t("knowledge.createTitle")}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("knowledge.titleLabel")}</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("knowledge.titlePlaceholder")}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("knowledge.bodyLabel")}</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("knowledge.bodyPlaceholder")}
                rows={5}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("knowledge.typeLabel")}</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as KnowledgeType)}
                  className="w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="Runbook">{t("knowledge.type.Runbook")}</option>
                  <option value="Adr">{t("knowledge.type.Adr")}</option>
                  <option value="Pattern">{t("knowledge.type.Pattern")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("knowledge.tagsLabel")}</label>
                <Input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t("knowledge.tagsPlaceholder")}
                />
              </div>
            </div>
            {editing && (
              <div>
                <label className="mb-1 block text-sm font-medium">{t("knowledge.statusLabel")}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as KnowledgeStatus)}
                  className="w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="Draft">{t("knowledge.status.Draft")}</option>
                  <option value="Proposed">{t("knowledge.status.Proposed")}</option>
                  <option value="Accepted">{t("knowledge.status.Accepted")}</option>
                  <option value="Superseded">{t("knowledge.status.Superseded")}</option>
                  <option value="Deprecated">{t("knowledge.status.Deprecated")}</option>
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving || !title.trim()}>
                {saving ? t("common.saving") : editing ? t("common.save") : t("common.create")}
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Supersede dialog */}
        <Dialog
          open={superseding !== null}
          onClose={() => setSuperseding(null)}
          title={t("knowledge.supersedeTitle")}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("knowledge.supersedeMessage", { title: superseding?.title ?? "" })}
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("knowledge.supersedeEntryId")}</label>
              {supersedeCandidates.length > 0 ? (
                <select
                  value={supersedeTargetId}
                  onChange={(e) => setSupersedeTargetId(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">{t("knowledge.supersedeSelectPlaceholder")}</option>
                  {supersedeCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title} · {t(`knowledge.type.${candidate.type}`)}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type="text"
                  value={supersedeTargetId}
                  onChange={(e) => setSupersedeTargetId(e.target.value)}
                  placeholder={t("knowledge.supersedePlaceholder")}
                />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setSuperseding(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSupersede} disabled={!supersedeTargetId.trim()}>
                <GitBranch className="size-4" aria-hidden />
                {t("knowledge.supersede")}
              </Button>
            </div>
          </div>
        </Dialog>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-8 text-muted-foreground" aria-hidden />}
            title={t("knowledge.emptyTitle")}
            description={t("knowledge.emptyDescription")}
            action={
              !creating && (
                <Button className="mt-2" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("knowledge.create")}
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Active entries */}
            {activeEntries.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("knowledge.activeEntries")}
                  <span className="rounded-full bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
                    {activeEntries.length}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </h2>
                <ul className="flex flex-col gap-3">
                  {activeEntries.map((entry) => (
                    <KnowledgeEntryCard
                      key={entry.id}
                      entry={entry}
                      onEdit={handleEdit}
                      onDelete={setPendingDelete}
                      onSupersede={handleSupersedeClick}
                      canDelete={isAdmin}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* Retired entries */}
            {retiredEntries.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("knowledge.retiredEntries")}
                  <span className="rounded-full bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
                    {retiredEntries.length}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </h2>
                <ul className="flex flex-col gap-3">
                  {retiredEntries.map((entry) => (
                    <KnowledgeEntryCard
                      key={entry.id}
                      entry={entry}
                      onEdit={handleEdit}
                      onDelete={setPendingDelete}
                      onSupersede={handleSupersedeClick}
                      canDelete={isAdmin}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {pendingDelete && (
          <ConfirmDialog
            title={t("knowledge.deleteTitle")}
            message={t("knowledge.deleteMessage", { name: pendingDelete.title })}
            confirmLabel={t("knowledge.deleteConfirm")}
            onConfirm={handleDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </AppShell>
  );
}