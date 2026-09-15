import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ListPlus, Trash2 } from "lucide-react";
import { createCustomField, deleteCustomField, getCustomFields } from "../../lib/api";
import { useToast } from "../ui/ToastProvider";
import { ErrorAlert } from "../ui/ErrorAlert";
import type { CustomFieldResponse } from "../../types/api";

const FIELD_TYPES = ["text", "number", "date", "select"] as const;

interface CustomFieldsCardProps {
  workspaceId: string;
  projectId: string;
  onChanged: () => void;
}

export function CustomFieldsCard({ workspaceId, projectId, onChanged }: CustomFieldsCardProps) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<CustomFieldResponse[] | null>(null);
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>("text");
  const [options, setOptions] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  // List failure must not collapse into the "no fields" empty state — that
  // invites recreating fields that already exist server-side.
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    getCustomFields(workspaceId, projectId)
      .then((loaded) => {
        if (!cancelled) setFields(loaded);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, reloadKey]);

  async function refresh() {
    try {
      const fresh = await getCustomFields(workspaceId, projectId);
      setFields(fresh);
    } catch {
      // Keep the last good list; a failed background refresh must not
      // wipe it into the "no fields" state.
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createCustomField(workspaceId, projectId, {
        name: trimmed,
        fieldType,
        options: fieldType === "select" ? options.trim() || null : null,
      });
      setName("");
      setOptions("");
      await refresh();
      onChanged();
      push(t("field.created"));
    } catch (err) {
      push(err instanceof Error ? err.message : t("field.createFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(field: CustomFieldResponse) {
    try {
      await deleteCustomField(workspaceId, projectId, field.id);
      setFields((current) => (current ?? []).filter((f) => f.id !== field.id));
      onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : t("field.deleteFailed"), "error");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListPlus className="size-4 text-primary" aria-hidden />
        <h3 className="font-display text-sm font-semibold">{t("field.customFields")}</h3>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          ({fields?.length ?? 0})
        </span>
      </div>

      <form onSubmit={handleCreate} className="mb-2 flex flex-wrap items-end gap-1.5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("field.fieldNamePlaceholder")}
          aria-label={t("field.fieldName")}
          maxLength={40}
          className="min-w-28 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <select
          value={fieldType}
          onChange={(event) =>
            setFieldType(event.target.value as (typeof FIELD_TYPES)[number])
          }
          aria-label={t("field.fieldType")}
          className="rounded-md border border-border bg-card px-1.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          {FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {fieldType === "select" && (
          <input
            value={options}
            onChange={(event) => setOptions(event.target.value)}
            placeholder={t("field.optionsPlaceholder")}
            aria-label={t("field.select")}
            maxLength={200}
            className="min-w-32 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        )}
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="shrink-0 rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium transition-colors duration-150 hover:border-primary disabled:opacity-40"
        >
          {t("common.create")}
        </button>
      </form>

      {loadError ? (
        <div className="flex flex-col items-start gap-2">
          <ErrorAlert message={t("field.loadFailed")} />
          <button
            type="button"
            onClick={() => setReloadKey((n) => n + 1)}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:border-primary"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : !fields ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("field.noFields")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {fields.map((field) => (
            <span
              key={field.id}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-xs"
            >
              <span className="font-medium">{field.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {field.fieldType}
                {field.options ? ` (${field.options.split(",").length})` : ""}
              </span>
              <button
                type="button"
                onClick={() => void handleDelete(field)}
                aria-label={t("field.deleteAria", { name: field.name })}
                className="rounded-full p-0.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
