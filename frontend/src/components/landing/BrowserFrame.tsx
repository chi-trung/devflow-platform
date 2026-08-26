import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

/**
 * Browser-frame chrome used around every feature mockup on the landing page.
 * Renders a window chrome (3 traffic-light dots + a URL pill) above arbitrary
 * content. Theme-aware via design tokens; no external images.
 */
export function BrowserFrame({
  children,
  className = "",
  urlKey,
}: {
  children: ReactNode;
  className?: string;
  /** i18n key under landing.mock.url — defaults to the shared app URL. */
  urlKey?: string;
}) {
  const { t } = useTranslation();
  const url = urlKey ? t(urlKey) : t("landing.mock.url");

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border-strong bg-card shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)] ${className}`}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-elevated/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-auto flex min-w-0 flex-1 items-center justify-center">
          <span className="min-w-0 truncate rounded-md bg-surface px-3 py-1 font-mono text-[11px] text-muted-foreground">
            {url}
          </span>
        </div>
        <div className="w-9" aria-hidden />
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
