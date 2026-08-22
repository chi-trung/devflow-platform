import { ArrowRightLeft, Bell, MessageSquare, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppNotification } from "../../hooks/useNotifications";

const kindMeta: Record<
  AppNotification["kind"],
  { icon: LucideIcon; accent: string }
> = {
  task: { icon: UserPlus, accent: "text-violet-300" },
  comment: { icon: MessageSquare, accent: "text-primary" },
  sprint: { icon: ArrowRightLeft, accent: "text-sky-300" },
  other: { icon: Bell, accent: "text-muted-foreground" },
};

export function timeAgo(utc: string): string {
  const seconds = Math.floor((Date.now() - new Date(utc).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(utc).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface NotificationItemProps {
  notification: AppNotification;
  unread: boolean;
  onClick: () => void;
}

export function NotificationItem({
  notification,
  unread,
  onClick,
}: NotificationItemProps) {
  const meta = kindMeta[notification.kind];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-elevated ${
        unread ? "bg-primary/5" : ""
      }`}
    >
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-elevated ${meta.accent}`}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-snug">
          {notification.message}
        </span>
        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
          {timeAgo(notification.createdAtUtc)}
        </span>
      </span>
      {unread && (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}
    </button>
  );
}
