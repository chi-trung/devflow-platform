import { useTranslation } from "react-i18next";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";

export type RecurrenceFrequencyValue = "Daily" | "Weekly" | "Monthly";

export interface RecurrenceDraft {
  enabled: boolean;
  frequency: RecurrenceFrequencyValue;
  interval: number;
  /** Local yyyy-mm-dd for the first due / seed date. */
  firstDueDate: string;
}

export function emptyRecurrenceDraft(firstDueDate = ""): RecurrenceDraft {
  return {
    enabled: false,
    frequency: "Weekly",
    interval: 1,
    firstDueDate,
  };
}

/** Round-trip helper: rule JSON → editable draft. */
export function recurrenceFromRule(rule: {
  frequency: string;
  interval: number;
  firstDueDateUtc: string;
}): RecurrenceDraft {
  const d = new Date(rule.firstDueDateUtc);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return {
    enabled: true,
    frequency: (rule.frequency as RecurrenceFrequencyValue) || "Weekly",
    interval: rule.interval,
    firstDueDate: `${y}-${m}-${day}`,
  };
}

/** Local date (noon) → ISO UTC, matching CreateTaskForm's due-date shape. */
export function firstDueIso(draft: RecurrenceDraft): string | null {
  if (!draft.enabled || !draft.firstDueDate) return null;
  return new Date(`${draft.firstDueDate}T12:00:00`).toISOString();
}

interface RecurrenceFieldsProps {
  draft: RecurrenceDraft;
  onChange: (next: RecurrenceDraft) => void;
  /** id prefix so multiple forms don't collide on htmlFor. */
  idPrefix?: string;
  /** When false, the enable checkbox is hidden (detail always has a rule). */
  showToggle?: boolean;
}

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none";

export function RecurrenceFields({
  draft,
  onChange,
  idPrefix = "recurrence",
  showToggle = true,
}: RecurrenceFieldsProps) {
  const { t } = useTranslation();
  const toggleId = `${idPrefix}-enabled`;
  const freqId = `${idPrefix}-frequency`;
  const intervalId = `${idPrefix}-interval`;
  const dueId = `${idPrefix}-first-due`;

  if (showToggle && !draft.enabled) {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          id={toggleId}
          type="checkbox"
          checked={false}
          onChange={() => onChange({ ...draft, enabled: true })}
          className="size-4 rounded border-border accent-[var(--color-primary,#0d9488)]"
        />
        {t("task.recurrence.enable")}
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-elevated/40 p-3">
      {showToggle && (
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            id={toggleId}
            type="checkbox"
            checked
            onChange={() => onChange({ ...draft, enabled: false })}
            className="size-4 rounded border-border accent-[var(--color-primary,#0d9488)]"
          />
          {t("task.recurrence.enable")}
        </label>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t("task.recurrence.frequency")} htmlFor={freqId}>
          <select
            id={freqId}
            value={draft.frequency}
            onChange={(event) =>
              onChange({
                ...draft,
                frequency: event.target.value as RecurrenceFrequencyValue,
              })
            }
            className={selectClass}
          >
            <option value="Daily">{t("task.recurrence.daily")}</option>
            <option value="Weekly">{t("task.recurrence.weekly")}</option>
            <option value="Monthly">{t("task.recurrence.monthly")}</option>
          </select>
        </Field>

        <Field label={t("task.recurrence.every")} htmlFor={intervalId}>
          <Input
            id={intervalId}
            type="number"
            min={1}
            max={365}
            value={draft.interval}
            onChange={(event) => {
              const n = Number(event.target.value);
              onChange({
                ...draft,
                interval: Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1,
              });
            }}
          />
        </Field>

        <Field label={t("task.recurrence.firstDue")} htmlFor={dueId}>
          <Input
            id={dueId}
            type="date"
            value={draft.firstDueDate}
            onChange={(event) =>
              onChange({ ...draft, firstDueDate: event.target.value })
            }
          />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("task.recurrence.summary", {
          interval: draft.interval,
          frequency: t(`task.recurrence.${draft.frequency.toLowerCase()}`),
        })}
      </p>
    </div>
  );
}
