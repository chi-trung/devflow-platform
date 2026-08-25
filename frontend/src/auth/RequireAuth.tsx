import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Auth gate. While the session is being restored the shell layout is
 * rendered with a content skeleton instead of a blank "Loading…" screen,
 * so the app doesn't look hung on slow cold starts.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex h-dvh flex-col bg-background">
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

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
