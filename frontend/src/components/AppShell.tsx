import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarRange,
  CircleUserRound,
  House,
  KanbanSquare,
  ListTodo,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  X,
} from "lucide-react";
import { api, pagedItems } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useWorkspaceEvents } from "../hooks/useWorkspaceEvents";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./ui/Avatar";
import { BrandMark, Logo } from "./ui/Logo";
import { EmojiTile } from "./ui/EmojiCover";
import { CommandPalette } from "./CommandPalette";
import { AiFloatingButton } from "./ai/AiFloatingButton";
import type { AiPageContext } from "./ai/AiSuggestedPrompts";
import { ApiStatusDot } from "./user/ApiStatusDot";
import { ThemeToggle } from "./ui/ThemeToggle";
import { NotificationsPanel } from "./notifications/NotificationsPanel";
import { UserMenu } from "./user/UserMenu";
import type { ProjectResponse, WorkspaceResponse } from "../types/api";

const BOARD_PATH_KEY = "devflow.lastBoardPath";
const SPRINT_PATH_KEY = "devflow.lastSprintPath";
const SIDEBAR_KEY = "devflow.sidebarCollapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Desktop-only: collapse the sidebar into a narrow icon rail. Remembered
  // across reloads; the mobile drawer is unaffected (see aside className).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  // The sidebar collapses to a 72px icon rail and expands via the explicit
  // toggle button — click-based only, no hover behavior. Collapsed state is the
  // pinned state; every layout branch reads `railCollapsed`.
  const railCollapsed = collapsed;

  const workspaceId = location.pathname.match(
    /^\/workspaces\/([0-9a-f-]{36})/i,
  )?.[1];

  const projectId = location.pathname.match(
    /^\/workspaces\/[0-9a-f-]{36}\/projects\/([0-9a-f-]{36})/i,
  )?.[1];

  const pageContext = useMemo((): AiPageContext => {
    if (!workspaceId) return "workspace";
    const path = location.pathname;
    if (/\/epics(\/|$)/i.test(path) && /\/projects\//i.test(path))
      return "epics";
    if (/\/sprints(\/|$)/i.test(path) && /\/projects\//i.test(path))
      return "sprints";
    if (/\/projects\//i.test(path) && !/\/sprints|\/epics/i.test(path))
      return "board";
    if (path.endsWith("/dashboard") || path === `/workspaces/${workspaceId}`)
      return "dashboard";
    return "workspace";
  }, [workspaceId, location.pathname]);

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

  // Warm the dashboard + activities caches as soon as we know the active
  // workspace so the first project view renders without a visible wait.
  const activeWorkspaceId = location.pathname.match(
    /^\/workspaces\/([0-9a-f-]{36})/i,
  )?.[1];
  useEffect(() => {
    if (!activeWorkspaceId) return;
    // Fire-and-forget: these populate the SWR cache used by the pages.
    void api(`/workspaces/${activeWorkspaceId}/dashboard`).catch(() => {});
  }, [activeWorkspaceId]);

  const {
    data: workspacesRaw,
    reload: reloadWorkspaces,
  } = useApi<unknown>(() => api("/workspaces"), []);
  const workspaces = useMemo(
    () => pagedItems<WorkspaceResponse>(workspacesRaw),
    [workspacesRaw],
  );

  // Refresh the workspace sidebar when a workspace-level event arrives
  // (e.g. a workspace created elsewhere or via AI) — no F5 needed.
  const handleWorkspaceEvent = useCallback(() => {
    reloadWorkspaces();
  }, [reloadWorkspaces]);
  useWorkspaceEvents(workspaceId, handleWorkspaceEvent);
  const {
    data: projectsRaw,
    reload: reloadProjects,
  } = useApi<unknown>(
    () =>
      workspaceId
        ? api(`/workspaces/${workspaceId}/projects`)
        : Promise.resolve([]),
    [workspaceId],
  );
  const projects = useMemo(
    () => pagedItems<ProjectResponse>(projectsRaw),
    [projectsRaw],
  );

  // After AI executes actions, refresh the workspace/project sidebars so
  // newly created entities appear without a manual F5.
  const handleAiTaskChanged = useCallback(() => {
    reloadWorkspaces();
    reloadProjects();
  }, [reloadWorkspaces, reloadProjects]);

  const onBoardRoute =
    /^\/workspaces\/[0-9a-f-]{36}\/projects\/[0-9a-f-]{36}$/i.test(
      location.pathname,
    );
  const onSprintsRoute = /\/sprints$/i.test(location.pathname);

  const mobileNavItems = [
    {
      key: "home",
      label: t("nav.home"),
      icon: House,
      active: location.pathname === "/",
      onClick: () => navigate("/"),
    },
    {
      key: "board",
      label: t("nav.board"),
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
      label: t("nav.sprints"),
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
      key: "myTasks",
      label: t("nav.myTasks"),
      icon: ListTodo,
      active: location.pathname.endsWith("/my-tasks"),
      onClick: () => {
        if (workspaceId) {
          navigate(`/workspaces/${workspaceId}/my-tasks`);
        } else if (workspaces?.length) {
          navigate(`/workspaces/${workspaces[0].id}/my-tasks`);
        }
      },
    },
    {
      key: "search",
      label: t("nav.search"),
      icon: Search,
      active: false,
      onClick: () => setPaletteOpen(true),
    },
    {
      key: "profile",
      label: t("nav.profile"),
      icon: CircleUserRound,
      active: location.pathname === "/profile",
      onClick: () => navigate("/profile"),
    },
  ];

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={`fixed inset-y-0 left-0 z-[60] flex w-60 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 lg:transition-[width] lg:duration-300 lg:ease-out ${
          railCollapsed ? "lg:w-[72px]" : "lg:w-60"
        } ${
          drawerOpen
            ? "translate-x-0 shadow-[0_24px_80px_rgba(0,0,0,0.7)] lg:shadow-none"
            : "-translate-x-full"
        }`}
        style={{ overflow: 'visible' }}
      >
        <div className={`flex items-center justify-between pr-2 ${railCollapsed ? "lg:justify-center lg:pr-0" : ""}`}>
          <Link
            to="/"
            className={`px-4 py-4 ${railCollapsed ? "lg:px-0" : ""}`}
            aria-label="DevFlow home"
            title="DevFlow"
          >
            <Logo className={`${railCollapsed ? "lg:hidden" : ""}`} />
            <span className={railCollapsed ? "hidden lg:inline" : "hidden"}>
              <BrandMark size="md" />
            </span>
          </Link>
          <button
            type="button"
            aria-label={t("ui.closeMenuAria")}
            onClick={() => setDrawerOpen(false)}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground lg:hidden"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className={`flex-1 space-y-6 overflow-y-auto px-3 pb-4 ${railCollapsed ? "lg:space-y-2 lg:px-2" : ""}`}>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title={t("nav.search")}
            aria-label={t("nav.searchPlaceholder")}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground ${
              railCollapsed ? "lg:justify-center lg:px-0 lg:py-2" : ""
            }`}
          >
            <Search className="size-3.5" aria-hidden />
            <span className={`flex-1 text-left ${railCollapsed ? "lg:hidden" : ""}`}>
              {t("nav.searchPlaceholder")}
            </span>
            <kbd className={`rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px] ${railCollapsed ? "lg:hidden" : ""}`}>
              ⌃K
            </kbd>
          </button>

          <section data-tour="sidebar-workspaces">
            <h2 className={`px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground ${railCollapsed ? "lg:hidden" : ""}`}>
              {t("nav.workspaces")}
            </h2>
            <ul className="space-y-0.5">
              {(workspaces ?? []).map((workspace) => {
                const active = workspace.id === workspaceId;
                return (
                  <li key={workspace.id}>
                    <Link
                      to={`/workspaces/${workspace.id}`}
                      aria-current={active ? "page" : undefined}
                      title={railCollapsed ? workspace.name : undefined}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${
                        railCollapsed ? "lg:justify-center" : ""
                      } ${
                        active
                          ? "bg-elevated font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                      }`}
                    >
                      {workspace.emoji ? (
                        <EmojiTile emoji={workspace.emoji} size="sm" />
                      ) : (
                        <Avatar name={workspace.name} id={workspace.id} />
                      )}
                      <span className={`truncate ${railCollapsed ? "lg:hidden" : ""}`}>{workspace.name}</span>
                    </Link>
                  </li>
                );
              })}
              {!workspaces && (
                <li className={`space-y-1.5 px-2 py-1 ${railCollapsed ? "lg:hidden" : ""}`}>
                  <div className="skeleton h-6 w-full" />
                  <div className="skeleton h-6 w-4/5" />
                </li>
              )}
            </ul>
          </section>

          {workspaceId && (
            <section>
              <h2 className={`px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground ${railCollapsed ? "lg:hidden" : ""}`}>
                {t("nav.projects")}
              </h2>
              <ul className="space-y-0.5">
                {(projects ?? []).map((project) => (
                  <li key={project.id}>
                    <Link
                      to={`/workspaces/${workspaceId}/projects/${project.id}`}
                      title={railCollapsed ? project.name : undefined}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-elevated/60 hover:text-foreground ${
                        railCollapsed ? "lg:justify-center" : ""
                      }`}
                    >
                      <EmojiTile emoji={project.emoji} size="sm" />
                      <span className={`truncate ${railCollapsed ? "lg:hidden" : ""}`}>{project.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {workspaceId && (
            <section>
              <h2 className={`px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground ${railCollapsed ? "lg:hidden" : ""}`}>
                {t("nav.personal")}
              </h2>
              <ul className="space-y-0.5">
                <li>
                  <Link
                    to={`/workspaces/${workspaceId}/my-tasks`}
                    title={railCollapsed ? t("nav.myTasks") : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${
                      railCollapsed ? "lg:justify-center" : ""
                    } ${
                      location.pathname.endsWith("/my-tasks")
                        ? "bg-elevated font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                    }`}
                  >
                    <ListTodo className="size-4" aria-hidden />
                    <span className={`${railCollapsed ? "lg:hidden" : ""}`}>{t("nav.myTasks")}</span>
                  </Link>
                </li>
              </ul>
            </section>
          )}

          <section>
            <Link
              to="/"
              title={railCollapsed ? t("nav.newWorkspace") : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-elevated/60 hover:text-foreground ${
                railCollapsed ? "lg:justify-center" : ""
              }`}
            >
              <Plus className="size-4" aria-hidden />
              <span className={`${railCollapsed ? "lg:hidden" : ""}`}>{t("nav.newWorkspace")}</span>
            </Link>
          </section>

          </nav>

        <div
          data-tour="sidebar-bottom"
          className={`relative shrink-0 border-t border-border py-2.5 ${railCollapsed ? "lg:px-2" : "px-3"}`}
        >
          {currentUser && (
            <div className={`flex items-center gap-1.5 ${railCollapsed ? "lg:justify-center" : ""}`}>
              <ApiStatusDot />
              <NotificationsPanel
                workspaceId={workspaceId}
                direction="up"
              />
              {/* In the 64px rail the full avatar + name + chevron trigger overflows
                  (long Gmail addresses). Collapse it to the icon-only form. */}
              <UserMenu direction="up" compact={railCollapsed} />
            </div>
          )}
          <button
            type="button"
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
            onClick={() => setCollapsed((v) => !v)}
            className={`hidden w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground lg:flex ${
              railCollapsed ? "lg:justify-center" : ""
            }`}
          >
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0" aria-hidden /> : <PanelLeftClose className="size-4 shrink-0" aria-hidden />}
            <span className={`${railCollapsed ? "hidden lg:hidden" : ""}`}>{collapsed ? t("nav.expand") : t("nav.collapse")}</span>
          </button>
        </div>
      </aside>

      {drawerOpen && (
        <button
          type="button"
          aria-label={t("ui.closeMenuAria")}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-[55] cursor-default bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={t("ui.openMenuAria")}
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <Logo size="sm" to="/" />
        </div>
        <div className="flex items-center gap-1.5">
          <ApiStatusDot />
          <ThemeToggle />
          <NotificationsPanel
            workspaceId={workspaceId}
            direction="down"
          />
          <UserMenu compact direction="down" />
        </div>
      </header>

      <main className="min-w-0 flex-1 overflow-y-auto pt-14 pb-16 lg:pt-0 lg:pb-0">
        {children}
      </main>

      <nav
        aria-label={t("ui.primaryNavAria")}
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

      {workspaceId && (
        <AiFloatingButton
          workspaceId={workspaceId}
          projectId={projectId}
          context={pageContext}
          onTaskChanged={handleAiTaskChanged}
        />
      )}
    </div>
  );
}
