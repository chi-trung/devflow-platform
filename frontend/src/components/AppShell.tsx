import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  KanbanSquare,
  Plus,
  FolderKanban,
  Search,
} from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./ui/Avatar";
import { CommandPalette } from "./CommandPalette";
import { NotificationsPanel } from "./notifications/NotificationsPanel";
import { UserMenu } from "./user/UserMenu";
import type { ProjectResponse, WorkspaceResponse } from "../types/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const workspaceId = location.pathname.match(
    /^\/workspaces\/([0-9a-f-]{36})/i,
  )?.[1];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { data: workspaces } = useApi<WorkspaceResponse[]>(
    () => api("/workspaces"),
    [],
  );
  const { data: projects } = useApi<ProjectResponse[]>(
    () =>
      workspaceId
        ? api(`/workspaces/${workspaceId}/projects`)
        : Promise.resolve([]),
    [workspaceId],
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-4"
          aria-label="DevFlow home"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-on-primary">
            <KanbanSquare className="size-4" aria-hidden />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            DevFlow
          </span>
        </Link>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground"
          >
            <Search className="size-3.5" aria-hidden />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px]">
              ⌃K
            </kbd>
          </button>

          <section>
            <h2 className="px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Workspaces
            </h2>
            <ul className="space-y-0.5">
              {(workspaces ?? []).map((workspace) => {
                const active = workspace.id === workspaceId;
                return (
                  <li key={workspace.id}>
                    <Link
                      to={`/workspaces/${workspace.id}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${
                        active
                          ? "bg-elevated font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                      }`}
                    >
                      <Avatar name={workspace.name} id={workspace.id} />
                      <span className="truncate">{workspace.name}</span>
                    </Link>
                  </li>
                );
              })}
              {!workspaces && (
                <li className="space-y-1.5 px-2 py-1">
                  <div className="skeleton h-6 w-full" />
                  <div className="skeleton h-6 w-4/5" />
                </li>
              )}
            </ul>
          </section>

          {workspaceId && (
            <section>
              <h2 className="px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Projects
              </h2>
              <ul className="space-y-0.5">
                {(projects ?? []).map((project) => (
                  <li key={project.id}>
                    <Link
                      to={`/workspaces/${workspaceId}/projects/${project.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-elevated/60 hover:text-foreground"
                    >
                      <FolderKanban className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-elevated/60 hover:text-foreground"
            >
              <Plus className="size-4" aria-hidden />
              New workspace
            </Link>
          </section>
        </nav>

        <div className="flex items-center gap-1 border-t border-border px-3 py-2.5">
          {currentUser && (
            <>
              <NotificationsPanel
                workspaceId={workspaceId}
                direction="up"
              />
              <UserMenu direction="up" />
            </>
          )}
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-on-primary">
            <KanbanSquare className="size-4" aria-hidden />
          </span>
          <span className="font-display font-semibold">DevFlow</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationsPanel
            workspaceId={workspaceId}
            direction="down"
          />
          <UserMenu compact direction="down" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
