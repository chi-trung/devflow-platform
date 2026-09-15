import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListPlus } from "lucide-react";
import { getCustomFields, getTaskFieldValues, setTaskFieldValue } from "../../lib/api";
import { ErrorAlert } from "../ui/ErrorAlert";
import type { CustomFieldResponse } from "../../types/api";

interface TaskFieldsSectionProps {
  workspaceId: string;
  projectId: string;
  taskId: string;
}

export function TaskFieldsSection({ workspaceId, projectId, taskId }: TaskFieldsSectionProps) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<CustomFieldResponse[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  // A failed values GET used to fabricate an empty map; inputs rendered
  // blank and the blur-to-save path then PUT null over fields the server
  // still holds. Track the failure instead and keep the inputs dead.
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    Promise.all([
      getCustomFields(workspaceId, projectId),
      getTaskFieldValues(workspaceId, projectId, taskId),
    ])
      .then(([fieldList, valueList]) => {
        if (cancelled) return;
        setFields(fieldList);
        const map: Record<string, string> = {};
        for (const entry of valueList) {
          if (entry.value != null) map[entry.fieldId] = entry.value;
        }
        setValues(map);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, taskId, reloadKey]);

  if (loadError) {
    return (
      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <ListPlus className="size-4 text-muted-foreground" aria-hidden />
          {t("fields.taskFieldsTitle")}
        </h3>
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
      </section>
    );
  }

  if (fields !== null && fields.length === 0) return null;

  async function save(field: CustomFieldResponse, rawValue: string) {
    const value = rawValue.trim() === "" ? null : rawValue.trim();
    setSavingId(field.id);
    try {
      await setTaskFieldValue(workspaceId, projectId, taskId, field.id, value);
      setSaveError(null);
    } catch {
      // The optimistic local value is now NOT on the server — say so once,
      // loudly, instead of the old silent catch that let it look saved.
      setSaveError(field.id);
    } finally {
      setSavingId(null);
    }
  }

  function renderInput(field: CustomFieldResponse) {
    const current = values[field.id] ?? "";
    const baseClass =
      "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm focus:border-primary focus:outline-none";
    if (field.fieldType === "select" && field.options) {
      const options = field.options.split(",").map((o) => o.trim()).filter(Boolean);
      return (
        <select
          value={current}
          onChange={(event) => {
            setValues((v) => ({ ...v, [field.id]: event.target.value }));
            void save(field, event.target.value);
          }}
          className={baseClass}
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    if (field.fieldType === "date") {
      return (
        <input
          type="date"
          value={current.slice(0, 10)}
          onChange={(event) => {
            setValues((v) => ({ ...v, [field.id]: event.target.value }));
            void save(field, event.target.value);
          }}
          className={baseClass}
        />
      );
    }
    return (
      <input
        type={field.fieldType === "number" ? "number" : "text"}
        value={current}
        onChange={(event) => setValues((v) => ({ ...v, [field.id]: event.target.value }))}
        onBlur={(event) => void save(field, event.target.value)}
        className={baseClass}
      />
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <ListPlus className="size-4 text-muted-foreground" aria-hidden />
        {t("fields.taskFieldsTitle")}
        {savingId && (
          <span className="font-mono text-[10px] text-muted-foreground">{t("fields.saving")}</span>
        )}
      </h3>

      {!fields ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {fields.map((field) => (
            <label key={field.id} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {field.name}
              {renderInput(field)}
            </label>
          ))}
        </div>
      )}
      {saveError && <ErrorAlert message={t("field.valueSaveFailed")} />}
    </section>
  );
}
