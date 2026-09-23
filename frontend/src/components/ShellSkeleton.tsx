import { useTranslation } from "react-i18next";

/**
 * App-chrome skeleton (header + sidebar + content blocks) shown while the
 * session restore or a lazy route chunk is still resolving. Drawing the real
 * shell instead of a blank spinner keeps a slow cold start from looking hung
 * — the layout that is about to appear is already on screen.
 *
 * Shared by RequireAuth (session restore) and App's RouteFallback (lazy
 * route swap) so both transitions draw the same chrome. role="status" plus
 * the sr-only label means assistive tech hears "Loading…" instead of silence;
 * every placeholder block stays aria-hidden so nothing else is announced.
 */
export function ShellSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex h-dvh flex-col bg-background" role="status">
      <span className="sr-only">{t("common.loading")}</span>
      {/* Top bar skeleton */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <div className="size-8 animate-pulse rounded-lg bg-elevated" aria-hidden />
        <div className="h-4 w-40 animate-pulse rounded bg-elevated" aria-hidden />
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface p-3 md:block">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-lg bg-elevated"
                aria-hidden
              />
            ))}
          </div>
        </aside>
        {/* Content skeleton */}
        <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl bg-elevated"
                aria-hidden
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-xl bg-elevated" aria-hidden />
            <div className="h-72 animate-pulse rounded-xl bg-elevated" aria-hidden />
          </div>
        </main>
      </div>
    </div>
  );
}
