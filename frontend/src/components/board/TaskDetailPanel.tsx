import { memo, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Download, Trash2, BookmarkPlus, Eye, RefreshCw, CheckSquare, Square } from "lucide-react";
import { api, API_BASE, createTemplate, tokens, isWatchingTask, watchTask, unwatchTask, uploadTaskAttachment, getTaskWatchers, pagedItems } from "../../lib/api";
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
import { TaskPullRequests } from "../github/TaskPullRequests";
import { CollapsibleSection } from "./CollapsibleSection";
import { TaskRecurrenceSection } from "../calendar/TaskRecurrenceSection";
import type { CurrentUser } from "../../auth/AuthContext";

// Test-only render counter. The panel is memoised, so a no-op parent
// re-render must not re-run its ~1100-line body; the only reliable way to
// assert that is to count from inside the memoised body (see TaskCard).
let __renders = 0;
export function __detailPanelRenders(): number {
  return __renders;
}
export function __resetDetailPanelRenders(): void {
  __renders = 0;
}

/** Small inline hint for the collapsed DoD row: checked/total items. */
function DoDMeta({ value }: { value: string }) {
  const items = value.split("\n").filter((l) => /^- \[.\]/.test(l));
  if (items.length === 0) return null;
  const checked = items.filter((l) => /^- \[x\]/i.test(l)).length;
  return (
    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
      {checked}/{items.length}
    </span>
  );
}

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

const STATUS_LABEL_KEYS: Record<TaskItemResponse["status"], string> = {
  Idea: "board.idea",
  Planning: "board.planning",
  Approval: "board.approval",
  Ready: "board.ready",
  InProgress: "board.inProgress",
  Review: "board.review",
  Done: "board.done",
};

const PRIORITY_LABEL_KEYS: Record<TaskItemResponse["priority"], string> = {
  Low: "task.low",
  Medium: "task.medium",
  High: "task.high",
  Critical: "task.critical",
};

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
        className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
      />
      {/* Rendered checklist preview */}
      {value.split("\n").some((l) => /^- \[.\]/.test(l)) && (
        <ul role="list" className="mt-1 space-y-0.5">
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

export const TaskDetailPanel = memo(function TaskDetailPanel({
  task,
  currentUser,
  members,
  sprints,
  allTasks,
  workspaceId,
  projectId,
  onTaskChanged,
}: TaskDetailPanelProps) {
  // `onClose` stays on the props interface (page passes a stable `back`) so
  // the call-site shape — and the memo guards — don't change; the page owns
  // the Back link, so the panel itself never reads it (noUnusedLocals).
  __renders++;
  const { t } = useTranslation();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  // Read-mode is the default so the body reads like a post, not a form.
  // Edit binds the same `description` state the dirty/PATCH logic already
  // tracks; exiting edit after a successful save is handled below.
  const [editingDescription, setEditingDescription] = useState(false);
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
  // Deleting a comment is a DELETE that drops the row; a second click after
  // the first succeeded hits the handler's null-check NotFound and paints an
  // error under the comment list that just worked. One delete in flight.
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );

  const [attachments, setAttachments] = useState<TaskAttachmentResponse[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [attachmentsError, setAttachmentsError] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Same double-DELETE shape for attachments: the handler NotFound-checks the
  // attachment id, so a click after the row already dropped surfaces a 404
  // toast over a successful delete.
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    string | null
  >(null);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; progress: number; error: string | null }[]>([]);
  const [watching, setWatching] = useState(false);
  const [watchingLoading, setWatchingLoading] = useState(true);
  // A failed isWatchingTask GET used to fabricate `false` — a real watcher
  // then saw "Watch", and clicking it POSTed a second watch and toasted a
  // lie. Unknown must render as unknown, not as an actionable direction.
  const [watchingUnknown, setWatchingUnknown] = useState(false);
  const [watchers, setWatchers] = useState<TaskWatcherResponse[]>([]);
  const [watchersLoading, setWatchersLoading] = useState(true);
  const [watchersError, setWatchersError] = useState(false);
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
    // A task re-sync (onTaskChanged reload) re-bases the body — leave edit
    // mode so the fresh server value isn't shown under a live textarea.
    setEditingDescription(false);
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
    setWatchersError(false);
    void getTaskWatchers(workspaceId, projectId, task.id)
      .then((data) => {
        if (!cancelled) setWatchers(data);
      })
      .catch(() => {
        // "No watchers" and "couldn't load watchers" are different claims;
        // the old catch fabricated the first from the second.
        if (!cancelled) setWatchersError(true);
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
    setWatchingUnknown(false);
    void isWatchingTask(workspaceId, projectId, task.id)
      .then((result) => {
        if (!cancelled) {
          setWatching(result);
          setWatchingUnknown(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWatching(false);
          setWatchingUnknown(true);
        }
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
    setAttachmentsError(false);

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
        // Attachments don't block the panel, but the failure must still be
        // distinguishable from a genuinely empty attachment list.
        if (!cancelled) setAttachmentsError(true);
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
    // NOTE (wave-33): root-relative /api/v1 would fetch the Vercel SPA's
    // index.html rewrite in prod (not the Render backend) — resolve against
    // the shared API base exactly like every other attachment call site.
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/attachments/${att.id}/download`,
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
    if (deletingAttachmentId) return;
    setDeletingAttachmentId(att.id);
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/attachments/${att.id}`,
        { method: "DELETE" },
      );
      setAttachments((curr) => curr.filter((a) => a.id !== att.id));
      push(t("task.attachmentRemoved"));
    } catch {
      push(t("board.removeAttachmentFailed"), "error");
    } finally {
      setDeletingAttachmentId(null);
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
      // Description read-mode is the default; a successful PATCH re-bases
      // the body, so leave edit and show the saved post body again.
      setEditingDescription(false);
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
    if (deletingCommentId) return;
    setDeletingCommentId(comment.id);
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
    } finally {
      setDeletingCommentId(null);
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

  // Meta chips read local state so they mirror unsaved edits the same way
  // the Details selects do — no extra fetch.
  const assignee =
    assigneeId !== null
      ? (members.find((m) => m.userId === assigneeId) ?? null)
      : null;
  const currentSprint =
    task.sprintId !== null
      ? (sprints.find((s) => s.id === task.sprintId) ?? null)
      : null;

  const [savingTemplate, setSavingTemplate] = useState(false);
  async function saveAsTemplate() {
    setSavingTemplate(true);
    try {
      await createTemplate(workspaceId, projectId, {
        name: task.title.slice(0, 60),
        title: task.title,
        description: task.description,
        priority: task.priority,
        // TaskItemResponse carries no estimateMinutes (never did) — the
        // closest persisted analog is story points.
        estimateMinutes: task.storyPoints ?? null,
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
    // Page-flow article (no modal/fixed/z-50): the route shell owns the
    // Back link and AppShell owns scroll + document.title mirror. The
    // sr-only title span inside <h1> is load-bearing — an <input> value
    // never lands in textContent, so without it the tab title goes stale.
    <article className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {task.key && task.key !== "—" && (
            <div className="mb-1">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(task.key).catch(() => {})}
                title={t("task.copyKey")}
                className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {task.key}
              </button>
            </div>
          )}
          <h1 className="m-0">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label={t("board.titleAria")}
              className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-2xl font-semibold leading-snug tracking-tight transition-colors duration-200 hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
            />
            <span className="sr-only">{title}</span>
          </h1>
        </div>
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
          disabled={watchingLoading || watchingUnknown}
          aria-label={watchingUnknown ? t("task.watchUnknownAria") : watching ? t("task.unwatchAria") : t("task.watchAria")}
          title={watchingUnknown ? t("task.watchUnknown") : watching ? t("task.unwatch") : t("task.watch")}
          className={`rounded p-1 transition-colors duration-150 ${
            watchingUnknown
              ? "text-muted-foreground/60"
              : watching
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Eye className="size-4" aria-hidden />
        </button>
      </header>

      {/* Meta chips — display-only summary of the local edit state. */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground">
          {t(STATUS_LABEL_KEYS[status])}
        </span>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground">
          {t(PRIORITY_LABEL_KEYS[priority])}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground">
          {assignee ? (
            <>
              <Avatar
                name={assignee.displayName || assignee.username}
                id={assignee.userId}
                size="sm"
              />
              {assignee.displayName || assignee.username}
            </>
          ) : (
            t("task.unassigned")
          )}
        </span>
        {dueDate && (
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground">
            {dueDate}
          </span>
        )}
        {currentSprint && (
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground">
            {currentSprint.name}
          </span>
        )}
      </div>

      {detailError && <ErrorAlert message={detailError} />}

      {/* ── Details card: field editors (was the right rail) ── */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("taskDetail.details")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        </div>

        {dirty && (
          <div className="mt-3">
            <Button onClick={() => void saveChanges()} disabled={saving}>
              {saving ? t("task.saving") : t("task.saveChanges")}
            </Button>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">
            {t("task.recurrence.sectionTitle")}
          </p>
          <TaskRecurrenceSection
            workspaceId={workspaceId}
            projectId={projectId}
            taskId={task.id}
            seedTitle={task.title}
            seedPriority={task.priority}
            seedDueDateUtc={task.dueDateUtc}
          />
        </div>

        <div className="mt-4 flex flex-col gap-1 text-sm font-medium">
          {t("task.watchers")}
          {watchersLoading ? (
            <p className="text-xs text-muted-foreground">{t("task.loading")}</p>
          ) : watchersError ? (
            <p role="alert" className="text-xs text-destructive">{t("task.watchersLoadFailed")}</p>
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
        <section className="mt-4 space-y-2">
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
                    <p role="alert" className="text-xs text-destructive">{item.error}</p>
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
            ) : attachmentsError && attachments.length === 0 ? (
              <p role="alert" className="text-xs text-destructive">
                {t("task.attachmentsLoadFailed")}
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
                      disabled={deletingAttachmentId !== null}
                      title={t("common.delete")}
                      className="rounded p-1 text-muted-foreground hover:bg-elevated hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      {/* ── Description: read as a post body, edit on demand ── */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("task.description")}</h2>
          {!editingDescription && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingDescription(true)}
            >
              {t("common.edit")}
            </Button>
          )}
        </div>
        {editingDescription ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder={t("task.addDetail")}
              aria-label={t("task.description")}
              className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
            />
            <div className="flex items-center gap-2">
              {/* Save lives on the Details card (one PATCH for every dirty
                  field); this only leaves edit mode and keeps the draft. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingDescription(false)}
              >
                {t("common.close")}
              </Button>
            </div>
          </div>
        ) : description.trim() ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("task.addDetail")}</p>
        )}
      </section>

      {/* Advanced sections collapse to one-line rows so description +
          comments stay the visual anchors. Bodies render lazily
          (see CollapsibleSection) so collapsed sections don't fetch. */}
      <CollapsibleSection title={t("board.definitionOfDone")} hint={<DoDMeta value={definitionOfDone} />}>
        <DefinitionOfDoneField
          value={definitionOfDone}
          onChange={setDefinitionOfDone}
        />
      </CollapsibleSection>

      <CollapsibleSection title={t("dependency.blockedBy")}>
        <DependencySection
          workspaceId={workspaceId}
          projectId={projectId}
          task={task}
          allTasks={allTasks}
          onChanged={onTaskChanged}
        />
      </CollapsibleSection>

      <CollapsibleSection title={t("subtask.subtasks")}>
        <SubtaskSection
          workspaceId={workspaceId}
          projectId={projectId}
          task={task}
          onChanged={onTaskChanged}
        />
      </CollapsibleSection>

      <CollapsibleSection title={t("taskDetail.customFields")}>
        <CustomFieldsSection
          workspaceId={workspaceId}
          projectId={projectId}
          taskId={task.id}
        />
      </CollapsibleSection>

      <CollapsibleSection title={t("timeTracking.timeTracking")}>
        <TimeTrackingSection
          workspaceId={workspaceId}
          projectId={projectId}
          task={task}
          members={members}
          onChanged={onTaskChanged}
        />
      </CollapsibleSection>

      <CollapsibleSection title={t("github.linkedPrs")}>
        <TaskPullRequests
          workspaceId={workspaceId}
          projectId={projectId}
          taskId={task.id}
        />
      </CollapsibleSection>

      <CollapsibleSection title={t("ai.aiPlanner")}>
        <AiPlanPanel
          workspaceId={workspaceId}
          projectId={projectId}
          taskId={task.id}
          onChanged={onTaskChanged}
        />
      </CollapsibleSection>

      {/* ── Comments thread (IG/FB post style) + composer ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          {t("task.comments")}{" "}
          <span className="font-mono text-xs text-muted-foreground">
            ({comments.length})
          </span>
        </h2>

        {commentError && <ErrorAlert message={commentError} />}

        <div className="flex flex-col gap-4">
          {commentsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : comments.length === 0 && !commentError ? (
            // Same gate EpicsPage ships: when the comments fetch failed
            // the list is still [] (the catch never clears data it never
            // got), and "No comments yet" under the error banner states
            // an absence that was never observed.
            <p className="text-sm text-muted-foreground">
              {t("task.noComments")}
            </p>
          ) : (
            comments.map((comment) => {
              const mine = currentUser?.id === comment.authorId;
              const author = members.find(
                (m) => m.userId === comment.authorId,
              );
              const authorName = mine
                ? t("task.you")
                : author
                  ? author.displayName || author.username
                  : comment.authorId.slice(0, 8);
              return (
                <article
                  key={comment.id}
                  className="flex gap-3"
                >
                  <Avatar
                    name={
                      author
                        ? author.displayName || author.username
                        : authorName
                    }
                    id={comment.authorId}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="flex items-baseline gap-2 text-sm font-semibold">
                        {authorName}
                        <time
                          dateTime={comment.createdAtUtc}
                          className="text-xs font-normal text-muted-foreground"
                        >
                          {new Date(comment.createdAtUtc).toLocaleString()}
                        </time>
                      </span>
                      {mine && (
                        <button
                          type="button"
                          onClick={() => void deleteComment(comment)}
                          disabled={deletingCommentId !== null}
                          aria-label={t("task.deleteComment")}
                          className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
                        >
                          {t("task.deleteComment")}
                        </button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <form
          onSubmit={addComment}
          className="flex items-end gap-2 border-t border-border pt-3"
        >
          <textarea
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder={t("task.writeComment")}
            aria-label={t("task.writeComment")}
            rows={2}
            maxLength={2000}
            className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={postingComment || !newComment.trim()}
          >
            {postingComment ? "…" : t("task.send")}
          </Button>
        </form>
      </section>
    </article>
  );
});
