import { X } from "lucide-react";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl + K", action: "Global search / command palette" },
  { keys: "N", action: "New task" },
  { keys: "/", action: "Focus board filter" },
  { keys: "?", action: "Show this help" },
  { keys: "Ctrl + A", action: "Select all visible tasks" },
  { keys: "Delete", action: "Delete selected tasks" },
  { keys: "Esc", action: "Clear selection / close panels" },
];

interface KeyboardHelpModalProps {
  onClose: () => void;
}

export function KeyboardHelpModal({ onClose }: KeyboardHelpModalProps) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Keyboard shortcuts">
      <button
        type="button"
        aria-label="Close help"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/30"
      />
      <div className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
          Search operators: status:done · priority:high · assignee:me · label:bug · is:blocked
        </p>
      </div>
    </div>
  );
}
