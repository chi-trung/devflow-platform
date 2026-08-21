import { KanbanSquare, Check } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkTo: string;
  footerLinkLabel: string;
  children: ReactNode;
}

const HIGHLIGHTS = [
  "Kanban board with drag & drop",
  "Role-based workspaces",
  "Sprint planning built in",
];

export function AuthLayout({
  title,
  subtitle,
  footerText,
  footerLinkTo,
  footerLinkLabel,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full bg-primary/5 blur-3xl"
        />

        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-on-primary">
            <KanbanSquare className="size-4.5" aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            DevFlow
          </span>
        </div>

        <div className="max-w-md">
          <p className="font-display text-4xl font-semibold leading-tight tracking-tight text-balance">
            Where your team ships.
          </p>
          <ul className="mt-6 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm">
                <span className="flex size-5 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Check className="size-3" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-xs text-muted-foreground">
          plan · build · review · ship
        </p>
      </div>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rise">
          <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-on-primary">
              <KanbanSquare className="size-5" aria-hidden />
            </span>
            <span className="font-display text-xl font-semibold">DevFlow</span>
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
