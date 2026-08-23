import { useTranslation } from "react-i18next";
import i18n, { type TFunction } from "i18next";
import { ArrowRightLeft, Bell, MessageSquare, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "../ui/Avatar";
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

export function timeAgo(utc: string, t?: TFunction): string {
  const translate: TFunction = t ?? i18n.t.bind(i18n);
  const seconds = Math.floor((Date.now() - new Date(utc).getTime()) / 1000);
  if (seconds < 60) return translate("notification.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return translate("notification.minsAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate("notification.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return translate("notification.daysAgo", { count: days });
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
  const { t } = useTranslation();
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
      {notification.actorName ? (
        <span className="mt-0.5 shrink-0" aria-hidden>
          <Avatar name={notification.actorName} size="sm" />
        </span>
      ) : (
        <span
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-elevated ${meta.accent}`}
          aria-hidden
        >
          <Icon className="size-3.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-snug">
          {notification.message}
        </span>
        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
          {timeAgo(notification.createdAtUtc, t)}
        </span>
      </span>
      {unread && (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          aria-label={t("notification.unread")}
        />
      )}
    </button>
  );
}
