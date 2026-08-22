import { Users } from "lucide-react";
import { formatMinutes } from "../../lib/format";
import type { TeamReportResponse, WorkspaceMemberResponse } from "../../types/api";
import { Avatar } from "../ui/Avatar";

interface TeamReportCardsProps {
  data: TeamReportResponse;
  members: WorkspaceMemberResponse[];
  className?: string;
}

export function TeamReportCards({ data, members, className = "" }: TeamReportCardsProps) {
  if (data.members.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        No team activity yet.
      </div>
    );
  }

  const maxCompleted = Math.max(1, ...data.members.map((m) => m.tasksCompleted));

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <Users className="size-4 text-primary" aria-hidden />
          Team workload
        </h3>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {data.totalCompleted}/{data.totalTasks} done ·{" "}
          {formatMinutes(data.totalMinutesLogged)} logged
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {data.members.map((member) => {
          const profile = members.find((m) => m.userId === member.userId);
          const name = profile?.displayName || member.userName || profile?.username || "member";
          const completion =
            member.tasksAssigned > 0
              ? Math.round((member.tasksCompleted / member.tasksAssigned) * 100)
              : 0;
          return (
            <article
              key={member.userId}
              className="rounded-xl border border-border bg-card p-3 transition-colors duration-200 hover:border-border-strong"
            >
              <div className="flex items-center gap-2">
                <Avatar name={name} id={member.userId} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {formatMinutes(member.totalMinutesLogged)} logged
                  </p>
                </div>
                <span className="ml-auto rounded-md bg-elevated px-2 py-0.5 font-mono text-[11px]">
                  {completion}%
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>{member.tasksCompleted} completed</span>
                <span>{member.tasksAssigned} assigned</span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={member.tasksCompleted}
                aria-valuemin={0}
                aria-valuemax={maxCompleted}
                aria-label={`${name} completed tasks`}
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.round((member.tasksCompleted / maxCompleted) * 100)}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
