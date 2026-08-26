import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Workflow,
  Bot,
  BookOpen,
  KanbanSquare,
  Users,
  Rocket,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";

const STAGES = [
  { key: "idea", icon: "💡" },
  { key: "planning", icon: "📋" },
  { key: "approved", icon: "✅" },
  { key: "inProgress", icon: "⚡" },
  { key: "review", icon: "👁️" },
  { key: "done", icon: "🚀" },
] as const;

const STAGE_COLORS = [
  "from-sky-500/20 to-blue-500/20 border-sky-500/30",
  "from-violet-500/20 to-purple-500/20 border-violet-500/30",
  "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
  "from-amber-500/20 to-orange-500/20 border-amber-500/30",
  "from-rose-500/20 to-pink-500/20 border-rose-500/30",
  "from-teal-500/20 to-cyan-500/20 border-teal-500/30",
];

const FEATURES = [
  {
    key: "flows",
    icon: Workflow,
    gradient: "from-teal-500/20 to-cyan-500/20",
  },
  {
    key: "ai",
    icon: Bot,
    gradient: "from-violet-500/20 to-purple-500/20",
  },
  {
    key: "wiki",
    icon: BookOpen,
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  {
    key: "kanban",
    icon: KanbanSquare,
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
  {
    key: "orgs",
    icon: Users,
    gradient: "from-blue-500/20 to-indigo-500/20",
  },
  {
    key: "releases",
    icon: Rocket,
    gradient: "from-rose-500/20 to-pink-500/20",
  },
];

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
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ─── Sticky header ─── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo to="/" size="md" />

          <nav className="hidden items-center gap-6 sm:flex" aria-label={t("landing.nav.features")}>
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

          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                {t("landing.nav.login")}
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">{t("landing.nav.signup")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden border-b border-border">
          {/* Background gradient decoration */}
          <div
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[600px] -translate-x-1/2 rounded-full opacity-[0.04] blur-3xl"
            style={{ background: "var(--color-primary)" }}
            aria-hidden
          />

          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t("landing.heroEyebrow")}
            </p>
            <h1 className="mb-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {t("landing.heroSubtitle")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/register">
                <Button size="md" className="gap-2 px-6 py-2.5 text-base">
                  {t("landing.ctaStart")}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="md" className="px-6 py-2.5 text-base">
                  {t("landing.ctaViewLogin")}
                </Button>
              </Link>
            </div>

            {/* Pipeline stage strip */}
            <div className="mt-14">
              <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-3">
                {STAGES.map((stage, i) => (
                  <div key={stage.key} className="flex items-center gap-2 sm:gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg border bg-gradient-to-br px-3 py-1.5 text-sm font-medium shadow-sm ${STAGE_COLORS[i]}`}
                    >
                      <span className="text-base" aria-hidden>
                        {stage.icon}
                      </span>
                      <span>{t(`landing.stages.${stage.key}`)}</span>
                    </span>
                    {i < STAGES.length - 1 && (
                      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
                    )}
                  </div>
                ))}
              </div>

              {/* Sample flow card mock */}
              <div className="mx-auto mt-8 max-w-md rounded-xl border border-border bg-card p-4 text-left shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                  <span className="text-xs font-medium text-muted-foreground">{t("landing.stages.inProgress")}</span>
                </div>
                <p className="mb-1 text-sm font-semibold">Implement OAuth 2.0 refresh flow</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Token rotation, silent refresh on 401, retry with exponential backoff
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-elevated px-2 py-0.5">A32</span>
                  <span>2 comments</span>
                  <span>·</span>
                  <span>4 attachments</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Pipeline / How flow section ─── */}
        <section className="border-b border-border py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {t("landing.pipelineTitle")}
              </h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                {t("landing.pipelineSubtitle")}
              </p>
            </div>

            <div className="relative">
              {/* Connecting line (desktop) */}
              <div
                className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-primary/20 via-primary/10 to-transparent lg:block"
                aria-hidden
              />

              <div className="flex flex-col gap-6 lg:gap-10">
                {STAGES.map((stage, i) => (
                  <div
                    key={stage.key}
                    className={`flex flex-col items-center gap-4 ${i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"}`}
                  >
                    <div className="flex-1">
                      <div
                        className={`rounded-xl border bg-gradient-to-br p-5 shadow-sm ${STAGE_COLORS[i]}`}
                      >
                        <div className="mb-1 font-mono text-xs text-muted-foreground">
                          STEP {String(i + 1).padStart(2, "0")}
                        </div>
                        <h3 className="mb-1 text-lg font-semibold">
                          {stage.icon}{" "}
                          {t(`landing.stages.${stage.key}`)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {t(`landing.stages.${stage.key}`)}
                        </p>
                      </div>
                    </div>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-elevated text-sm font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="flex-1 lg:invisible" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Features ─── */}
        <section
          id="features"
          className="border-b border-border py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {t("landing.featuresTitle")}
              </h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                {t("landing.featuresSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ key, icon: Icon, gradient }) => (
                <div
                  key={key}
                  className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-border-strong hover:shadow-md"
                >
                  <span
                    className={`inline-flex size-10 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}
                  >
                    <Icon className="size-5 text-primary" aria-hidden />
                  </span>
                  <div>
                    <h3 className="mb-1.5 text-base font-semibold">
                      {t(`landing.features.${key}.title`)}
                    </h3>
                    <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                      {t(`landing.features.${key}.desc`)}
                    </p>
                    <ul className="space-y-1.5">
                      {[1, 2, 3].map((bi) => (
                        <li
                          key={bi}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                          <span>{t(`landing.features.${key}.b${bi}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
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
                  className="relative flex flex-col items-center text-center"
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
                      className="mt-4 hidden size-5 text-muted-foreground/40 md:block"
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