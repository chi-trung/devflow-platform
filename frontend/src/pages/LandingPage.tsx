import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicHeader, PublicFooter } from "../components/landing/PublicChrome";
import { Button } from "../components/ui/Button";
import { HeroFlowDiagram } from "../components/landing/HeroFlowDiagram";
import { IntelligenceSection } from "../components/landing/IntelligenceSection";
import { FeatureBrowserFrame } from "../components/landing/FeatureBrowserFrame";
import { ScreenshotShowcase } from "../components/landing/ScreenshotShowcase";
import {
  PricingSection,
  DocsSection,
  CommunitySection,
  HelpSection,
} from "../components/landing/MarketingSections";
import { API_BASE } from "../lib/api";
import { usePageMeta } from "../lib/seo";

const HOW_STEPS = [
  { key: "step1", icon: "01" },
  { key: "step2", icon: "02" },
  { key: "step3", icon: "03" },
];

export function LandingPage() {
  const { t } = useTranslation();

  // Restore the marketing title after a visit to /blog or /terms keeps their
  // per-route titles from bleeding through client-side navigation.
  usePageMeta("landing.heroTitle", "landing.heroSubtitle");

  // Warm the Render backend as early as possible — the landing page is the
  // first page most visitors hit, so firing a ping here means the instance
  // is already awake by the time they log in, avoiding a 30-60s cold start.
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/ping`, { cache: "no-store" }).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground overflow-x-clip">
      {/* SoftwareApplication graph so Google knows the URL is an app, not
          just an article. Values are plain facts about this product: free
          to start, web-based, same origin as the page. React 19 renders a
          <script> child into <head> without manual DOM handling. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "DevFlow",
            applicationCategory: "ProjectManagementApplication",
            operatingSystem: "Web",
            url: "https://devflow-platform-kappa.vercel.app/",
            image: "https://devflow-platform-kappa.vercel.app/landing-opt.png",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />
      {/* ─── Sticky header ─── */}
      <PublicHeader
        nav={[
          { href: "#features", label: t("landing.nav.features") },
          { href: "#pricing", label: t("landing.nav.pricing") },
          { href: "#docs", label: t("landing.nav.docs") },
        ]}
      />

      <main className="flex-1">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden border-b border-border">
          {/* Background gradient decoration */}
          <div
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[700px] -translate-x-1/2 rounded-full opacity-[0.05] blur-3xl"
            style={{ background: "var(--color-primary)" }}
            aria-hidden
          />

          <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t("landing.heroEyebrow")}
            </p>
            <h1 className="mx-auto mb-4 max-w-4xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {t("landing.heroSubtitle")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/register" className="sm:whitespace-nowrap">
                <Button size="md" className="gap-2 px-5 py-2.5 text-sm sm:px-6 sm:text-base">
                  {t("landing.ctaStart")}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Link>
              <Link to="/login" className="sm:whitespace-nowrap">
                <Button
                  variant="outline"
                  size="md"
                  className="px-5 py-2.5 text-sm sm:px-6 sm:text-base"
                >
                  {t("landing.ctaViewLogin")}
                </Button>
              </Link>
            </div>

            {/* Animated flow diagram (desktop + mobile SVGs) */}
            <div className="mx-auto mt-14 max-w-4xl px-0 overflow-visible">
              <HeroFlowDiagram className="mx-auto" />
            </div>
          </div>
        </section>

        {/* ─── Dashboard screenshot ─── */}
        <ScreenshotShowcase />

        {/* ─── The Intelligence ─── */}
        <IntelligenceSection />

        {/* ─── Features ─── */}
        <section id="features" className="border-b border-border py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-14 text-center">
              <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {t("landing.featuresTitle")}
              </h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                {t("landing.featuresSubtitle")}
              </p>
            </div>

            <FeatureBrowserFrame />
          </div>
        </section>

        {/* ─── Pricing / Docs / Community / Help ─── */}
        <PricingSection />
        <DocsSection />
        <CommunitySection />
        <HelpSection />

        {/* ─── How it works ─── */}
        <section className="border-b border-border py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {t("landing.howTitle")}
              </h2>
              <p className="text-muted-foreground">
                {t("landing.howSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {HOW_STEPS.map(({ key, icon }, i) => (
                <div
                  key={key}
                  className="relative flex flex-col items-center rounded-xl border border-border bg-card/60 p-8 text-center transition-colors duration-200 hover:border-border-strong"
                >
                  <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {icon}
                  </span>
                  <h3 className="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                    {t(`landing.how.${key}.label`)}
                  </h3>
                  <h4 className="mb-2 text-lg font-semibold">
                    {t(`landing.how.${key}.title`)}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t(`landing.how.${key}.desc`)}
                  </p>
                  {i < HOW_STEPS.length - 1 && (
                    <ArrowRight
                      className="absolute -right-4 top-1/2 hidden size-5 -translate-y-1/2 text-muted-foreground/40 md:block"
                      aria-hidden
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.ctaTitle")}
            </h2>
            <p className="mb-8 text-muted-foreground">
              {t("landing.ctaSubtitle")}
            </p>
            <Link to="/register">
              <Button size="md" className="gap-2 px-8 py-3 text-base">
                {t("landing.ctaButton")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <PublicFooter />
    </div>
  );
}
