import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { ErrorAlert } from "../ui/ErrorAlert";
import { Avatar } from "../ui/Avatar";
import type {
  CommentResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
} from "../../types/api";
import type { CurrentUser } from "../../auth/AuthContext";

interface TaskDetailPanelProps {
  task: TaskItemResponse;
  currentUser: CurrentUser | null;
  members: WorkspaceMemberResponse[];
  workspaceId: string;
  projectId: string;
  onClose: () => void;
  onTaskChanged: () => void;
}

export function TaskDetailPanel({
  task,
  currentUser,
  members,
  workspaceId,
  projectId,
  onClose,
  onTaskChanged,
}: TaskDetailPanelProps) {
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

  useEffect(() => {
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId);
    setDetailError(null);
  }, [task.id, task.status, task.priority, task.assigneeId]);

  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);

    api<CommentResponse[]>(
      `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/comments`,
    )
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCommentError(
            err instanceof Error ? err.message : "Failed to load comments.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [task.id, workspaceId, projectId]);

  async function saveChanges() {
    setSaving(true);
    setDetailError(null);
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            status,
            priority,
            assigneeId,
            dueDateUtc: task.dueDateUtc,
          }),
        },
      );
      onTaskChanged();
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
    status !== task.status ||
    priority !== task.priority ||
    assigneeId !== task.assigneeId;

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
          <h2 className="font-display font-semibold leading-snug">{task.title}</h2>
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
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as TaskItemResponse["status"])
                }
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
              >
                <option value="Backlog">Backlog</option>
                <option value="InProgress">In Progress</option>
                <option value="InReview">In Review</option>
                <option value="Done">Done</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Priority
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as TaskItemResponse["priority"])
                }
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Assignee
            <select
              value={assigneeId ?? ""}
              onChange={(event) =>
                setAssigneeId(event.target.value === "" ? null : event.target.value)
              }
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName || member.username}
                  {member.role !== "Member" ? ` (${member.role})` : ""}
                </option>
              ))}
            </select>
          </label>

          {dirty && (
            <Button onClick={() => void saveChanges()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          )}

          {task.description && (
            <section>
              <h3 className="mb-1 text-sm font-medium">Description</h3>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </section>
          )}

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
