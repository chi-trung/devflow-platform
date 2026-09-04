import { useTranslation } from "react-i18next";
import { useState, type FormEvent } from "react";
import { Check, Clock, Link2, Hash, ListChecks, Plus, X } from "lucide-react";
import type { TaskItemResponse, WorkspaceMemberResponse, CustomFieldValueResponse } from "../../types/api";
import { formatMinutes } from "../../lib/format";
import { Avatar } from "../ui/Avatar";
import { EstimationModal } from "../estimation/EstimationModal";
import { api } from "../../lib/api";
import { useAttachmentPreviews, ThumbnailStrip } from "./AttachmentThumbnails";

const priorityDot: Record<TaskItemResponse["priority"], string> = {
  Critical: "bg-destructive",
  High: "bg-amber-300",
  Medium: "bg-primary",
  Low: "bg-muted-foreground/50",
};

const priorityLabelKey: Record<TaskItemResponse["priority"], string> = {
  Critical: "task.urgent",
  High: "task.high",
  Medium: "task.medium",
  Low: "task.low",
};

interface TaskCardProps {
  task: TaskItemResponse;
  members: WorkspaceMemberResponse[];
  /** Pre-fetched custom-field values for this task (from the project-wide batch). */
  customFieldValues?: CustomFieldValueResponse[];
  onDelete: (task: TaskItemResponse) => void;
  onSelect: (taskId: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  workspaceId: string;
  projectId: string;
  onEstimationSaved?: (taskId: string, storyPoints: number | null) => void;
}

export function TaskCard({
  task,
  members,
  customFieldValues,
  onDelete,
  onSelect,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  workspaceId,
  projectId,
  onEstimationSaved,
}: TaskCardProps) {
  const { t } = useTranslation();
  const assignee = members.find((m) => m.userId === task.assigneeId);
  const overdue =
    task.dueDateUtc !== null &&
    task.status !== "Done" &&
    new Date(task.dueDateUtc).getTime() < Date.now();
  // Definition of Done: all "- [x]" checklist items are ticked (and there is
  // at least one item). A bare text DoD without items never shows as "met".
  const dodItems = (task.definitionOfDone ?? "")
    .split("\n")
    .filter((line) => /^- \[.\]/.test(line));
  const dodMet =
    dodItems.length > 0 &&
    dodItems.every((line) => /^- \[x\]/i.test(line));
  const [estimationOpen, setEstimationOpen] = useState(false);
  const [showChildForm, setShowChildForm] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [addingChild, setAddingChild] = useState(false);

  const previews = useAttachmentPreviews({
    workspaceId,
    projectId,
    taskId: task.id,
    previews: task.attachmentSummary?.previews,
  });

  const customFields = customFieldValues ?? [];

  async function handleEstimationSaved(storyPoints: number | null) {
    onEstimationSaved?.(task.id, storyPoints);
  }

  async function handleAddChild(event: FormEvent) {
    event.preventDefault();
    const title = childTitle.trim();
    if (!title) return;
    setAddingChild(true);
    try {
      await api(`/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}/subtasks`, {
        method: "POST",
        body: JSON.stringify({ title, description: null, priority: "Medium" }),
      });
      setChildTitle("");
      setShowChildForm(false);
      onEstimationSaved?.(task.id, null);
    } catch {
      // keep form open on error
    } finally {
      setAddingChild(false);
    }
  }

  return (
    <div
      draggable
      data-task-id={task.id}
      onClick={() => onSelect(task.id)}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add("opacity-40");
      }}
      onDragEnd={(event) => {
        event.currentTarget.classList.remove("opacity-40");
      }}
      className={`group cursor-grab rounded-lg border bg-card p-3 transition-all duration-200 hover:bg-elevated active:cursor-grabbing active:scale-[0.99] ${
        selected
          ? "border-primary ring-1 ring-primary/40"
          : "border-border hover:border-border-strong"
      }`}
      aria-label={t("taskCard.aria", { title: task.title })}
    >
      <div className="flex items-start justify-between gap-2">
        {(selectionMode || selected) && onToggleSelect && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={t("taskCard.selectAria", { title: task.title })}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect(task.id);
            }}
            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-strong bg-surface hover:border-primary"
            }`}
          >
            {selected && <Check className="size-3" strokeWidth={3} aria-hidden />}
          </button>
        )}
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug truncate">{task.title}</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(task);
          }}
          aria-label={t("taskCard.deleteAria", { title: task.title })}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all duration-150 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className={`size-1.5 rounded-full ${priorityDot[task.priority]}`} aria-hidden />
          {t(priorityLabelKey[task.priority])}
        </span>
        {task.storyPoints != null && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setEstimationOpen(true);
            }}
            className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary transition-colors duration-150 hover:bg-primary/20"
            title={t("estimation.title")}
          >
            <Hash className="size-3" aria-hidden />
            {task.storyPoints}
          </button>
        )}
        {task.dueDateUtc && (
          <time
            title={overdue ? t("taskCard.overdue") : undefined}
            className={`font-mono text-[11px] ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}
          >
            {new Date(task.dueDateUtc).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
        {task.isBlocked && (
          <span
            title={t("task.blockedByDependencies")}
            className="flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-destructive"
          >
            <Link2 className="size-3" aria-hidden />
            {t("task.blocked")}
          </span>
        )}
        {(task.totalLoggedMinutes ?? 0) > 0 && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {formatMinutes(task.totalLoggedMinutes ?? 0)}
          </span>
        )}
        {(task.subtaskCount ?? 0) > 0 && (
          <span
            title={t("subtask.nestedCount", { count: task.subtaskCount })}
            className="flex items-center gap-1 rounded-md bg-muted-foreground/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
          >
            <ListChecks className="size-3" aria-hidden />
            {task.subtaskCount}
          </span>
        )}
        {dodMet && (
          <span
            title={t("board.dodMet")}
            className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-500"
          >
            <Check className="size-3" aria-hidden />
            {t("board.dodMet")}
          </span>
        )}
        {(customFields ?? [])
          .filter((field) => field.value != null && field.value !== "")
          .slice(0, 3)
          .map((field) => (
            <span
              key={field.fieldId}
              title={`${field.fieldName}: ${field.value}`}
              className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {field.fieldName}: {field.value}
            </span>
          ))}
        {showChildForm ? (
          <form
            onSubmit={handleAddChild}
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="text"
              value={childTitle}
              onChange={(event) => setChildTitle(event.target.value)}
              placeholder={t("board.childTaskPlaceholder")}
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-1.5 py-1 text-xs placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={addingChild || !childTitle.trim()}
              className="rounded-md border border-border px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
            >
              {addingChild ? t("board.addingChild") : <Plus className="size-3" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowChildForm(false);
                setChildTitle("");
              }}
              className="rounded-md p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" aria-hidden />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowChildForm(true);
            }}
            aria-label={t("board.addChildTaskAria")}
            title={t("board.addChildTask")}
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-all duration-150 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Plus className="size-3" aria-hidden />
          </button>
        )}
        {assignee && (
          <span
            className="ml-auto"
            title={t("taskCard.assigneeAria", {
              name: assignee.displayName || assignee.username,
            })}
          >
            <Avatar name={assignee.displayName || assignee.username} id={assignee.userId} />
          </span>
        )}
      </div>

      {task.attachmentSummary && task.attachmentSummary.count > 0 && (
        <ThumbnailStrip
          previews={previews}
          count={task.attachmentSummary.count}
        />
      )}

      <EstimationModal
        open={estimationOpen}
        onClose={() => setEstimationOpen(false)}
        workspaceId={workspaceId}
        projectId={projectId}
        taskId={task.id}
        currentEstimate={task.storyPoints ?? null}
        onSaved={handleEstimationSaved}
      />
    </div>
  );
}
