import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Panel visibility — chips refetch whenever the dock opens so state and
   * the exclude-keys ring are fresh, not a one-shot from first mount. */
  open: boolean;
  onPick: (prompt: string) => void;
}

/** How many recently picked keys to demote on the next fetch. */
const RECENT_USED_LIMIT = 8;
/** Recency window for the used-key ring (ms). */
const RECENT_USED_TTL_MS = 30 * 60 * 1000;
const USED_KEY_PREFIX = "devflow.aiSuggestUsed.";

interface UsedEntry {
  key: string;
  at: number;
}

function usedStorageKey(workspaceId: string): string {
  return `${USED_KEY_PREFIX}${workspaceId}`;
}

function readUsedKeys(workspaceId: string): string[] {
  try {
    const raw = localStorage.getItem(usedStorageKey(workspaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RECENT_USED_TTL_MS;
    return parsed
      .filter(
        (entry): entry is UsedEntry =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as UsedEntry).key === "string" &&
          typeof (entry as UsedEntry).at === "number" &&
          (entry as UsedEntry).at >= cutoff,
      )
      .slice(-RECENT_USED_LIMIT)
      .map((entry) => entry.key);
  } catch {
    return [];
  }
}

function recordUsedKey(workspaceId: string, key: string): void {
  try {
    const existing = readUsedKeys(workspaceId);
    const next: UsedEntry[] = [
      ...existing.map((k) => ({ key: k, at: Date.now() - 1 })),
      { key, at: Date.now() },
    ].slice(-RECENT_USED_LIMIT);
    localStorage.setItem(usedStorageKey(workspaceId), JSON.stringify(next));
  } catch {
    // Private mode / quota — exclusion is best-effort only.
  }
}

/**
 * Context-aware prompt chips shown when the assistant panel opens. Suggestions
 * are fetched from the backend, which scores them against project state
 * (sprint, due dates, blockers, epics…) and the current page, then demotes
 * keys the user just picked so reopening the dock yields a different set.
 * Falls back to a small rotating set of generic chips if the endpoint fails.
 */
export function AiSuggestedPrompts({
  workspaceId,
  projectId,
  epicId,
  context,
  open,
  onPick,
}: AiSuggestedPromptsProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  // Track picks without putting onPick in the fetch effect deps (parent
  // handlers are often re-created each render).
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    // Dock stays mounted while closed — only refresh when actually open so
    // we don't spam the endpoint on every Nav↔AI flip through nav mode.
    if (!open) return;

    let cancelled = false;
    const excludeKeys = readUsedKeys(workspaceId);

    aiSuggest(workspaceId, projectId, context, epicId, excludeKeys)
      .then((items) => {
        if (!cancelled) setSuggestions(items ?? []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, projectId, context, epicId]);

  const handlePick = useCallback(
    (prompt: string, key: string | undefined) => {
      if (key) recordUsedKey(workspaceId, key);
      onPickRef.current(prompt);
    },
    [workspaceId],
  );

  const prompts =
    suggestions.length > 0 ? suggestions : fallbackPrompts(context);
  // UI shows at most four chips; the backend may return a larger pool so
  // exclude-keys + time rotation still have material to work with.
  const visible = prompts.slice(0, 4);

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" aria-hidden />
        {t("ai.assistantSuggestions")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((prompt, i) => (
          <button
            key={prompt.key ?? `fb-${i}`}
            type="button"
            onClick={() =>
              handlePick(t(prompt.key, prompt.args ?? {}), prompt.key)
            }
            className="cursor-pointer rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-xs text-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary-strong"
          >
            {t(prompt.key, prompt.args ?? {})}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Static fallback chips used when the suggest endpoint is unavailable.
 * Order rotates on a 6-hour bucket so the failure path is not frozen either.
 */
function fallbackPrompts(context: AiPageContext): AiSuggestion[] {
  const base: AiSuggestion[] =
    context === "workspace"
      ? [
          { key: "ai.suggestCreateProject" },
          { key: "ai.suggestCreateTask" },
          { key: "ai.suggestPlanMilestones" },
          { key: "ai.suggestCreateEpic" },
        ]
      : [
          { key: "ai.suggestCreateSprint" },
          { key: "ai.suggestCreateTask" },
          { key: "ai.suggestCreateEpic" },
          { key: "ai.suggestPlanMilestones" },
        ];

  const bucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  const offset = bucket % base.length;
  return [...base.slice(offset), ...base.slice(0, offset)];
}
