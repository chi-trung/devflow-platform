import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, Rocket } from "lucide-react";
import {
  PublicHeader,
  PublicFooter,
} from "../components/landing/PublicChrome";
import { Button } from "../components/ui/Button";
import { usePageMeta } from "../lib/seo";
import {
  CHANGELOG_ENTRIES,
  ROADMAP_ITEMS,
  type ChangeCategory,
} from "../data/changelog";

// Category render order; a release omits categories it doesn't have.
const CATEGORY_ORDER: ChangeCategory[] = ["added", "improved", "fixed", "removed"];

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ChangelogPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("vi") ? "vi" : "en";
  usePageMeta("changelog.title", "changelog.subtitle");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground overflow-x-clip">
      <PublicHeader />

      <main className="flex-1">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[700px] -translate-x-1/2 rounded-full opacity-[0.05] blur-3xl"
            style={{ background: "var(--color-primary)" }}
            aria-hidden
          />
          <div className="mx-auto max-w-4xl px-4 pb-14 pt-16 text-center sm:px-6 sm:pb-16 sm:pt-20">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t("changelog.eyebrow")}
            </p>
            <h1 className="mb-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {t("changelog.title")}
            </h1>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {t("changelog.subtitle")}
            </p>
          </div>
        </section>

        {/* ─── Shipped timeline ─── */}
        <section className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="mb-10 font-display text-2xl font-semibold tracking-tight">
              {t("changelog.shippedTitle")}
            </h2>
            <ol className="relative space-y-12 border-l border-border pl-6 sm:pl-8">
              {CHANGELOG_ENTRIES.map((entry) => (
                <li key={entry.version} className="relative">
                  <span
                    className="absolute -left-[31px] top-1.5 size-2.5 rounded-full bg-primary sm:-left-[39px]"
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-primary/10 px-2.5 py-1 font-mono text-sm font-semibold text-primary">
                      {entry.version}
                    </span>
                    <time
                      dateTime={entry.date}
                      className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
                    >
                      {formatDate(entry.date, lang)}
                    </time>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">
                    {entry.title[lang]}
                  </h3>
                  {CATEGORY_ORDER.map((kind) => {
                    const items = entry.changes[kind];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={kind} className="mt-4">
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {t(`changelog.category.${kind}`)}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {items.map((item) => (
                            <li
                              key={item.en}
                              className="flex gap-2 text-sm text-muted-foreground"
                            >
                              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                              {item[lang]}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── Roadmap ─── */}
        <section className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="mb-10 font-display text-2xl font-semibold tracking-tight">
              {t("changelog.roadmapTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ROADMAP_ITEMS.map((item) => (
                <div
                  key={item.title.en}
                  className="rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-border-strong"
                >
                  <div className="mb-3 flex items-center gap-2">
                    {item.status === "inProgress" ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                        <Rocket className="size-3" aria-hidden />
                        {t("changelog.roadmapStatus.inProgress")}
                      </span>
                    ) : (
                      <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("changelog.roadmapStatus.planned")}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold">{item.title[lang]}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight">
              {t("changelog.ctaTitle")}
            </h2>
            <Link to="/register">
              <Button size="md" className="gap-2 px-8 py-3 text-base">
                {t("landing.ctaButton")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
