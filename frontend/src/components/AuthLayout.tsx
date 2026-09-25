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
 *
 * Both pages are ONE screen: no vertical scrollbar, no horizontal scrollbar, at
 * any viewport. Two measured facts drove this, and both are the opposite of
 * what the markup looks like it should do:
 *
 *  1. `min-h-dvh` is a FLOOR, not a cap. A `flex-1` child stretches to its own
 *     content, so a tall left column grew the page past the viewport and the
 *     `overflow-y-auto` on that column did nothing — the column was the thing
 *     growing, not the thing scrolling. Hence `h-dvh` on the root and `min-h-0`
 *     on the flex children: the scene is now SIZED TO FIT rather than clipped.
 *  2. `overflow-y: auto` makes `overflow-x` compute to `auto` as well — that
 *     pairing is required by the CSS overflow spec whenever one axis is not
 *     `visible`. So the decorative blob at `-right-32` extended 128px past the
 *     right edge and made the entire column draggable sideways, at every
 *     viewport including 390px wide. `overflow-x: clip` on <main> does NOT fix
 *     this: per spec `clip` computes to `hidden` when the other axis scrolls,
 *     and a `hidden` box is still programmatically scrollable. The blob is
 *     therefore wrapped in its own `absolute inset-0 overflow-hidden` box (see
 *     below) — the only thing that contains a decorative overflow without
 *     turning it into a scroll port.
 *
 * The root is `overflow-x-hidden` and NOT `overflow-hidden` on purpose: the
 * root must not clip the register form when it is taller than the viewport
 * (844x390 landscape measured: `h-dvh` + `overflow-hidden` made the submit
 * button unreachable and the page unscrollable). Vertical scrolling lives on
 * <main>, which always has `overflow-y-auto`.
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
    <div className="flex h-dvh flex-col overflow-x-hidden bg-background text-foreground">
      {/* First tab stop: skip the header's links straight to the form. The
          <main> target below matches the landing page's #devflow-content
          convention (WCAG 2.4.1), visible only while focused. */}
      <a
        href="#devflow-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground"
      >
        {t("ui.skipToContent")}
      </a>

      <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-md">
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

      {/* `flex-1` alone still lets a flex item grow past the line; `min-h-0`
          is what actually pins both columns to the remaining viewport. */}
      <div className="flex min-h-0 flex-1">
        {/* `<aside>` = complementary landmark, so axe's `region` best-practice
            stops flagging the branding column on /login and /register. No
            aria-label: the panel is already distinct from <main> by role. */}
        <aside className="relative hidden w-[58%] flex-none flex-col justify-center overflow-hidden border-r border-border bg-surface p-6 lg:flex xl:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl" />
          </div>

          {/* max-w-[700px] tracks the usable width inside the frame: the aside
              is 58% of the viewport (835px at 1440), and capping the scene any
              narrower left the BrowserFrame's right edge stranded in empty
              space (672px of 835px). 700px is the ceiling where the scene's
              two 260px-min columns still fit side by side with the gutters
              balanced (67px each) instead of one 135px gap. */}
          <div className="relative z-10 mx-auto flex w-full max-w-[700px] flex-col gap-5">
            <AuthScene />

            <div>
              {/* Same mono uppercase eyebrow the landing hero uses, so the
                  two pages read as one design system. It fits on one line
                  here (the column is 680px); the 36-char string wrapped
                  inside the form card, which gets the motto instead. */}
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t("landing.heroEyebrow")}
              </p>
              <p className="font-display text-2xl font-bold leading-tight tracking-tight text-balance">
                {t("workspace.authTagline")}
              </p>
              {/* The three feature rows used to be stacked cards: 142px of
                  grid plus a 24px top margin, height the page did not have,
                  to say less than the board scene directly above them
                  already shows. One line of separated text carries the same
                  three strings. */}
              <p className="mt-3 text-sm text-muted-foreground">
                {HIGHLIGHT_KEYS.map((key, i) => (
                  <span key={key}>
                    {i > 0 && <span className="px-1.5 text-border-strong">/</span>}
                    {t(key)}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </aside>

        <main
          id="devflow-content"
          tabIndex={-1}
          className="relative flex min-h-0 flex-1 justify-center overflow-x-clip overflow-y-auto p-6 outline-none"
        >
          {/* The blob lives inside its own clipping wrapper rather than being
              clipped by <main>. Measured: pairing `overflow-x: clip` with
              `overflow-y: auto` does NOT work — per spec `clip` computes to
              `hidden` when the other axis is scrollable, and a `hidden` box is
              still programmatically scrollable, which put the page 128px back
              into a sideways drag. <main> must scroll vertically (see below),
              so it cannot be the thing containing the glow. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl" />
          </div>

          {/* `m-auto`, not `items-center` on the parent: a centred flex item
              that is TALLER than a scroll container has its top half pushed
              above the scroll origin and becomes unreachable. `m-auto` on the
              child centres it when it fits and leaves it scrollable at its
              natural top when it does not. */}
          <div className="relative z-10 m-auto w-full max-w-sm rise">
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
