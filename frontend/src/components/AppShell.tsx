import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarRange,
  CircleUserRound,
  FolderKanban,
  House,
  KanbanSquare,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./ui/Avatar";
import { CommandPalette } from "./CommandPalette";
import { NotificationsPanel } from "./notifications/NotificationsPanel";
import { UserMenu } from "./user/UserMenu";
import type { ProjectResponse, WorkspaceResponse } from "../types/api";

const BOARD_PATH_KEY = "devflow.lastBoardPath";
const SPRINT_PATH_KEY = "devflow.lastSprintPath";

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const workspaceId = location.pathname.match(
    /^\/workspaces\/([0-9a-f-]{36})/i,
  )?.[1];

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    const match = location.pathname.match(
      /^\/workspaces\/([0-9a-f-]{36})\/projects\/([0-9a-f-]{36})(\/sprints)?$/i,
    );
    if (!match) return;
    try {
      localStorage.setItem(
        match[3] ? SPRINT_PATH_KEY : BOARD_PATH_KEY,
        location.pathname,
      );
    } catch {}
  }, [location.pathname]);

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

  const onBoardRoute =
    /^\/workspaces\/[0-9a-f-]{36}\/projects\/[0-9a-f-]{36}$/i.test(
      location.pathname,
    );
  const onSprintsRoute = /\/sprints$/i.test(location.pathname);

  const mobileNavItems = [
    {
      key: "home",
      label: "Home",
      icon: House,
      active: location.pathname === "/",
      onClick: () => navigate("/"),
    },
    {
      key: "board",
      label: "Board",
      icon: KanbanSquare,
      active: onBoardRoute,
      onClick: () =>
        navigate(
          localStorage.getItem(BOARD_PATH_KEY) ??
            (workspaceId && projects?.length
              ? `/workspaces/${workspaceId}/projects/${projects[0].id}`
              : "/"),
        ),
    },
    {
      key: "sprints",
      label: "Sprints",
      icon: CalendarRange,
      active: onSprintsRoute,
      onClick: () =>
        navigate(
          localStorage.getItem(SPRINT_PATH_KEY) ??
            (onBoardRoute || workspaceId
              ? `${location.pathname.replace(/\/sprints$/i, "")}/sprints`
              : "/"),
        ),
    },
    {
      key: "search",
      label: "Search",
      icon: Search,
      active: false,
      onClick: () => setPaletteOpen(true),
    },
    {
      key: "profile",
      label: "Profile",
      icon: CircleUserRound,
      active: location.pathname === "/profile",
      onClick: () => navigate("/profile"),
    },
  ];

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={`fixed inset-y-0 left-0 z-[60] flex w-60 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          drawerOpen
            ? "translate-x-0 shadow-[0_24px_80px_rgba(0,0,0,0.7)] lg:shadow-none"
            : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between pr-2">
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
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground lg:hidden"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground"
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

      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-[55] cursor-default bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-on-primary">
              <KanbanSquare className="size-4" aria-hidden />
            </span>
            <span className="font-display font-semibold">DevFlow</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsPanel
            workspaceId={workspaceId}
            direction="down"
          />
          <UserMenu compact direction="down" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pt-14 pb-16 lg:pt-0 lg:pb-0">
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {mobileNavItems.map(({ key, label, icon: Icon, active, onClick }) => (
          <button
            key={key}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={onClick}
            className={`flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-150 ${
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
