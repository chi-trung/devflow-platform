import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { ErrorAlert } from "../ui/ErrorAlert";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/ToastProvider";
import {
  createRecurringRule,
  deleteRecurringRule,
  listRecurringRules,
  updateRecurringRule,
} from "../../lib/api";
import type { RecurringRuleResponse } from "../../types/api";
import {
  emptyRecurrenceDraft,
  firstDueIso,
  RecurrenceFields,
  recurrenceFromRule,
  type RecurrenceDraft,
} from "./RecurrenceFields";

interface TaskRecurrenceSectionProps {
  workspaceId: string;
  projectId: string;
  taskId: string;
  /** Seed title / priority when creating a new rule from this task. */
  seedTitle: string;
  seedPriority: RecurringRuleResponse["priority"];
  seedDueDateUtc: string | null;
  onRulesChanged?: () => void;
}

/**
 * Create / edit / delete the rule whose SeedTaskId is this task.
 * Fail-closed: a failed list never fabricates "no rule yet".
 */
export function TaskRecurrenceSection({
  workspaceId,
  projectId,
  taskId,
  seedTitle,
  seedPriority,
  seedDueDateUtc,
  onRulesChanged,
}: TaskRecurrenceSectionProps) {
  const { t } = useTranslation();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rule, setRule] = useState<RecurringRuleResponse | null>(null);
  const [draft, setDraft] = useState<RecurrenceDraft>(() =>
    emptyRecurrenceDraft(seedDueDateUtc ? seedDueDateUtc.slice(0, 10) : ""),
  );
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listRecurringRules(workspaceId, projectId)
      .then((rules) => {
        if (cancelled) return;
        const match = rules.find((r) => r.seedTaskId === taskId) ?? null;
        setRule(match);
        if (match) setDraft(recurrenceFromRule(match));
        else {
          setDraft(
            emptyRecurrenceDraft(
              seedDueDateUtc ? seedDueDateUtc.slice(0, 10) : "",
            ),
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("task.recurrence.loadFailed"));
        setRule(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, taskId, seedDueDateUtc, t]);

  useEffect(() => load(), [load]);

  async function save() {
    setSaving(true);
    setActionError(null);
    try {
      const firstDue = firstDueIso(draft);
      if (!firstDue) {
        setActionError(t("task.recurrence.firstDueRequired"));
        setSaving(false);
        return;
      }
      if (rule) {
        const updated = await updateRecurringRule(workspaceId, projectId, rule.id, {
          title: rule.title,
          description: rule.description,
          priority: rule.priority,
          frequency: draft.frequency,
          interval: draft.interval,
          firstDueDateUtc: firstDue,
          isActive: rule.isActive,
        });
        setRule(updated);
        setDraft(recurrenceFromRule(updated));
        push(t("task.recurrence.updated"));
      } else {
        const created = await createRecurringRule(workspaceId, projectId, {
          title: seedTitle,
          description: null,
          priority: seedPriority,
          frequency: draft.frequency,
          interval: draft.interval,
          firstDueDateUtc: firstDue,
          seedTaskId: taskId,
        });
        setRule(created);
        setDraft(recurrenceFromRule(created));
        push(t("task.recurrence.created"));
        onRulesChanged?.();
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("task.recurrence.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!rule) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = await updateRecurringRule(workspaceId, projectId, rule.id, {
        title: rule.title,
        description: rule.description,
        priority: rule.priority,
        frequency: rule.frequency as RecurrenceDraft["frequency"],
        interval: rule.interval,
        firstDueDateUtc: rule.firstDueDateUtc,
        isActive: !rule.isActive,
      });
      setRule(updated);
      setDraft(recurrenceFromRule(updated));
      push(updated.isActive ? t("task.recurrence.resumed") : t("task.recurrence.paused"));
      onRulesChanged?.();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("task.recurrence.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!rule) return;
    setSaving(true);
    setActionError(null);
    try {
      await deleteRecurringRule(workspaceId, projectId, rule.id);
      setRule(null);
      setDraft(
        emptyRecurrenceDraft(seedDueDateUtc ? seedDueDateUtc.slice(0, 10) : ""),
      );
      push(t("task.recurrence.deleted"));
      onRulesChanged?.();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("task.recurrence.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  // Fail-closed: list error → banner, never "no rule".
  if (loading && !rule && error === null) {
    return <Skeleton className="h-28 w-full" />;
  }
  if (error !== null && rule === null && loading === false) {
    return (
      <div className="flex flex-col gap-2">
        <ErrorAlert id="task-recurrence-load-error" message={error} />
        <Button variant="outline" size="sm" onClick={load}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {rule
          ? rule.isActive
            ? t("task.recurrence.nextOccurrence", {
                date: new Date(rule.nextOccurrenceUtc).toLocaleDateString(),
              })
            : t("task.recurrence.inactive")
          : t("task.recurrence.noneYet")}
      </p>

      <RecurrenceFields
        draft={draft}
        onChange={setDraft}
        idPrefix="task-recurrence"
        showToggle={rule === null}
      />

      {actionError && <ErrorAlert message={actionError} />}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? t("task.recurrence.saving") : rule ? t("common.save") : t("task.recurrence.create")}
        </Button>
        {rule && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void toggleActive()}
              disabled={saving}
            >
              {rule.isActive ? t("task.recurrence.pause") : t("task.recurrence.resume")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void remove()}
              disabled={saving}
            >
              {t("task.recurrence.delete")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
