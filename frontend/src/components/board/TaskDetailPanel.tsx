import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { X, Paperclip, Download, Trash2, BookmarkPlus, Eye, RefreshCw, CheckSquare, Square } from "lucide-react";
import { api, createTemplate, tokens, isWatchingTask, watchTask, unwatchTask, uploadTaskAttachment, getTaskWatchers, pagedItems } from "../../lib/api";
import { AttachmentRowThumb } from "./AttachmentThumbnails";
import { Button } from "../ui/Button";
import { ErrorAlert } from "../ui/ErrorAlert";
import { Avatar } from "../ui/Avatar";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/ToastProvider";
import type {
  CommentResponse,
  SprintResponse,
  TaskItemResponse,
  TaskAttachmentResponse,
  TaskWatcherResponse,
  WorkspaceMemberResponse,
} from "../../types/api";
import { AiPlanPanel } from "../ai/AiPlanPanel";
import { DependencySection } from "./DependencySection";
import { TimeTrackingSection } from "./TimeTrackingSection";
import { SubtaskSection } from "./SubtaskSection";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { TaskFieldsSection } from "../fields/TaskFieldsSection";
import { TaskPullRequests } from "../github/TaskPullRequests";
import type { CurrentUser } from "../../auth/AuthContext";

interface TaskDetailPanelProps {
  task: TaskItemResponse;
  currentUser: CurrentUser | null;
  members: WorkspaceMemberResponse[];
  sprints: SprintResponse[];
  allTasks: TaskItemResponse[];
  workspaceId: string;
  projectId: string;
  onClose: () => void;
  onTaskChanged: () => void;
}

/**
 * Definition of Done field — a textarea that doubles as a rendered checklist.
 * Lines starting with "- [ ]" or "- [x]" are shown as clickable checkbox items
 * so the user can toggle items without leaving the panel.
 */
function DefinitionOfDoneField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();

  function toggleCheckbox(lineIndex: number) {
    const lines = value.split("\n");
    const line = lines[lineIndex];
    if (!line) return;
    if (/^- \[ \]/.test(line)) {
      lines[lineIndex] = line.replace("- [ ]", "- [x]");
    } else if (/^- \[x\]/i.test(line)) {
      lines[lineIndex] = line.replace("- [x]", "- [ ]").replace("- [X]", "- [ ]");
    }
    onChange(lines.join("\n"));
  }

  const totalItems = value.split("\n").filter((l) => /^- \[.\]/.test(l)).length;
  const checkedItems = value.split("\n").filter((l) => /^- \[x\]/i.test(l)).length;
  const allMet = totalItems > 0 && checkedItems === totalItems;

  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      <span className="inline-flex items-center gap-1.5">
        {t("board.definitionOfDone")}
        {allMet && (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-500">
            {t("board.dodMet")}
          </span>
        )}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder={`- [ ] ${t("board.dodPlaceholder")}`}
        className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/50 transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
      />
      {/* Rendered checklist preview */}
      {value.split("\n").some((l) => /^- \[.\]/.test(l)) && (
        <ul className="mt-1 space-y-0.5">
          {value.split("\n").map((line, i) => {
            const checked = /^- \[x\]/i.test(line);
            const isItem = /^- \[.\]/.test(line);
            if (!isItem) return null;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => toggleCheckbox(i)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {checked ? (
                    <CheckSquare className="size-3.5 text-emerald-500" />
                  ) : (
                    <Square className="size-3.5" />
                  )}
                  <span className={checked ? "line-through opacity-60" : ""}>
                    {line.replace(/^- \[.\] /, "")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </label>
  );
}

export function TaskDetailPanel({
  task,
  currentUser,
  members,
  sprints,
  allTasks,
  workspaceId,
  projectId,
  onClose,
  onTaskChanged,
}: TaskDetailPanelProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [definitionOfDone, setDefinitionOfDone] = useState(
    task.definitionOfDone ?? "",
  );
  const [dueDate, setDueDate] = useState(
    task.dueDateUtc ? task.dueDateUtc.slice(0, 10) : "",
  );
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState<string | null>(task.assigneeId);
  const [saving, setSaving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);

  const [attachments, setAttachments] = useState<TaskAttachmentResponse[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; progress: number; error: string | null }[]>([]);
  const [watching, setWatching] = useState(false);
  const [watchingLoading, setWatchingLoading] = useState(true);
  const [watchers, setWatchers] = useState<TaskWatcherResponse[]>([]);
  const [watchersLoading, setWatchersLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDefinitionOfDone(task.definitionOfDone ?? "");
    setDueDate(task.dueDateUtc ? task.dueDateUtc.slice(0, 10) : "");
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId);
    setDetailError(null);
  }, [
    task.id,
    task.title,
    task.description,
    task.definitionOfDone,
    task.dueDateUtc,
    task.status,
    task.priority,
    task.assigneeId,
  ]);

  useEffect(() => {
    let cancelled = false;
    setWatchersLoading(true);
    void getTaskWatchers(workspaceId, projectId, task.id)
      .then((data) => {
        if (!cancelled) setWatchers(data);
      })
      .catch(() => {
        if (!cancelled) setWatchers([]);
      })
      .finally(() => {
        if (!cancelled) setWatchersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, task.id]);

  useEffect(() => {
    let cancelled = false;
    void isWatchingTask(workspaceId, projectId, task.id)
      .then((result) => {
        if (!cancelled) setWatching(result);
      })
      .catch(() => {
        if (!cancelled) setWatching(false);
      })
      .finally(() => {
        if (!cancelled) setWatchingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, task.id]);

  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);
    setAttachmentsLoading(true);
    setCommentError(null);

    // Free-tier hosts (Render) cold-start in 1–3 s; the very first request
    // after a period of inactivity can fail with a connection error. Retry
    // once so a transient cold-start failure doesn't leave the panel stuck.
    const loadWithRetry = async <T,>(
      load: () => Promise<T>,
    ): Promise<T> => {
      try {
        return await load();
      } catch (firstError: unknown) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        return load();
      }
    };

    const loadComments = loadWithRetry<CommentResponse[]>(() =>
      api<CommentResponse[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/comments`,
      ),
    );
    const loadAttachments = loadWithRetry<TaskAttachmentResponse[]>(() =>
      // The endpoint returns a PagedResult ({ items, totalCount, ... }), not a
      // flat array — unwrap through pagedItems or attachments.map() crashes
      // the panel ("re.map is not a function") on every task with a detail
      // panel open. Same shape contract as the tasks/sprints/labels lists.
      api<TaskAttachmentResponse[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/attachments`,
      ).then((res) => pagedItems<TaskAttachmentResponse>(res)),
    );

    // Comments and attachments are independent — a failure in one must not
    // hide the other, so they resolve separately (comments render first).
    loadComments
      .then((comms) => {
        if (!cancelled) {
          setComments(comms);
          setCommentError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCommentError(
            err instanceof Error ? err.message : t("board.loadDetailsFailed"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    loadAttachments
      .then((atts) => {
        if (!cancelled) setAttachments(atts);
      })
      .catch(() => {
        // Attachments are secondary; don't block the panel on them.
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [task.id, workspaceId, projectId]);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_QUEUE_SIZE = 5;
  const BLOCKED_EXTENSIONS = new Set([
    ".exe",
    ".dll",
    ".bat",
    ".sh",
    ".cmd",
    ".ps1",
    ".js",
    ".vbs",
    ".scr",
  ]);

  function getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot === -1) return "";
    return fileName.slice(lastDot).toLowerCase();
  }

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
      return t("board.fileTooLarge", { maxSize: "10 MB" });
    }
    if (BLOCKED_EXTENSIONS.has(getFileExtension(file.name))) {
      return t("board.fileTypeNotAllowed");
    }
    return null;
  }

  async function processUpload(item: { file: File; progress: number; error: string | null }) {
    setUploadQueue((curr) =>
      curr.map((q) => (q.file === item.file ? { ...q, error: null } : q)),
    );
    try {
      const created = await uploadTaskAttachment(
        workspaceId,
        projectId,
        task.id,
        item.file,
        (progress) => {
          setUploadQueue((curr) =>
            curr.map((q) => (q.file === item.file ? { ...q, progress } : q)),
          );
        },
      );
      setAttachments((curr) => [created, ...curr]);
      push(t("task.fileAttached"));
      setUploadQueue((curr) => curr.filter((q) => q.file !== item.file));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("board.uploadFailed");
      setUploadQueue((curr) =>
        curr.map((q) => (q.file === item.file ? { ...q, error: message } : q)),
      );
    }
  }

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        push(error, "error");
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setUploading(true);
    const newQueue = validFiles.map((file) => ({
      file,
      progress: 0,
      error: null as string | null,
    }));

    setUploadQueue((curr) => {
      const combined = [...curr, ...newQueue];
      return combined.slice(-MAX_QUEUE_SIZE);
    });

    for (const item of newQueue) {
      await processUpload(item);
    }

    setUploading(false);
    event.target.value = "";
  }

  async function retryUpload(item: { file: File; progress: number; error: string | null }) {
    setUploadQueue((curr) =>
      curr.map((q) => (q.file === item.file ? { ...q, progress: 0, error: null } : q)),
    );
    await processUpload(item);
  }

  async function downloadAttachment(att: TaskAttachmentResponse) {
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/attachments/${att.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access}`,
          },
        },
      );
      if (!res.ok) throw new Error(t("board.downloadFailed"));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch {
      push(t("board.downloadFailed"), "error");
    }
  }

  async function deleteAttachment(att: TaskAttachmentResponse) {
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/attachments/${att.id}`,
        { method: "DELETE" },
      );
      setAttachments((curr) => curr.filter((a) => a.id !== att.id));
      push(t("task.attachmentRemoved"));
    } catch {
      push(t("board.removeAttachmentFailed"), "error");
    }
  }

  async function saveChanges() {
    if (!title.trim()) {
      setDetailError(t("task.titleRequired"));
      return;
    }

    setSaving(true);
    setDetailError(null);
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            definitionOfDone: definitionOfDone.trim() || null,
            status,
            priority,
            assigneeId,
            dueDateUtc: dueDate
              ? new Date(`${dueDate}T12:00:00`).toISOString()
              : null,
          }),
        },
      );
      onTaskChanged();
      push(t("task.taskUpdated"));
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : t("board.updateFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!newComment.trim()) return;

    setPostingComment(true);
    setCommentError(null);
    try {
      const created = await api<CommentResponse>(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/comments`,
        { method: "POST", body: JSON.stringify({ content: newComment.trim() }) },
      );
      setComments((current) => [...current, created]);
      setNewComment("");
      push(t("task.commentAdded"));
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : t("board.addCommentFailed"),
      );
    } finally {
      setPostingComment(false);
    }
  }

  async function deleteComment(comment: CommentResponse) {
    setCommentError(null);
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/comments/${comment.id}`,
        { method: "DELETE" },
      );
      setComments((current) => current.filter((c) => c.id !== comment.id));
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : t("board.deleteCommentFailed"),
      );
    }
  }

  const dirty =
    title.trim() !== task.title ||
    (description.trim() || null) !== task.description ||
    (definitionOfDone.trim() || null) !== task.definitionOfDone ||
    (dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null) !==
      task.dueDateUtc ||
    status !== task.status ||
    priority !== task.priority ||
    assigneeId !== task.assigneeId;

  const [savingTemplate, setSavingTemplate] = useState(false);
  async function saveAsTemplate() {
    setSavingTemplate(true);
    try {
      await createTemplate(workspaceId, projectId, {
        name: task.title.slice(0, 60),
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimateMinutes: task.estimateMinutes ?? null,
      });
      push(t("task.savedAsTemplate"));
    } catch (err) {
      push(
        err instanceof Error ? err.message : t("board.saveTemplateFailed"),
        "error",
      );
    } finally {
      setSavingTemplate(false);
    }
  }

  async function toggleWatch() {
    setWatchingLoading(true);
    try {
      if (watching) {
        await unwatchTask(workspaceId, projectId, task.id);
        setWatching(false);
        push(t("task.unwatched"));
      } else {
        await watchTask(workspaceId, projectId, task.id);
        setWatching(true);
        push(t("task.watched"));
      }
      const data = await getTaskWatchers(workspaceId, projectId, task.id);
      setWatchers(data);
    } catch {
      push(t("task.watchFailed"), "error");
    } finally {
      setWatchingLoading(false);
    }
  }

  async function changeSprint(sprintId: string | null) {
    setDetailError(null);
    const base = `/workspaces/${workspaceId}/projects/${projectId}/sprints`;
    try {
      if (sprintId) {
        await api(`${base}/${sprintId}/tasks/${task.id}`, { method: "PUT" });
      } else if (task.sprintId) {
        await api(`${base}/${task.sprintId}/tasks/${task.id}`, {
          method: "DELETE",
        });
      }
      onTaskChanged();
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : t("board.updateSprintFailed"),
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-label={t("board.detailsAria")}
    >
      <button
        type="button"
        aria-label={t("board.closePanelAria")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/20"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-border bg-surface shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label={t("board.titleAria")}
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-base font-semibold leading-snug transition-colors duration-200 hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void saveAsTemplate()}
            disabled={savingTemplate}
            aria-label={t("board.saveTemplateAria")}
            title={t("board.saveTemplateTitle")}
            className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <BookmarkPlus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void toggleWatch()}
            disabled={watchingLoading}
            aria-label={watching ? t("task.unwatchAria") : t("task.watchAria")}
            title={watching ? t("task.unwatch") : t("task.watch")}
            className={`rounded p-1 transition-colors duration-150 ${
              watching
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("board.closeAria")}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {detailError && (
            <div className="p-4 pb-0">
              <ErrorAlert message={detailError} />
            </div>
          )}

          <div className="flex flex-1 flex-col lg:flex-row">
          {/* ── Main column (description, advanced sections, comments) ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("task.description")}
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder={t("task.addDetail")}
                className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/50 transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
              />
            </label>

            <DefinitionOfDoneField
              value={definitionOfDone}
              onChange={setDefinitionOfDone}
            />

            <DependencySection
              workspaceId={workspaceId}
              projectId={projectId}
              task={task}
              allTasks={allTasks}
              onChanged={onTaskChanged}
            />

            <SubtaskSection
              workspaceId={workspaceId}
              projectId={projectId}
              task={task}
              onChanged={onTaskChanged}
            />

            <CustomFieldsSection
              workspaceId={workspaceId}
              projectId={projectId}
              taskId={task.id}
            />

            <TimeTrackingSection
              workspaceId={workspaceId}
              projectId={projectId}
              task={task}
              members={members}
              onChanged={onTaskChanged}
            />

            <TaskFieldsSection
              workspaceId={workspaceId}
              projectId={projectId}
              taskId={task.id}
            />

            <TaskPullRequests
              workspaceId={workspaceId}
              projectId={projectId}
              taskId={task.id}
            />

            <AiPlanPanel
              workspaceId={workspaceId}
              projectId={projectId}
              taskId={task.id}
              onChanged={onTaskChanged}
            />

            {/* ── Comments ── */}
            <section className="flex min-h-0 flex-1 flex-col">
              <h3 className="mb-2 text-sm font-medium">
                {t("task.comments")}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  ({comments.length})
                </span>
              </h3>

              {commentError && (
                <div className="mb-2">
                  <ErrorAlert message={commentError} />
                </div>
              )}

              <div className="flex flex-col gap-2">
                {commentsLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("task.noComments")}
                  </p>
                ) : (
                  comments.map((comment) => {
                    const mine = currentUser?.id === comment.authorId;
                    const author = members.find(
                      (m) => m.userId === comment.authorId,
                    );
                    return (
                      <article
                        key={comment.id}
                        className="rounded-lg border border-border bg-card p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                            {mine ? (
                              t("task.you")
                            ) : author ? (
                              <span className="flex items-center gap-1.5">
                                <Avatar
                                  name={author.displayName || author.username}
                                  id={author.userId}
                                />
                                {author.displayName || author.username}
                              </span>
                            ) : (
                              comment.authorId.slice(0, 8)
                            )}
                            {" · "}
                            {new Date(comment.createdAtUtc).toLocaleString()}
                          </span>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => void deleteComment(comment)}
                              aria-label={t("task.deleteComment")}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              {t("task.deleteComment")}
                            </button>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">
                          {comment.content}
                        </p>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* ── Sidebar (status, fields, save, attachments) ── */}
          <div className="flex flex-col gap-4 border-t border-border p-4 lg:w-72 lg:shrink-0 lg:border-l lg:border-t-0">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t("task.status")}
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as TaskItemResponse["status"])
                  }
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
                >
                  <option value="Idea">{t("board.idea")}</option>
                  <option value="Planning">{t("board.planning")}</option>
                  <option value="Approval">{t("board.approval")}</option>
                  <option value="Ready">{t("board.ready")}</option>
                  <option value="InProgress">{t("board.inProgress")}</option>
                  <option value="Review">{t("board.review")}</option>
                  <option value="Done">{t("board.done")}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                {t("task.priority")}
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as TaskItemResponse["priority"])
                  }
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
                >
                  <option value="Low">{t("task.low")}</option>
                  <option value="Medium">{t("task.medium")}</option>
                  <option value="High">{t("task.high")}</option>
                  <option value="Critical">{t("task.critical")}</option>
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("task.assignee")}
              <select
                value={assigneeId ?? ""}
                onChange={(event) =>
                  setAssigneeId(event.target.value === "" ? null : event.target.value)
                }
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
              >
                <option value="">{t("task.unassigned")}</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName || member.username}
                    {member.role !== "Member" ? ` (${member.role})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("task.sprint")}
              <select
                value={task.sprintId ?? ""}
                onChange={(event) =>
                  void changeSprint(event.target.value === "" ? null : event.target.value)
                }
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
              >
                <option value="">{t("task.noSprint")}</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                    {sprint.status === "Active" ? ` (${t("sprint.active")})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("task.dueDate")}
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
              />
            </label>

            {dirty && (
              <Button onClick={() => void saveChanges()} disabled={saving}>
                {saving ? t("task.saving") : t("task.saveChanges")}
              </Button>
            )}

            <div className="flex flex-col gap-1 text-sm font-medium">
              {t("task.watchers")}
              {watchersLoading ? (
                <p className="text-xs text-muted-foreground">{t("task.loading")}</p>
              ) : watchers.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("task.noWatchers")}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {watchers.map((watcher) => (
                    <div
                      key={watcher.userId}
                      className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2 py-1 text-xs"
                    >
                      <Avatar
                        name={watcher.displayName || watcher.username}
                        id={watcher.userId}
                        size="sm"
                      />
                      <span className="truncate font-medium text-foreground">
                        {watcher.displayName || watcher.username}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Attachments ── */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                  {t("task.attachments")}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({attachments.length})
                  </span>
                </h3>
                <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  {uploading ? t("task.uploading") : t("task.addFile")}
                  <input
                    type="file"
                    onChange={uploadFile}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                {uploadQueue.map((item) => (
                  <div
                    key={item.file.name + item.file.size}
                    className="rounded-lg border border-border/60 bg-card p-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">
                        {item.file.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                        {Math.round(item.file.size / 1024)} KB
                      </span>
                    </div>
                    {item.error ? (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs text-destructive">{item.error}</p>
                        <button
                          type="button"
                          onClick={() => void retryUpload(item)}
                          className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw className="size-3" aria-hidden />
                          {t("task.retry")}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full bg-primary transition-all duration-150"
                          style={{ width: `${Math.round(item.progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {attachmentsLoading ? (
                  <p className="text-xs text-muted-foreground">
                    {t("task.loading")}
                  </p>
                ) : attachments.length === 0 && uploadQueue.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("task.noAttachments")}
                  </p>
                ) : (
                  attachments.map((att) => (
                    <div
                      key={att.id}
                      className="group flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AttachmentRowThumb
                          workspaceId={workspaceId}
                          projectId={projectId}
                          taskId={task.id}
                          attachmentId={att.id}
                          contentType={att.contentType}
                        />
                        <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate font-medium text-foreground">
                          {att.fileName}
                        </span>
                        <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                          ({Math.round(att.fileSize / 1024)} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => void downloadAttachment(att)}
                          title={t("board.download")}
                          className="rounded p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
                        >
                          <Download className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteAttachment(att)}
                          title={t("common.delete")}
                          className="rounded p-1 text-muted-foreground hover:bg-elevated hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
          </div>
        </div>

        <form
          onSubmit={addComment}
          className="flex items-end gap-2 border-t border-border p-4"
        >
          <textarea
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder={t("task.writeComment")}
            rows={2}
            maxLength={2000}
            className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/50 transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={postingComment || !newComment.trim()}
          >
            {postingComment ? "…" : t("task.send")}
          </Button>
        </form>
      </aside>
    </div>
  );
}
