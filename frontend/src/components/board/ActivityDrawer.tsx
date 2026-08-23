import { useTranslation } from "react-i18next";
import { History, X } from "lucide-react";
import type { ActivityResponse } from "../../types/api";
import { Avatar } from "../ui/Avatar";

interface ActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  activities: ActivityResponse[] | null;
  loading: boolean;
}

export function ActivityDrawer({
  open,
  onClose,
  activities,
  loading,
}: ActivityDrawerProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-xs">
      <div className="flex w-full max-w-md flex-col bg-surface border-l border-border shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" aria-hidden />
            <h2 className="font-display font-semibold text-foreground">
              {t("activity.projectActivity")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && !activities ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="size-8 rounded-full bg-elevated shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-elevated rounded w-3/4" />
                    <div className="h-3 bg-elevated rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !activities || activities.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("activity.noActivity")}
            </div>
          ) : (
            activities.map((act) => {
              const dateStr = new Date(act.createdAtUtc).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={act.id}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-elevated/40 p-3 text-sm"
                >
                  <Avatar name={act.actorName} size="sm" />
                  <div className="flex-1 space-y-1">
                    <p className="text-foreground leading-snug">
                      <span className="font-semibold">{act.actorName}</span>{" "}
                      <span className="text-muted-foreground">{act.action}</span>{" "}
                      {act.target && (
                        <span className="font-medium text-primary">
                          "{act.target}"
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {dateStr}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
