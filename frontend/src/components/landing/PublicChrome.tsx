import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";

// Shared marketing chrome for public (no-auth) pages. Extracted from
// LandingPage so ChangelogPage renders the same header/footer instead of
// duplicating ~90 lines that would drift.

export function PublicHeader({
  nav,
}: {
  nav?: { href: string; label: string }[];
}) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo to="/" size="md" wordmarkHideBelow="sm" />

        {nav && nav.length > 0 && (
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Public">
            {nav.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

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
  );
}

export function FooterLink({ href, label }: { href: string; label: string }) {
  const cls =
    "text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground";
  // Internal routes use the router Link (client-side navigation); hash
  // anchors (/#features) stay as plain <a> so the browser's native
  // same-document hash scrolling still works, as do external URLs.
  return href.startsWith("/") && !href.startsWith("/#") ? (
    <Link to={href} className={cls}>
      {label}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {label}
    </a>
  );
}

export function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* h3 keeps the outline sequential (h2 sections → h3 columns); h4 here
          failed Lighthouse heading-order because the footer follows an h2. */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {links.map((link) => (
        <FooterLink key={link.href} {...link} />
      ))}
    </div>
  );
}

export function PublicFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-10 grid grid-cols-2 gap-8 sm:grid-cols-3">
          <FooterColumn
            title={t("landing.footer.product")}
            links={[
              { href: "/#features", label: t("landing.footer.features") },
              { href: "/#pricing", label: t("landing.footer.pricing") },
              { href: "/#docs", label: t("landing.footer.docs") },
              { href: "/changelog", label: t("landing.footer.changelog") },
            ]}
          />
          <FooterColumn
            title={t("landing.footer.resources")}
            links={[
              { href: "/#blog", label: t("landing.footer.blog") },
              { href: "/#community", label: t("landing.footer.community") },
              { href: "/#help", label: t("landing.footer.help") },
            ]}
          />
          <FooterColumn
            title={t("landing.footer.legal")}
            links={[
              { href: "/#privacy", label: t("landing.footer.privacy") },
              { href: "/#terms", label: t("landing.footer.terms") },
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
  );
}
