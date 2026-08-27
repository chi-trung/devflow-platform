import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { HeroFlowDiagram } from "../components/landing/HeroFlowDiagram";
import { IntelligenceSection } from "../components/landing/IntelligenceSection";
import { FeatureBrowserFrame } from "../components/landing/FeatureBrowserFrame";
import { ScreenshotShowcase } from "../components/landing/ScreenshotShowcase";

const HOW_STEPS = [
  { key: "step1", icon: "01" },
  { key: "step2", icon: "02" },
  { key: "step3", icon: "03" },
];

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      {label}
    </a>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {links.map((link) => (
        <FooterLink key={link.href} {...link} />
      ))}
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground overflow-x-hidden">
      {/* ─── Sticky header ─── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo to="/" size="md" wordmarkHideBelow="sm" />

          <nav className="hidden items-center gap-8 lg:flex" aria-label={t("landing.nav.features")}>
            <a
              href="#features"
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {t("landing.nav.features")}
            </a>
            <a
              href="#pricing"
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {t("landing.nav.pricing")}
            </a>
            <a
              href="#docs"
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {t("landing.nav.docs")}
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle className="hidden w-auto lg:inline-flex" />
            <Link to="/login" className="sm:whitespace-nowrap">
              <Button variant="ghost" size="sm">
                {t("landing.nav.login")}
              </Button>
            </Link>
            <Link to="/register" className="sm:whitespace-nowrap">
              <Button size="sm" className="px-2 sm:px-2.5">
                {t("landing.nav.signup")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

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
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="mb-10 grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterColumn
              title={t("landing.footer.product")}
              links={[
                { href: "#features", label: t("landing.footer.features") },
                { href: "#pricing", label: t("landing.footer.pricing") },
                { href: "#docs", label: t("landing.footer.docs") },
                { href: "#changelog", label: t("landing.footer.changelog") },
              ]}
            />
            <FooterColumn
              title={t("landing.footer.resources")}
              links={[
                { href: "#blog", label: t("landing.footer.blog") },
                { href: "#community", label: t("landing.footer.community") },
                { href: "#help", label: t("landing.footer.help") },
              ]}
            />
            <FooterColumn
              title={t("landing.footer.legal")}
              links={[
                { href: "#privacy", label: t("landing.footer.privacy") },
                { href: "#terms", label: t("landing.footer.terms") },
              ]}
            />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-6">
            <Logo to="/" size="sm" />
            <p className="text-xs text-muted-foreground">
              {t("landing.footer.copyright")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
