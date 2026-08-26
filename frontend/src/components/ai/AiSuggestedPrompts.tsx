import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

export type AiPageContext =
  | "board"
  | "sprints"
  | "epics"
  | "dashboard"
  | "workspace";

/**
 * Context-aware prompt chips shown when the assistant panel opens. They are
 * static suggestions matched to the current page — a light "guess what you're
 * about to do" without any LLM round-trip.
 */
export function AiSuggestedPrompts({
  context,
  onPick,
}: {
  context: AiPageContext;
  onPick: (prompt: string) => void;
}) {
  const { t } = useTranslation();

  const prompts = useMemo(() => {
    switch (context) {
      case "board":
        return [
          t("ai.assistantPromptBoard1"),
          t("ai.assistantPromptBoard2"),
          t("ai.assistantPromptBoard3"),
          t("ai.assistantPromptBoard4"),
        ];
      case "sprints":
        return [
          t("ai.assistantPromptSprints1"),
          t("ai.assistantPromptSprints2"),
        ];
      case "epics":
        return [t("ai.assistantPromptEpics1"), t("ai.assistantPromptEpics2")];
      case "dashboard":
        return [
          t("ai.assistantPromptBoard1"),
          t("ai.assistantPromptWorkspace1"),
        ];
      default:
        return [
          t("ai.assistantPromptWorkspace1"),
          t("ai.assistantPromptWorkspace2"),
        ];
    }
  }, [context, t]);

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" aria-hidden />
        {t("ai.assistantSuggestions")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="cursor-pointer rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-xs text-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
