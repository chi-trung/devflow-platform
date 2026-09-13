import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getTheme, type Theme } from "../../lib/theme";

interface ThemeToggleProps {
  className?: string;
  onThemeChange?: (theme: Theme) => void;
}

const OPTIONS: { theme: Theme; labelKey: string }[] = [
  { theme: "dark", labelKey: "ui.dark" },
  { theme: "light", labelKey: "ui.light" },
];

export function ThemeToggle({ className = "", onThemeChange }: ThemeToggleProps) {
  const { t } = useTranslation();
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const groupRef = useRef<HTMLDivElement>(null);

  function choose(next: Theme) {
    if (next === theme) return;
    applyTheme(next);
    setThemeState(next);
    onThemeChange?.(next);
  }

  // A native radiogroup moves the selection with arrow keys while Tab steps
  // over the whole group. Buttons alone get none of that, so arrows change
  // theme and focus here, and only the checked radio keeps a tab stop.
  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1
      : 0;
    if (!step) return;
    event.preventDefault();
    const current = OPTIONS.findIndex((o) => o.theme === theme);
    const next = OPTIONS[(current + step + OPTIONS.length) % OPTIONS.length];
    choose(next.theme);
    groupRef.current
      ?.querySelector<HTMLButtonElement>(`[data-theme-option="${next.theme}"]`)
      ?.focus();
  }

  const optionClass = (active: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-card text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={t("ui.colorThemeAria")}
      onKeyDown={onKeyDown}
      className={`inline-flex w-full max-w-56 rounded-lg border border-border bg-surface p-0.5 ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        tabIndex={theme === "dark" ? 0 : -1}
        data-theme-option="dark"
        onClick={() => choose("dark")}
        className={optionClass(theme === "dark")}
      >
        <Moon className="size-4" aria-hidden />
        {t("ui.dark")}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        tabIndex={theme === "light" ? 0 : -1}
        data-theme-option="light"
        onClick={() => choose("light")}
        className={optionClass(theme === "light")}
      >
        <Sun className="size-4" aria-hidden />
        {t("ui.light")}
      </button>
    </div>
  );
}
