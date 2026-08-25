import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Logo } from "./ui/Logo";
import { AuthHeroIllustration } from "./illustrations/AuthHeroIllustration";

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
    <div className="flex min-h-dvh">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative z-10">
          <Logo size="md" label="DevFlow" />
        </div>

        <div className="relative z-10 flex max-w-md flex-col gap-8">
          <AuthHeroIllustration className="w-full max-w-sm" />
          <div>
            <p className="font-display text-4xl font-semibold leading-tight tracking-tight text-balance">
              {t("workspace.authTagline")}
            </p>
            <ul className="mt-6 space-y-3">
              {HIGHLIGHT_KEYS.map((key) => (
                <li key={key} className="flex items-center gap-3 text-sm">
                  <span className="flex size-5 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="relative z-10 font-mono text-xs text-muted-foreground">
          {t("workspace.authMotto")}
        </p>
      </div>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rise">
          <div className="mb-6 flex items-center justify-center lg:hidden">
            <Logo size="md" label="DevFlow" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.6)]">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              {subtitle}
            </p>
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
  );
}
