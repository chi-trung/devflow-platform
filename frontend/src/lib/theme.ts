export type Theme = "dark" | "light";

const THEME_KEY = "devflow.theme";

export function getTheme(): Theme {
  return document.documentElement.classList.contains("light")
    ? "light"
    : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function initTheme(): Theme {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {}
  const theme: Theme = stored === "light" ? "light" : "dark";
  document.documentElement.classList.toggle("light", theme === "light");
  return theme;
}
