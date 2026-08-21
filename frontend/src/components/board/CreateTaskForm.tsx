import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { ErrorAlert } from "../ui/ErrorAlert";
import type { TaskItemResponse } from "../../types/api";

interface CreateTaskFormProps {
  onCreate: (input: {
    title: string;
    description: string | null;
    priority: TaskItemResponse["priority"];
    dueDateUtc: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

export function CreateTaskForm({ onCreate, onCancel }: CreateTaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<TaskItemResponse["priority"]>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        dueDateUtc: dueDate
          ? new Date(`${dueDate}T12:00:00`).toISOString()
          : null,
      });
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setDueDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 rise"
      noValidate
    >
      {error && <ErrorAlert message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_150px_150px]">
        <Field label="Title" htmlFor="task-title">
          <Input
            id="task-title"
            placeholder="What needs to be done?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Priority" htmlFor="task-priority">
          <select
            id="task-priority"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as TaskItemResponse["priority"])
            }
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Critical</option>
          </select>
        </Field>

        <Field label="Due date" htmlFor="task-due">
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="task-desc">
        <Input
          id="task-desc"
          placeholder="Optional details…"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add task"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
