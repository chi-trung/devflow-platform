import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getTheme, type Theme } from "../../lib/theme";

interface ThemeToggleProps {
  className?: string;
  onThemeChange?: (theme: Theme) => void;
}

export function ThemeToggle({ className = "", onThemeChange }: ThemeToggleProps) {
  const { t } = useTranslation();
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  function choose(next: Theme) {
    if (next === theme) return;
    applyTheme(next);
    setThemeState(next);
    onThemeChange?.(next);
  }

  const optionClass = (active: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-card text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div
      role="radiogroup"
      aria-label={t("ui.colorThemeAria")}
      className={`inline-flex w-full max-w-56 rounded-lg border border-border bg-surface p-0.5 ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
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
        onClick={() => choose("light")}
        className={optionClass(theme === "light")}
      >
        <Sun className="size-4" aria-hidden />
        {t("ui.light")}
      </button>
    </div>
  );
}
