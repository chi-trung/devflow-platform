import { useTranslation } from "react-i18next";
import { BrowserFrame } from "./BrowserFrame";

/**
 * Dashboard screenshot showcase — places the real dashboard screenshot
 * (mobile + desktop composite, 1869×842) inside a browser frame so it reads as
 * a live product shot rather than a bare image. Sits between the hero and the
 * Intelligence section.
 */
export function ScreenshotShowcase() {
  const { t } = useTranslation();

  return (
    <section className="border-b border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {t("landing.showcase.eyebrow")}
          </p>
          <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("landing.showcase.title")}
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            {t("landing.showcase.subtitle")}
          </p>
        </div>

        <BrowserFrame className="mx-auto max-w-5xl">
          {/* Dashboard screenshot — mobile + desktop composite */}
          <div className="overflow-hidden rounded-lg border border-border">
            <img
              src="/landing.png"
              alt={t("landing.showcase.alt")}
              width={1869}
              height={842}
              className="block h-auto w-full"
              loading="lazy"
            />
          </div>
        </BrowserFrame>
      </div>
    </section>
  );
}
