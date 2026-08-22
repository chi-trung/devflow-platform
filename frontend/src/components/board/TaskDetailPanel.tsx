import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { X, Paperclip, Download, Trash2, BookmarkPlus } from "lucide-react";
import { api, createTemplate, tokens } from "../../lib/api";
import { Button } from "../ui/Button";
import { ErrorAlert } from "../ui/ErrorAlert";
import { Avatar } from "../ui/Avatar";
import { useToast } from "../ui/ToastProvider";
import type {
  CommentResponse,
  SprintResponse,
  TaskItemResponse,
  TaskAttachmentResponse,
  WorkspaceMemberResponse,
} from "../../types/api";
import { DependencySection } from "./DependencySection";
import { TimeTrackingSection } from "./TimeTrackingSection";
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
  const { push } = useToast();

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDueDate(task.dueDateUtc ? task.dueDateUtc.slice(0, 10) : "");
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId);
    setDetailError(null);
  }, [
    task.id,
    task.title,
    task.description,
    task.dueDateUtc,
    task.status,
    task.priority,
    task.assigneeId,
  ]);

  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);
    setAttachmentsLoading(true);

    Promise.all([
      api<CommentResponse[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/comments`,
      ),
      api<TaskAttachmentResponse[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/attachments`,
      ),
    ])
      .then(([comms, atts]) => {
        if (!cancelled) {
          setComments(comms);
          setAttachments(atts);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCommentError(
            err instanceof Error ? err.message : "Failed to load task details.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommentsLoading(false);
          setAttachmentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [task.id, workspaceId, projectId]);

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/attachments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
          },
          body: formData,
        },
      );

      if (!res.ok) throw new Error("Upload failed");
      const created = (await res.json()) as TaskAttachmentResponse;
      setAttachments((curr) => [created, ...curr]);
      push("File attached");
    } catch {
      push("Failed to upload file", "error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
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
      if (!res.ok) throw new Error("Download failed");
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
      push("Failed to download file", "error");
    }
  }

  async function deleteAttachment(att: TaskAttachmentResponse) {
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/attachments/${att.id}`,
        { method: "DELETE" },
      );
      setAttachments((curr) => curr.filter((a) => a.id !== att.id));
      push("Attachment removed");
    } catch {
      push("Failed to remove attachment", "error");
    }
  }

  async function saveChanges() {
    if (!title.trim()) {
      setDetailError("Title can't be empty.");
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
      push("Task updated");
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Failed to update task.",
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
      push("Comment added");
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Failed to add comment.",
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
        err instanceof Error ? err.message : "Failed to delete comment.",
      );
    }
  }

  const dirty =
    title.trim() !== task.title ||
    (description.trim() || null) !== task.description ||
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
      push("Saved as template");
    } catch (err) {
      push(
        err instanceof Error ? err.message : "Failed to save template.",
        "error",
      );
    } finally {
      setSavingTemplate(false);
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
        err instanceof Error ? err.message : "Failed to update sprint.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-label="Task details">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/20"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Task title"
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-base font-semibold leading-snug transition-colors duration-200 hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void saveAsTemplate()}
            disabled={savingTemplate}
            aria-label="Save as template"
            title="Save as task template"
            className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <BookmarkPlus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {detailError && <ErrorAlert message={detailError} />}

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
                <option value="Backlog">{t("board.backlog")}</option>
                <option value="InProgress">{t("board.inProgress")}</option>
                <option value="InReview">{t("board.inReview")}</option>
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
                  {sprint.status === "Active" ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>

          {dirty && (
            <Button onClick={() => void saveChanges()} disabled={saving}>
              {saving ? t("task.saving") : t("task.saveChanges")}
            </Button>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("task.dueDate")}
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("task.description")}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Add more detail…"
              className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/50 transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
            />
          </label>

          <DependencySection
            workspaceId={workspaceId}
            projectId={projectId}
            task={task}
            allTasks={allTasks}
            onChanged={onTaskChanged}
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
              {attachmentsLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No attachments.</p>
              ) : (
                attachments.map((att) => (
                  <div
                    key={att.id}
                    className="group flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
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
                        title="Download"
                        className="rounded p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
                      >
                        <Download className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAttachment(att)}
                        title="Delete"
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

          <section className="flex min-h-0 flex-1 flex-col">
            <h3 className="mb-2 text-sm font-medium">
              Comments{" "}
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
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No comments yet.
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
                            "you"
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
                            aria-label="Delete comment"
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            delete
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

        <form
          onSubmit={addComment}
          className="flex items-end gap-2 border-t border-border p-4"
        >
          <textarea
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder="Write a comment…"
            rows={2}
            maxLength={2000}
            className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/50 transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={postingComment || !newComment.trim()}
          >
            {postingComment ? "…" : "Send"}
          </Button>
        </form>
      </aside>
    </div>
  );
}
