import { useTranslation } from "react-i18next";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatMinutes } from "../../lib/format";
import type { TeamReportResponse, WorkspaceMemberResponse } from "../../types/api";
import { Avatar } from "../ui/Avatar";

interface TeamReportCardsProps {
  data: TeamReportResponse;
  members: WorkspaceMemberResponse[];
  className?: string;
}

export function TeamReportCards({ data, members, className = "" }: TeamReportCardsProps) {
  const { t } = useTranslation();
  if (data.members.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        {t("reports.noTeamActivity")}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <Users className="size-4 text-primary" aria-hidden />
          {t("reports.teamWorkload")}
        </h3>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {t("reports.tasksDone", { done: data.totalCompleted, total: data.totalTasks })} ·{" "}
          {formatMinutes(data.totalMinutesLogged)} {t("timeTracking.logged")}
        </span>
      </div>

      {/* Trend summary */}
      {data.trends && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            {data.trends.completedDelta > 0 ? (
              <TrendingUp className="size-4 text-green-500" aria-hidden />
            ) : data.trends.completedDelta < 0 ? (
              <TrendingDown className="size-4 text-red-500" aria-hidden />
            ) : (
              <Minus className="size-4 text-muted-foreground" aria-hidden />
            )}
            <span className="font-mono text-xs">
              {t("reports.vsPrevSprint")}:{" "}
              <span className={data.trends.completedDelta > 0 ? "text-green-500" : data.trends.completedDelta < 0 ? "text-red-500" : ""}>
                {data.trends.completedDelta > 0 ? "+" : ""}{data.trends.completedDelta} {t("reports.completedLower")}
              </span>
            </span>
          </div>
          {data.trends.cycleTimeDelta !== null && (
            <div className="flex items-center gap-1.5">
              {data.trends.cycleTimeDelta < 0 ? (
                <TrendingUp className="size-4 text-green-500" aria-hidden />
              ) : data.trends.cycleTimeDelta > 0 ? (
                <TrendingDown className="size-4 text-red-500" aria-hidden />
              ) : (
                <Minus className="size-4 text-muted-foreground" aria-hidden />
              )}
              <span className="font-mono text-xs">
                Cycle time:{" "}
                <span className={data.trends.cycleTimeDelta < 0 ? "text-green-500" : data.trends.cycleTimeDelta > 0 ? "text-red-500" : ""}>
                  {data.trends.cycleTimeDelta > 0 ? "+" : ""}{data.trends.cycleTimeDelta?.toFixed(1)}d
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Member table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated/50">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">{t("reports.member")}</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">{t("reports.completed")}</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">{t("reports.inProgress")}</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">{t("reports.avgCycleTime")}</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">{t("reports.assigned")}</th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((member) => {
              const profile = members.find((m) => m.userId === member.userId);
              const name = profile?.displayName || member.userName || profile?.username || t("common.member");
              return (
                <tr key={member.userId} className="border-b border-border last:border-0 hover:bg-elevated/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={name} id={member.userId} />
                      <span className="font-medium">{name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{member.tasksCompleted}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{member.inProgressCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {member.avgCycleTimeDays !== null ? `${member.avgCycleTimeDays}d` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{member.tasksAssigned}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
