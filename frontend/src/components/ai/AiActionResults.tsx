import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertCircle,
  Clock,
  Check,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import type { AiActionStatus, ExecutedAction, AiExecuteActionContract } from "../../types/api";

interface AiActionResultsProps {
  summary: string | null;
  actions: ExecutedAction[];
  error: string | null;
  /** Called when the user accepts a pending action. Receives the action
   * contract (from contract field) and its index in the actions array. */
  onAccept?: (action: AiExecuteActionContract, index: number) => void;
  /** Called when the user rejects a pending action. */
  onReject?: (index: number) => void;
  /** Index of the action currently being accepted (disabled during the
   * request). */
  pendingAccepting?: number | null;
}

const STATUS_ICONS: Record<AiActionStatus, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />,
  failed: <XCircle className="size-4 text-red-500" aria-hidden />,
  skipped: <SkipForward className="size-4 text-amber-500" aria-hidden />,
  pending: <Clock className="size-4 text-amber-500" aria-hidden />,
};

const STATUS_COLORS: Record<AiActionStatus, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
  skipped: "text-amber-600 dark:text-amber-400",
  pending: "text-amber-600 dark:text-amber-400",
};

export function AiActionResults({
  summary,
  actions,
  error,
  onAccept,
  onReject,
  pendingAccepting,
}: AiActionResultsProps) {
  const { t } = useTranslation();

  const successCount = useMemo(
    () => actions.filter((a) => a.status === "success").length,
    [actions],
  );
  const pendingCount = useMemo(
    () => actions.filter((a) => a.status === "pending").length,
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

  if (actions.length === 0) {
    // Conversational reply — the model answered a question instead of
    // performing actions. Surface the summary text as a plain answer.
    if (summary) {
      return (
        <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
          {summary}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-sm">
      {summary && (
        <p className="font-medium text-foreground">{summary}</p>
      )}

      <div className="space-y-1.5">
        {actions.map((action, i) => {
          if (action.status === "pending") {
            const isAccepting = pendingAccepting === i;
            return (
              <div
                key={`${action.type}-${i}`}
                className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 dark:border-amber-800 dark:bg-amber-950/20"
              >
                <div className="mb-2 flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">
                    {STATUS_ICONS[action.status]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      {t("ai.actionPending")}
                    </span>{" "}
                    <span className="text-foreground">{action.label}</span>
                    {action.message && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {action.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    disabled={isAccepting}
                    onClick={() => {
                      if (action.contract && onAccept) {
                        onAccept(action.contract, i);
                      }
                    }}
                  >
                    <Check className="size-3.5" aria-hidden />
                    {isAccepting
                      ? t("ai.accepting")
                      : t("ai.actionAccept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isAccepting}
                    onClick={() => onReject?.(i)}
                  >
                    <X className="size-3.5" aria-hidden />
                    {t("ai.actionReject")}
                  </Button>
                </div>
              </div>
            );
          }

          return (
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
          );
        })}
      </div>

      {successCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("ai.actionCount", { count: successCount, total: actions.length })}
        </p>
      )}
      {pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("ai.actionPendingDesc")}
        </p>
      )}
    </div>
  );
}