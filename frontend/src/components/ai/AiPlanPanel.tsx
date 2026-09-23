import { useCallback, useEffect, useRef, useState } from "react";
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

/** Max textarea height before it starts scrolling internally (4 rows). */
const MAX_COMPOSER_ROWS = 4;

/** Static preset focuses — task-scoped, not context-scoped (no aiSuggest). */
const PRESET_KEYS = [
  "ai.planPresetBreakdown",
  "ai.planPresetAcceptance",
  "ai.planPresetRisks",
  "ai.planPresetSpike",
  "ai.planPresetPrioritize",
  "ai.planPresetEstimate",
] as const;

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  /** Free-form focus the user last sent (or a preset chip filled). */
  const [promptDraft, setPromptDraft] = useState("");
  /** Last focus used for generate/regenerate — chips set it, send sets it. */
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const loadPlan = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLoadError(null);
    getLatestAiPlan(workspaceId, projectId, taskId)
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch(() => {
        if (!cancelled) {
          // Unknown is NOT "no plan yet": without this the panel renders the
          // fresh-task state, hiding Apply/Regenerate for a plan that exists
          // and offering only "Ask AI to plan", whose generate would
          // overwrite it. Name the failed read and allow a retry.
          setPlan(null);
          setLoadError(t("ai.planLoadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, taskId, t]);

  useEffect(() => {
    const cleanup = loadPlan();
    return cleanup;
  }, [loadPlan, taskId, loadTick]);

  async function generate(prompt?: string | null) {
    const focus = (prompt ?? lastPrompt ?? promptDraft).trim() || null;
    setGenerating(true);
    setError(null);
    setLastPrompt(focus);
    try {
      const data = await planAiTask(workspaceId, projectId, taskId, focus);
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

  function autoGrowComposer() {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxPx = MAX_COMPOSER_ROWS * 20 + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }

  function handleChip(presetKey: (typeof PRESET_KEYS)[number]) {
    const text = t(presetKey);
    setPromptDraft(text);
    setLastPrompt(text);
    void generate(text);
  }

  function handleSend() {
    const text = promptDraft.trim();
    if (!text || generating) return;
    void generate(text);
  }

  // Plan DoD items are plain criteria strings (the "- [ ]" checkbox form is
  // only added when the plan is applied to the task), so there is nothing to
  // count as checked here — the panel just previews the list.

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

      {loadError && (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <ErrorAlert id="aiplanpanel-load-error" message={loadError} />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLoadTick((n) => n + 1)}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Generate UI when no plan exists: preset chips + free composer.
          The whole block stays gated on !loadError so a failed read never
          offers an overwrite button (see swallowedReads contract). */}
      {!loading && !plan && !generating && !loadError && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleChip(key)}
                className="cursor-pointer rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-xs text-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary-strong"
              >
                {t(key)}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-primary/50">
            <textarea
              ref={composerRef}
              value={promptDraft}
              rows={1}
              onChange={(event) => {
                setPromptDraft(event.target.value);
                autoGrowComposer();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t("ai.planPlaceholder")}
              aria-label={t("ai.planPlaceholder")}
              className="max-h-[80px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-sm leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="button"
              aria-label={t("ai.planSend")}
              disabled={!promptDraft.trim()}
              onClick={handleSend}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary text-on-primary transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="size-4" aria-hidden />
            </button>
          </div>

          {/* Plain "Ask AI" still works with no focus (prompt omitted). */}
          <Button onClick={() => generate(null)} variant="outline" size="sm">
            <Sparkles className="mr-1.5 size-4" aria-hidden />
            {t("ai.askAiToPlan")}
          </Button>
        </div>
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
              </p>
              <ul role="list" className="space-y-0.5">
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
              onClick={() => generate(lastPrompt)}
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
