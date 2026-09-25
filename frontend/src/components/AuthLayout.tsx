import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Logo } from "./ui/Logo";
import { Button } from "./ui/Button";
import { ThemeToggle } from "./ui/ThemeToggle";
import { AuthScene } from "./auth/AuthScene";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkTo: string;
  footerLinkLabel: string;
  children: ReactNode;
}

const HIGHLIGHT_KEYS = [
  "workspace.authFeature1",
  "workspace.authFeature2",
  "workspace.authFeature3",
] as const;

/**
 * Shared shell for /login and /register — the same visual language as the
 * landing page: a sticky brand header, a product scene in a BrowserFrame, the
 * mono uppercase eyebrow, and display-font headings.
 *
 * Split is 58% branding / 42% form at `lg` and up, which puts the form card
 * (~384px) in a 605px column on a 1440px screen — the old 50/50 split gave the
 * form a 720px half it never used while the 448px `max-w-md` branding column
 * left its own horizontal slack. Below `lg` the scene is dropped entirely and
 * the card is centred in whatever the header leaves.
 *
 * The branding column is ONE `justify-center` block, not `justify-between` over
 * three children: at 1000px tall that old layout stranded the logo ~250px above
 * the scene and the motto ~250px below it, with the content floating in the
 * middle of an otherwise empty panel.
 */
export function AuthLayout({
  title,
  subtitle,
  footerText,
  footerLinkTo,
  footerLinkLabel,
  children,
}: AuthLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* First tab stop: skip the header's links straight to the form. The
          <main> target below matches the landing page's #devflow-content
          convention (WCAG 2.4.1), visible only while focused. */}
      <a
        href="#devflow-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground"
      >
        {t("ui.skipToContent")}
      </a>

      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <Logo to="/" size="md" wordmarkHideBelow="sm" />

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            {/* `compact` keeps the labels for assistive tech but hides them
                visually, so the toggle is two icons (~76px) instead of the
                214px w-full segmented control — it was crowding the logo out
                of a 64px header. */}
            <ThemeToggle compact />
            {/* The cross-link: "Create one" on /login, "Sign in" on
                /register. Reuses the same destination as the footer link
                below, so no extra i18n keys and no redundant CTA pair.
                `outline` rather than `ghost` — a ghost sm button is bare
                text-muted-foreground and read as a label, not a control. */}
            <Link to={footerLinkTo} className="whitespace-nowrap">
              <Button variant="outline" size="sm" className="rounded-full px-4">
                {footerLinkLabel}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* `<aside>` = complementary landmark, so axe's `region` best-practice
            stops flagging the branding column on /login and /register. No
            aria-label: the panel is already distinct from <main> by role. */}
        <aside className="relative hidden w-[58%] flex-none flex-col justify-center overflow-y-auto border-r border-border bg-surface p-10 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl"
          />

          {/* max-w-[700px] tracks the usable width inside the frame: the aside
              is 58% of the viewport (835px at 1440), and capping the scene any
              narrower left the BrowserFrame's right edge stranded in empty
              space (672px of 835px). 700px is the ceiling where the scene's
              two 260px-min columns still fit side by side with the gutters
              balanced (67px each) instead of one 135px gap. */}
          <div className="relative z-10 mx-auto flex w-full max-w-[700px] flex-col gap-8">
            <AuthScene />

            <div>
              {/* Same mono uppercase eyebrow the landing hero uses, so the
                  two pages read as one design system. It fits on one line
                  here (the column is 680px); the 36-char string wrapped
                  inside the form card, which gets the motto instead. */}
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t("landing.heroEyebrow")}
              </p>
              <p className="font-display text-3xl font-bold leading-tight tracking-tight text-balance">
                {t("workspace.authTagline")}
              </p>
              <ul role="list" className="mt-6 grid gap-2">
                {HIGHLIGHT_KEYS.map((key) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5 text-sm"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary-strong">
                      <Check className="size-3" aria-hidden />
                    </span>
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <main
          id="devflow-content"
          tabIndex={-1}
          className="relative flex flex-1 items-center justify-center overflow-y-auto p-6 outline-none"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative z-10 w-full max-w-sm rise">
            <div className="rounded-2xl border border-border-strong bg-elevated p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
              {/* The hero eyebrow (36 chars) wrapped onto two lines inside a
                  336px card; the motto is the auth pages' own wordmark. */}
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t("workspace.authMotto")}
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {title}
              </h1>
              <p className="mb-5 mt-1 text-sm text-muted-foreground">{subtitle}</p>
              {children}
            </div>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {footerText}{" "}
              <Link
                to={footerLinkTo}
                className="font-semibold text-primary transition-colors duration-150 hover:text-primary-strong"
              >
                {footerLinkLabel}
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
