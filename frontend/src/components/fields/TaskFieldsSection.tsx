import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { getCustomFields, getTaskFieldValues, setTaskFieldValue } from "../../lib/api";
import type {
  CustomFieldResponse,
  CustomFieldValueResponse,
} from "../../types/api";

interface TaskFieldsSectionProps {
  workspaceId: string;
  projectId: string;
  taskId: string;
}

export function TaskFieldsSection({ workspaceId, projectId, taskId }: TaskFieldsSectionProps) {
  const [fields, setFields] = useState<CustomFieldResponse[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCustomFields(workspaceId, projectId).catch(() => [] as CustomFieldResponse[]),
      getTaskFieldValues(workspaceId, projectId, taskId).catch(
        () => [] as CustomFieldValueResponse[],
      ),
    ]).then(([fieldList, valueList]) => {
      if (cancelled) return;
      setFields(fieldList);
      const map: Record<string, string> = {};
      for (const entry of valueList) {
        if (entry.value != null) map[entry.fieldId] = entry.value;
      }
      setValues(map);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, taskId]);

  if (fields !== null && fields.length === 0) return null;

  async function save(field: CustomFieldResponse, rawValue: string) {
    const value = rawValue.trim() === "" ? null : rawValue.trim();
    setSavingId(field.id);
    try {
      await setTaskFieldValue(workspaceId, projectId, taskId, field.id, value);
    } catch {
      // keep silent — value stays editable
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
        Fields
        {savingId && (
          <span className="font-mono text-[10px] text-muted-foreground">saving…</span>
        )}
      </h3>

      {!fields ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
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
    </section>
  );
}
