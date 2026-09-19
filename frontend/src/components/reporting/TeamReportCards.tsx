import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatMinutes } from "../../lib/format";
import type { TeamReportResponse, WorkspaceMemberResponse } from "../../types/api";
import { EmptyState } from "../ui/EmptyState";
import { Avatar } from "../ui/Avatar";

interface TeamReportCardsProps {
  data: TeamReportResponse;
  members: WorkspaceMemberResponse[];
  className?: string;
}

// Test-only render counter. ReportsPage re-renders on every keystroke in the
// from/to date inputs, and this body scanned the whole workspace roster once
// per report member (a linear lookup inside the row map) on each of those
// renders. (See FilterBar / SprintBar / SprintBoard / Column for the pattern.)
let __renders = 0;
export function __teamReportCardsRenders(): number { return __renders; }
export function __resetTeamReportCardsRenders(): void { __renders = 0; }

export const TeamReportCards = memo(function TeamReportCards({ data, members, className = "" }: TeamReportCardsProps) {
  __renders++;
  const { t } = useTranslation();

  // Looked up per row instead of scanning the roster per row: the body used to
  // do a linear search of `members` for every report member,
  // O(reportMembers x workspaceMembers) on every parent re-render. A Map build
  // is O(members) and each row is O(1).
  const profilesByUserId = useMemo(() => {
    const map = new Map<string, WorkspaceMemberResponse>();
    for (const member of members) {
      map.set(member.userId, member);
    }
    return map;
  }, [members]);

  if (data.members.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          icon={<Users className="size-8 text-muted-foreground" aria-hidden />}
          title={t("reports.noTeamActivity")}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <Users className="size-4 text-primary" aria-hidden />
          {t("reports.teamWorkload")}
        </h2>
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
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">{t("reports.member")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">{t("reports.completed")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">{t("reports.inProgress")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">{t("reports.avgCycleTime")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">{t("reports.assigned")}</th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((member) => {
              const profile = profilesByUserId.get(member.userId);
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
});
