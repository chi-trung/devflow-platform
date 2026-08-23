import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

function getShortcuts(t: (key: string) => string) {
  return [
    { keys: "Ctrl + K", action: t("nav.search") },
    { keys: "N", action: t("board.newTask") },
    { keys: "/", action: t("filter.filters") },
    { keys: "?", action: "?" },
    { keys: "Ctrl + A", action: t("common.confirm") },
    { keys: "Delete", action: t("common.delete") },
    { keys: "Esc", action: t("common.cancel") },
  ];
}

interface KeyboardHelpModalProps {
  onClose: () => void;
}

export function KeyboardHelpModal({ onClose }: KeyboardHelpModalProps) {
  const { t } = useTranslation();
  const SHORTCUTS = getShortcuts(t);
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-label={t("keyboard.title")}
    >
      <button
        type="button"
        aria-label={t("keyboard.closeHelpAria")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/30"
      />
      <div className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">
            {t("keyboard.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("board.closeAria")}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <dl className="flex flex-col gap-2.5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between gap-4 text-sm">
              <dt>
                <kbd className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="text-right text-muted-foreground">{shortcut.action}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 font-mono text-[10px] text-muted-foreground">
          {t("keyboard.searchOperatorsPrefix")} status:done · priority:high ·
          assignee:me · label:bug · is:blocked
        </p>
      </div>
    </div>
  );
}
