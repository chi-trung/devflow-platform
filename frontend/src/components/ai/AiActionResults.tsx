import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, SkipForward, AlertCircle } from "lucide-react";
import type { AiActionStatus, ExecutedAction } from "../../types/api";

interface AiActionResultsProps {
  summary: string | null;
  actions: ExecutedAction[];
  error: string | null;
}

const STATUS_ICONS: Record<AiActionStatus, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />,
  failed: <XCircle className="size-4 text-red-500" aria-hidden />,
  skipped: <SkipForward className="size-4 text-amber-500" aria-hidden />,
};

const STATUS_COLORS: Record<AiActionStatus, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
  skipped: "text-amber-600 dark:text-amber-400",
};

export function AiActionResults({
  summary,
  actions,
  error,
}: AiActionResultsProps) {
  const { t } = useTranslation();

  const successCount = useMemo(
    () => actions.filter((a) => a.status === "success").length,
    [actions],
  );

  if (error && actions.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (actions.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-sm">
      {summary && (
        <p className="font-medium text-foreground">{summary}</p>
      )}

      <div className="space-y-1.5">
        {actions.map((action, i) => (
          <div
            key={`${action.type}-${i}`}
            className="flex items-start gap-2"
          >
            <span className="mt-0.5 shrink-0">
              {STATUS_ICONS[action.status]}
            </span>
            <div className="min-w-0 flex-1">
              <span
                className={`text-xs font-medium uppercase tracking-wide ${STATUS_COLORS[action.status]}`}
              >
                {action.status === "success"
                  ? t("ai.actionStatusOk")
                  : action.status === "failed"
                    ? t("ai.actionStatusFail")
                    : t("ai.actionStatusSkip")}
              </span>{" "}
              <span className="text-foreground">{action.message ?? action.label}</span>
            </div>
          </div>
        ))}
      </div>

      {successCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("ai.actionCount", { count: successCount, total: actions.length })}
        </p>
      )}
    </div>
  );
}