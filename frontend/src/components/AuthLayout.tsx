import { KanbanSquare } from "lucide-react";
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

export function AuthLayout({
  title,
  subtitle,
  footerText,
  footerLinkTo,
  footerLinkLabel,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <main className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-on-primary">
            <KanbanSquare className="size-5" aria-hidden />
          </span>
          <span className="font-mono text-xl font-semibold">DevFlow</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="mb-1 text-xl font-semibold">{title}</h1>
          <p className="mb-5 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {footerText}{" "}
          <Link
            to={footerLinkTo}
            className="font-medium text-primary hover:underline"
          >
            {footerLinkLabel}
          </Link>
        </p>
      </main>
    </div>
  );
}
