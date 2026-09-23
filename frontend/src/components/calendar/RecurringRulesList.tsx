import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Repeat } from "lucide-react";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ErrorAlert } from "../ui/ErrorAlert";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/ToastProvider";
import {
  deleteRecurringRule,
  listRecurringRules,
  updateRecurringRule,
} from "../../lib/api";
import type { RecurringRuleResponse } from "../../types/api";

interface RecurringRulesListProps {
  workspaceId: string;
  projectId: string;
  /** Bumped by the parent to force a reload (e.g. after create elsewhere). */
  refreshToken?: number;
}

/**
 * Calendar sidebar: project-wide recurring rules with pause / resume / delete.
 * Fail-closed: list error → ErrorAlert + retry, never EmptyState.
 */
export function RecurringRulesList({
  workspaceId,
  projectId,
  refreshToken = 0,
}: RecurringRulesListProps) {
  const { t } = useTranslation();
  const { push } = useToast();
  const [rules, setRules] = useState<RecurringRuleResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listRecurringRules(workspaceId, projectId)
      .then((data) => {
        if (!cancelled) setRules(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("calendar.rulesLoadFailed"));
          setRules(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, t]);

  useEffect(() => load(), [load, refreshToken]);

  async function toggleActive(rule: RecurringRuleResponse) {
    setBusyId(rule.id);
    try {
      const updated = await updateRecurringRule(workspaceId, projectId, rule.id, {
        title: rule.title,
        description: rule.description,
        priority: rule.priority,
        frequency: rule.frequency as RecurringRuleResponse["frequency"],
        interval: rule.interval,
        firstDueDateUtc: rule.firstDueDateUtc,
        isActive: !rule.isActive,
      });
      setRules((curr) =>
        curr ? curr.map((r) => (r.id === rule.id ? updated : r)) : curr,
      );
      push(updated.isActive ? t("task.recurrence.resumed") : t("task.recurrence.paused"));
    } catch (err) {
      push(
        err instanceof Error ? err.message : t("task.recurrence.saveFailed"),
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(rule: RecurringRuleResponse) {
    setBusyId(rule.id);
    try {
      await deleteRecurringRule(workspaceId, projectId, rule.id);
      setRules((curr) => (curr ? curr.filter((r) => r.id !== rule.id) : curr));
      push(t("task.recurrence.deleted"));
    } catch (err) {
      push(
        err instanceof Error ? err.message : t("task.recurrence.saveFailed"),
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading && rules === null && error === null) {
    return (
      <div className="space-y-2" role="status" aria-label={t("common.loading")}>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (error !== null && rules === null) {
    return (
      <div className="flex flex-col gap-2">
        <ErrorAlert id="calendar-rules-load-error" message={error} />
        <Button variant="outline" size="sm" onClick={load}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (rules !== null && rules.length === 0) {
    return (
      <EmptyState
        icon={<Repeat className="size-8" aria-hidden />}
        title={t("calendar.rulesEmptyTitle")}
        description={t("calendar.rulesEmptyDescription")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2" role="list">
      {(rules ?? []).map((rule) => (
        <li
          key={rule.id}
          className="rounded-lg border border-border bg-card p-3 text-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{rule.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("task.recurrence.every")} {rule.interval} ·{" "}
                {t(`task.recurrence.${rule.frequency.toLowerCase()}`)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {rule.isActive
                  ? t("calendar.rulesNext", {
                      date: new Date(rule.nextOccurrenceUtc).toLocaleDateString(),
                    })
                  : t("task.recurrence.inactive")}
              </p>
            </div>
            <span
              className={[
                "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase",
                rule.isActive
                  ? "bg-primary/10 text-primary-strong"
                  : "bg-elevated text-muted-foreground",
              ].join(" ")}
            >
              {rule.isActive ? t("task.recurrence.active") : t("task.recurrence.pausedShort")}
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === rule.id}
              onClick={() => void toggleActive(rule)}
            >
              {rule.isActive ? t("task.recurrence.pause") : t("task.recurrence.resume")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === rule.id}
              onClick={() => void remove(rule)}
            >
              {t("task.recurrence.delete")}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
