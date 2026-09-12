import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicHeader, PublicFooter } from "../components/landing/PublicChrome";
import { Button } from "../components/ui/Button";
import {
  LEGAL_UPDATED,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  type LegalSection,
} from "../data/legal";

// Shared layout for /privacy and /terms. Body text lives in src/data/legal.ts
// as en/vi pairs (marketing-data.test.ts gates parity); only page chrome goes
// through t(). Content is written against the actual implementation, so the
// pages must be updated together with the code they describe.

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function LegalLayout({
  titleKey,
  sections,
}: {
  titleKey: "privacy" | "terms";
  sections: LegalSection[];
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("vi") ? "vi" : "en";

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground overflow-x-hidden">
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
              {t(`${titleKey}.eyebrow`)}
            </p>
            <h1 className="mb-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {t(`${titleKey}.title`)}
            </h1>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {t(`${titleKey}.subtitle`)}
            </p>
            <p className="mx-auto mt-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {t(`${titleKey}.updated`, {
                date: formatDate(LEGAL_UPDATED, lang),
              })}
            </p>
          </div>
        </section>

        {/* ─── Sections ─── */}
        <article className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto max-w-4xl space-y-12 px-4 sm:px-6">
            {sections.map((section) => (
              <section key={section.heading.en}>
                <h2 className="mb-4 font-display text-2xl font-semibold tracking-tight">
                  {section.heading[lang]}
                </h2>
                <div className="space-y-4">
                  {section.paragraphs.map((p) => (
                    <p
                      key={p.en.slice(0, 40)}
                      className="leading-relaxed text-muted-foreground"
                    >
                      {p[lang]}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        {/* ─── CTA ─── */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight">
              {t(`${titleKey}.ctaTitle`)}
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

export function PrivacyPage() {
  return <LegalLayout titleKey="privacy" sections={PRIVACY_SECTIONS} />;
}

export function TermsPage() {
  return <LegalLayout titleKey="terms" sections={TERMS_SECTIONS} />;
}
