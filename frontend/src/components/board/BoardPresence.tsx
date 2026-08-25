import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/Avatar";
import type { PresenceUser } from "../../hooks/usePresence";

interface BoardPresenceProps {
  users: PresenceUser[];
  remainingCount: number;
  totalOnline: number;
}

export function BoardPresence({ users, remainingCount, totalOnline }: BoardPresenceProps) {
  const { t } = useTranslation();

  if (totalOnline === 0) return null;

  return (
    <div className="flex items-center gap-1" title={`${totalOnline} ${t("board.onlineNow", { count: totalOnline })}`}>
      <div className="flex -space-x-2 overflow-hidden">
        {users.map((user) => (
          <span key={user.userId} className="ring-2 ring-surface rounded-lg">
            <Avatar
              name={user.displayName || user.username}
              id={user.userId}
              size="sm"
              online
            />
          </span>
        ))}
      </div>
      {remainingCount > 0 && (
        <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
