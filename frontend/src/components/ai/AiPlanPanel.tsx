import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { planAiTask, applyAiPlan, getLatestAiPlan } from "../../lib/api";
import { Button } from "../ui/Button";
import { ErrorAlert } from "../ui/ErrorAlert";
import type { AiPlanResponse } from "../../types/api";

interface AiPlanPanelProps {
  workspaceId: string;
  projectId: string;
  taskId: string;
  onChanged: () => void;
}

export function AiPlanPanel({
  workspaceId,
  projectId,
  taskId,
  onChanged,
}: AiPlanPanelProps) {
  const { t } = useTranslation();

  const [plan, setPlan] = useState<AiPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLatestAiPlan(workspaceId, projectId, taskId)
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch(() => {
        if (!cancelled) setPlan(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, taskId]);

  useEffect(() => {
    const cleanup = loadPlan();
    return cleanup;
  }, [loadPlan, taskId]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const data = await planAiTask(workspaceId, projectId, taskId);
      setPlan(data);
      if (data.applied) {
        onChanged();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ai.planFailed"));
    } finally {
      setGenerating(false);
    }
  }

  async function apply() {
    if (!plan || plan.applied) return;
    setApplying(true);
    setError(null);
    try {
      const data = await applyAiPlan(workspaceId, projectId, plan.id);
      setPlan(data);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ai.applyFailed"));
    } finally {
      setApplying(false);
    }
  }

  const checkedCount =
    plan?.definitionOfDone.filter((d) =>
      d.trim().startsWith("- [x]") || d.trim().startsWith("- [X]"),
    ).length ?? 0;
  const totalDoD = plan?.definitionOfDone.length ?? 0;
  const allMet = totalDoD > 0 && checkedCount === totalDoD;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Brain className="size-4 text-muted-foreground" aria-hidden />
          {t("ai.aiPlanner")}
        </h3>
        {plan && !plan.applied && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">
              <Clock className="size-3" aria-hidden />
              {t("ai.pending")}
            </span>
          </div>
        )}
        {plan?.applied && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-500">
            <CheckCircle2 className="size-3" aria-hidden />
            {t("ai.applied")}
          </span>
        )}
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Generate button when no plan exists */}
      {!loading && !plan && !generating && (
        <Button onClick={generate}>
          <Sparkles className="mr-1.5 size-4" aria-hidden />
          {t("ai.askAiToPlan")}
        </Button>
      )}

      {/* Generating state */}
      {generating && (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("ai.generating")}
        </div>
      )}

      {/* Plan display */}
      {plan && !generating && (
        <div className="flex flex-col gap-3">
          {/* Summary */}
          {plan.summary && (
            <p className="rounded-lg border border-border/60 bg-card p-2 text-sm text-foreground">
              {plan.summary}
            </p>
          )}

          {/* Steps */}
          {plan.steps.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ai.steps")}
              </p>
              <ol className="list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
                {plan.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Subtasks */}
          {plan.subtasks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ai.proposedSubtasks")}
              </p>
              <div className="flex flex-col gap-1">
                {plan.subtasks.map((subtask, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/60 bg-card p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {subtask.title}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1 py-0.5 font-mono text-[10px] ${
                          subtask.priority === "Critical"
                            ? "bg-destructive/10 text-destructive"
                            : subtask.priority === "High"
                              ? "bg-amber-500/10 text-amber-500"
                              : subtask.priority === "Medium"
                                ? "bg-sky-500/10 text-sky-500"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {subtask.priority}
                      </span>
                    </div>
                    {subtask.description && (
                      <p className="mt-1 text-muted-foreground">
                        {subtask.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Definition of Done */}
          {plan.definitionOfDone.length > 0 && (
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ai.dod")}
                {allMet && (
                  <span className="rounded bg-emerald-500/10 px-1 py-0.5 font-mono text-[10px] text-emerald-500">
                    {t("ai.allMet")}
                  </span>
                )}
              </p>
              <ul className="space-y-0.5">
                {plan.definitionOfDone.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className="mt-0.5 shrink-0">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!plan.applied && (
              <Button onClick={apply} disabled={applying} size="sm">
                {applying ? t("ai.applying") : t("ai.applyPlan")}
              </Button>
            )}
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t("ai.regenerate")}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !plan && !generating && (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("common.loading")}
        </div>
      )}
    </section>
  );
}