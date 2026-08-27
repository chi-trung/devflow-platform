import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { aiSuggest } from "../../lib/api";
import type { AiSuggestion } from "../../types/api";

export type AiPageContext =
  | "board"
  | "sprints"
  | "epics"
  | "dashboard"
  | "workspace";

interface AiSuggestedPromptsProps {
  workspaceId: string;
  projectId?: string;
  epicId?: string | null;
  context: AiPageContext;
  onPick: (prompt: string) => void;
}

/**
 * Context-aware prompt chips shown when the assistant panel opens. Suggestions
 * are fetched from the backend, which grounds them in real project data (the
 * current sprint's name, unassigned task count, epics…) instead of static
 * text. Each suggestion is an i18n key + interpolation args, so chips render
 * in the user's language. Falls back to a small set of generic chips if the
 * suggest endpoint is unavailable or returns nothing.
 */
export function AiSuggestedPrompts({
  workspaceId,
  projectId,
  epicId,
  context,
  onPick,
}: AiSuggestedPromptsProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;

    aiSuggest(workspaceId, projectId, context, epicId)
      .then((items) => {
        if (!cancelled) setSuggestions(items ?? []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, context, epicId]);

  const prompts = suggestions.length > 0 ? suggestions : fallbackPrompts(context);

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" aria-hidden />
        {t("ai.assistantSuggestions")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((prompt, i) => (
          <button
            key={prompt.key ?? `fb-${i}`}
            type="button"
            onClick={() => onPick(t(prompt.key, prompt.args ?? {}))}
            className="cursor-pointer rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-xs text-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            {t(prompt.key, prompt.args ?? {})}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Static fallback chips used when the suggest endpoint is unavailable. */
function fallbackPrompts(context: AiPageContext): AiSuggestion[] {
  if (context === "workspace") {
    return [
      { key: "ai.suggestCreateProject" },
      { key: "ai.suggestCreateTask" },
      { key: "ai.suggestPlanMilestones" },
    ];
  }
  return [
    { key: "ai.suggestCreateTask" },
    { key: "ai.suggestCreateEpic" },
    { key: "ai.suggestPlanMilestones" },
  ];
}
