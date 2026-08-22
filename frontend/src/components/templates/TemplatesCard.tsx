import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FileStack, Play, Plus, Trash2 } from "lucide-react";
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
  getTemplates,
} from "../../lib/api";
import { useToast } from "../ui/ToastProvider";
import type { TemplateResponse } from "../../types/api";

interface TemplatesCardProps {
  workspaceId: string;
  projectId: string;
  onChanged: () => void;
}

export function TemplatesCard({ workspaceId, projectId, onChanged }: TemplatesCardProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateResponse[] | null>(null);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    getTemplates(workspaceId, projectId)
      .then((loaded) => {
        if (!cancelled) setTemplates(loaded);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createTemplate(workspaceId, projectId, {
        name: trimmed,
        priority,
      });
      setName("");
      const fresh = await getTemplates(workspaceId, projectId);
      setTemplates(fresh);
      push("Template created");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to create template.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleApply(template: TemplateResponse) {
    try {
      await applyTemplate(workspaceId, projectId, template.id);
      push(`Applied "${template.name}" — task created`);
      onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to apply template.", "error");
    }
  }

  async function handleDelete(template: TemplateResponse) {
    try {
      await deleteTemplate(workspaceId, projectId, template.id);
      setTemplates((current) => (current ?? []).filter((t) => t.id !== template.id));
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to delete template.", "error");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileStack className="size-4 text-primary" aria-hidden />
        <h3 className="font-display text-sm font-semibold">{t("template.taskTemplates")}</h3>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          ({templates?.length ?? 0})
        </span>
      </div>

      <form onSubmit={handleCreate} className="mb-2 flex items-end gap-1.5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("template.namePlaceholder")}
          aria-label="Template name"
          maxLength={60}
          className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        />
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          aria-label={t("template.defaultPriority")}
          className="rounded-md border border-border bg-card px-1.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          {["Low", "Medium", "High", "Critical"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium transition-colors duration-150 hover:border-primary disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden />
          {t("common.create")}
        </button>
      </form>

      {!templates ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("template.noTemplates")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {templates.map((template) => (
            <div
              key={template.id}
              className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{template.name}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {template.priority}
                  {template.estimateMinutes != null ? ` · ${template.estimateMinutes}m` : ""}
                  {template.description ? ` · ${template.description}` : ""}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => void handleApply(template)}
                  title="Create task from template"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium transition-colors duration-150 hover:border-primary hover:text-primary"
                >
                  <Play className="size-3" aria-hidden />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(template)}
                  aria-label={`Delete template ${template.name}`}
                  className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
