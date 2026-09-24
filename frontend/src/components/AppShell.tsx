import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bookmark,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CircleUserRound,
  FileText,
  Github,
  House,
  KanbanSquare,
  List,
  ListTodo,
  Menu,
  Milestone as MilestoneIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Tag,
  Users,
  Webhook as WebhookIcon,
  X,
} from "lucide-react";
import { api, pagedItems } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useWorkspaceEvents } from "../hooks/useWorkspaceEvents";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./ui/Avatar";
import { BrandMark, Logo } from "./ui/Logo";
import { Button } from "./ui/Button";
import { EmojiTile } from "./ui/EmojiCover";
import { ErrorAlert } from "./ui/ErrorAlert";
import { CommandPalette } from "./CommandPalette";
import { AiAssistantPanel } from "./ai/AiAssistantPanel";
import type { AiPageContext } from "./ai/AiSuggestedPrompts";
import { ApiStatusDot } from "./user/ApiStatusDot";
import { ThemeToggle } from "./ui/ThemeToggle";
import { NotificationsPanel } from "./notifications/NotificationsPanel";
import { UserMenu } from "./user/UserMenu";
import type { ProjectResponse, WorkspaceResponse } from "../types/api";

const BOARD_PATH_KEY = "devflow.lastBoardPath";
const SPRINT_PATH_KEY = "devflow.lastSprintPath";
const SIDEBAR_KEY = "devflow.sidebarCollapsed";
const SIDEBAR_MODE_KEY = "devflow.sidebarMode";
// Last workspace the user actually visited — lets AI open on non-workspace
// routes (/, /profile, /settings…) where the URL has no workspaceId.
const LAST_WS_KEY = "devflow.lastWorkspaceId";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readLastWorkspaceId(): string | null {
  try {
    const id = localStorage.getItem(LAST_WS_KEY);
    return id && UUID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Left-sidebar body: classic nav menus vs the AI assistant panel. */
type SidebarMode = "nav" | "ai";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const modeSwitchRef = useRef<HTMLButtonElement>(null);
  // Desktop-only: collapse the sidebar into a narrow icon rail. Remembered
  // across reloads; the mobile drawer is unaffected (see aside className).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  // Body mode under the logo: Nav ↔ AI. Remembered across reloads; default nav.
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    try {
      return localStorage.getItem(SIDEBAR_MODE_KEY) === "ai" ? "ai" : "nav";
    } catch {
      return "nav";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_MODE_KEY, sidebarMode);
    } catch {}
  }, [sidebarMode]);

  // The collapsed rail expands ONLY via the toggle button (setCollapsed).
  // A previous hover-peek (floating the full panel on mouseenter) was removed:
  // resting the pointer is not intent, and users found the rail springing
  // open under the cursor unpredictable. Labels come back on click alone.

  const workspaceId = location.pathname.match(
    /^\/workspaces\/([0-9a-f-]{36})/i,
  )?.[1];

  const projectId = location.pathname.match(
    /^\/workspaces\/[0-9a-f-]{36}\/projects\/([0-9a-f-]{36})/i,
  )?.[1];

  // Workspace list must resolve before the AI gate: the panel is workspace-
  // scoped on the API, but the switch should work on every AppShell page —
  // route id first, else last visited (validated once the list loads), else
  // the member's first workspace.
  const {
    data: workspacesRaw,
    error: workspacesError,
    reload: reloadWorkspaces,
  } = useApi<unknown>(() => api("/workspaces"), []);
  const workspaces = useMemo(
    () => pagedItems<WorkspaceResponse>(workspacesRaw),
    [workspacesRaw],
  );
  // useApi keeps the previous data on failure, so "failed with nothing
  // cached" is error && raw === null — `!workspaces.length` would be a lie.
  const workspacesFailed = workspacesError !== null && workspacesRaw === null;

  // Remember the route's workspace so leaving it still has an AI context.
  useEffect(() => {
    if (!workspaceId) return;
    try {
      localStorage.setItem(LAST_WS_KEY, workspaceId);
    } catch {}
  }, [workspaceId]);

  // Read localStorage each render (not memoized): Dashboard's workspace
  // picker writes the same key, and the AI click re-renders this shell.
  const aiWorkspaceId: string | null = (() => {
    if (workspaceId) return workspaceId;
    const last = readLastWorkspaceId();
    if (workspacesRaw !== null) {
      // List loaded: only trust `last` if membership still holds.
      if (last && workspaces.some((w) => w.id === last)) return last;
      return workspaces[0]?.id ?? null;
    }
    // Still in flight (or failed with nothing cached): keep last optimistically
    // so a remembered AI mode isn't force-reset mid-load.
    return last;
  })();

  // Mode AI needs a workspace context (API is workspace-scoped). Force nav
  // only once the list has settled and no id is available — a stale
  // localStorage "ai" must not blank the sidebar with an unusable panel.
  useEffect(() => {
    if (aiWorkspaceId) return;
    if (workspacesRaw === null && !workspacesFailed) return; // still loading
    if (sidebarMode === "ai") setSidebarMode("nav");
  }, [aiWorkspaceId, workspacesRaw, workspacesFailed, sidebarMode]);

  // Mode AI ignores the collapsed preference: both modes share the expanded
  // width (w-80) so the body never jumps size when switching Nav ↔ AI.
  const effectiveMode: SidebarMode = aiWorkspaceId ? sidebarMode : "nav";
  const modeAi = effectiveMode === "ai";
  const railCollapsed = collapsed && !modeAi;

  // Collapsed-rail design system (A33): every clickable becomes a centered
  // 36px square cell so icons, emoji tiles and the avatar share one optical
  // grid instead of the old mixed-size leftovers.
  const railCell = railCollapsed
    ? "lg:mx-auto lg:flex lg:h-9 lg:w-9 lg:items-center lg:justify-center lg:p-0"
    : "";
  // 20px icons read better inside the 36px cells than the 16px defaults.
  const railIcon = railCollapsed ? "lg:size-5" : "";
  // Hairline between nav groups replaces the hidden section headings.
  const railDivider = railCollapsed
    ? "lg:border-t lg:border-border/60 lg:pt-3"
    : "";

  // Focus: open AI → rAF focus composer (panel does this on `open`);
  // close AI → return focus to the switch so keyboard users aren't stranded.
  const prevModeAi = useRef(modeAi);
  useEffect(() => {
    if (prevModeAi.current === modeAi) return;
    const closing = prevModeAi.current && !modeAi;
    prevModeAi.current = modeAi;
    if (closing) modeSwitchRef.current?.focus();
  }, [modeAi]);

  const pageContext = useMemo((): AiPageContext => {
    if (!workspaceId) {
      // Non-workspace AppShell routes (/, /profile, /settings, …): "/" is
      // the dashboard when authed; everything else is workspace-level context.
      if (location.pathname === "/" || location.pathname === "/dashboard")
        return "dashboard";
      return "workspace";
    }
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

  // WCAG 2.4.3 (Focus Order): a route change replaced the whole tree, and
  // focus landed back on <body> — so a screen-reader user never heard the
  // new page announced (the h1-mirror retitles the tab, but that is a
  // visual-only signal). Move focus to the main region, the same target the
  // skip-link uses, when nothing already claimed it: a page that
  // autofocuses its first field (search, a create dialog) must win, and
  // this runs after child effects — hence the "only if focus fell to body"
  // guard, not "always".
  useEffect(() => {
    if (document.activeElement && document.activeElement !== document.body)
      return;
    document.getElementById("devflow-content")?.focus();
  }, [location.pathname]);

  // WCAG 2.4.2 (Page Titled): the authed pages share one index.html title,
  // and only the board bothered to override it — so after visiting a board,
  // every other page kept showing the project's name. Rather than a title
  // per page, mirror the page's own visible <h1>: it is already unique,
  // already localized, and data-loaded headings (board/project names, which
  // render "Loading…" until the fetch lands) update through the observer
  // when they arrive.
  useEffect(() => {
    const main = document.getElementById("devflow-content");
    if (!main) return;
    function readTitle() {
      const text = main?.querySelector("h1")?.textContent?.trim();
      if (text) document.title = `${text} — DevFlow`;
    }
    readTitle();
    const observer = new MutationObserver(readTitle);
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  // Onboarding tour on mobile: sidebar steps need the drawer open so the
  // spotlight can land on a real element (not a text-only fallback card).
  // Events come from OnboardingTour.requestSidebarDrawer / requestNavSidebar.
  useEffect(() => {
    const onOpen = () => setDrawerOpen(true);
    const onClose = () => setDrawerOpen(false);
    // Tour needs data-tour="sidebar-workspaces" which only renders in nav
    // mode — leaving AI mode mid-tour would otherwise freeze the overlay.
    const onEnsureNav = () => setSidebarMode("nav");
    window.addEventListener("devflow:open-sidebar", onOpen);
    window.addEventListener("devflow:close-sidebar", onClose);
    window.addEventListener("devflow:ensure-nav-sidebar", onEnsureNav);
    return () => {
      window.removeEventListener("devflow:open-sidebar", onOpen);
      window.removeEventListener("devflow:close-sidebar", onClose);
      window.removeEventListener("devflow:ensure-nav-sidebar", onEnsureNav);
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    // The drawer is the app's modal on mobile and the rest of the chrome is
    // inert while it is open (see the header/main/nav inert={drawerOpen});
    // moving focus inside it stops keyboard users from being stranded on
    // body, and returning focus on close mirrors the Dialog primitive.
    // Skip the focus move while the onboarding tour owns focus (portal card
    // outside <main>): otherwise opening the drawer yanks Tab out of Next.
    const previous = document.activeElement as HTMLElement | null;
    const tourOwnsFocus = document.getElementById("devflow-tour-root") !== null;
    if (!tourOwnsFocus) {
      drawerRef.current
        ?.querySelector<HTMLElement>("a[href], button:not([disabled])")
        ?.focus();
    }
    function onKeyDown(event: KeyboardEvent) {
      // Tour handles Esc itself; only close the drawer when no tour card is up.
      if (event.key === "Escape" && !document.getElementById("devflow-tour-root")) {
        setDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (!tourOwnsFocus) previous?.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    // Crossing into the lg breakpoint while the drawer is open would strand
    // the background inert with no visible way to close it (the desktop rail
    // ignores drawerOpen, and the overlay is lg:hidden). Close on the way up.
    const desktop = window.matchMedia("(min-width: 64rem)");
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setDrawerOpen(false);
    }
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

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

  // Refresh the workspace sidebar when a workspace-level event arrives
  // (e.g. a workspace created elsewhere or via AI) — no F5 needed.
  const handleWorkspaceEvent = useCallback(() => {
    reloadWorkspaces();
  }, [reloadWorkspaces]);
  useWorkspaceEvents(workspaceId, handleWorkspaceEvent);
  const {
    data: projectsRaw,
    error: projectsError,
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
  const projectsFailed = projectsError !== null && projectsRaw === null;

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

  // Primary project navigation, shown in the sidebar while a project route is
  // active. These were previously reachable only through a hidden popover on
  // the board header — the single biggest "feature feels missing" complaint.
  const projectNavItems = projectId
    ? [
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/calendar`,
          icon: CalendarDays,
          label: t("nav.calendar"),
          match: /\/calendar$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/sprints`,
          icon: CalendarRange,
          label: t("nav.sprints"),
          match: /\/sprints$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/reports`,
          icon: BarChart3,
          label: t("nav.reports"),
          match: /\/reports$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/epics`,
          icon: List,
          label: t("nav.epics"),
          match: /\/epics$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/milestones`,
          icon: MilestoneIcon,
          label: t("nav.milestones"),
          match: /\/milestones$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/knowledge`,
          icon: BookOpen,
          label: t("nav.knowledge"),
          match: /\/knowledge$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/labels`,
          icon: Tag,
          label: t("nav.labels"),
          match: /\/labels$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/templates`,
          icon: FileText,
          label: t("nav.templates"),
          match: /\/templates$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/fields`,
          icon: Settings2,
          label: t("nav.customFields"),
          match: /\/fields$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/github`,
          icon: Github,
          label: t("nav.github"),
          match: /\/github$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/activities`,
          icon: Activity,
          label: t("activity.title"),
          match: /\/activities$/i,
        },
        {
          to: `/workspaces/${workspaceId}/projects/${projectId}/settings`,
          icon: Users,
          label: t("projectMember.title"),
          match: /\/projects\/[0-9a-f-]{36}\/settings$/i,
        },
        {
          to: `/workspaces/${workspaceId}/webhooks`,
          icon: WebhookIcon,
          label: t("nav.webhooks"),
          match: /\/webhooks$/i,
        },
        {
          to: `/workspaces/${workspaceId}/search`,
          icon: Search,
          label: t("nav.search"),
          match: /\/search$/i,
        },
        {
          to: "/saved-searches",
          icon: Bookmark,
          label: t("savedSearch.title"),
          match: /^\/saved-searches$/i,
        },
      ]
    : [];

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
            // Failed project list: jumping to "/" would claim "you have no
            // projects". Send the user to the workspace page, which shows
            // its own error state instead.
            (projectsFailed && workspaceId
              ? `/workspaces/${workspaceId}`
              : workspaceId && projects?.length
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
      {/* First tab stop on every screen: jumps past the drawer, header, and
          primary nav straight into the page (WCAG 2.4.1). Painted only while
          focused, so mouse users never see it. */}
      <a
        href="#devflow-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground"
      >
        {t("ui.skipToContent")}
      </a>
      <aside
        ref={drawerRef}
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen ? true : undefined}
        aria-label={drawerOpen ? t("ui.menuDialogAria") : undefined}
        /* Expanded = w-80 (320px): Nav labels + AI dock (composer, prompts)
           both need the room; collapsed rail stays 72px. Nav ↔ AI share this
           width so the body never jumps on switch. */
        className={`fixed inset-y-0 left-0 z-[60] flex w-80 shrink-0 flex-col border-r border-border bg-surface duration-300 ease-out lg:relative lg:z-auto lg:translate-x-0 lg:transition-[width] lg:duration-300 lg:ease-out ${
          railCollapsed ? "lg:w-[72px]" : "lg:w-80"
        } ${
          drawerOpen
            ? "translate-x-0 transition-transform shadow-[0_24px_80px_rgba(0,0,0,0.7)] lg:shadow-none"
            : "-translate-x-full invisible lg:visible transition-[transform,visibility]"
        }`}
        /* The open state drops visibility from the transition list on
           purpose: discrete properties flip at the halfway point, so the
           drawer would stay computed-hidden for ~150ms while the mount
           effect already runs the focus move (see the drawerOpen effect). */
        /* Kept for dropdown menus (UserMenu, NotificationsPanel) anchored in
           the sidebar footer; see bf3155b. */
        style={{ overflow: 'visible' }}
      >
        <div className="flex min-h-0 flex-1 flex-col">
        <div className={`flex items-center justify-between pr-2 ${railCollapsed ? "lg:justify-center lg:pr-0" : ""}`}>
          <Link
            to="/"
            className={`flex items-center px-4 py-4 ${railCollapsed ? "lg:h-14 lg:justify-center lg:px-0 lg:py-0" : ""}`}
            aria-label="DevFlow home"
            title="DevFlow"
          >
            <Logo className={`${railCollapsed ? "lg:hidden" : ""}`} />
            <span className={railCollapsed ? "hidden lg:inline" : "hidden"}>
              <BrandMark size="lg" />
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

        {/* Nav ↔ AI body switch — under the logo, same rail cell pattern so
            the collapsed icon rail stays one optical grid. Disabled only when
            no workspace id is available at all (no members / list failed).
            Icon + label metrics mirror the search cell below (size-3.5,
            flex-1, px-2.5 py-1.5). */}
        <div className={`shrink-0 pb-2 ${railCollapsed ? "lg:px-2" : "px-3"}`}>
          <button
            ref={modeSwitchRef}
            type="button"
            aria-pressed={modeAi}
            aria-label={modeAi ? t("ai.assistantClose") : t("ai.assistantOpen")}
            title={t("ai.assistant")}
            disabled={!aiWorkspaceId}
            onClick={() => {
              // Entering AI always lands on the expanded width; leaving AI
              // then stays expanded (no surprise-collapse back to 72px).
              if (!modeAi) setCollapsed(false);
              setSidebarMode(modeAi ? "nav" : "ai");
            }}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${railCell} ${
              modeAi
                ? "border-primary/40 bg-primary/10 text-primary-strong"
                : "bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
            }`}
          >
            <Sparkles className={`size-3.5 shrink-0 ${railIcon}`} aria-hidden />
            <span className={`flex-1 text-left ${railCollapsed ? "lg:hidden" : ""}`}>
              {t("ai.assistant")}
            </span>
          </button>
        </div>

        {/* AI body stays mounted whenever a workspace id is in scope (route
            or fallback) so chat history/draft survive Nav ↔ AI and the panel
            works on every AppShell page; `hidden` takes it out of the a11y
            tree and the tab order while mode is nav. */}
        {aiWorkspaceId && (
          <div
            id="sidebar-ai-panel"
            role="region"
            aria-label={t("ai.assistant")}
            aria-hidden={!modeAi}
            className={
              modeAi
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "hidden"
            }
          >
            <AiAssistantPanel
              open={modeAi}
              onClose={() => setSidebarMode("nav")}
              workspaceId={aiWorkspaceId}
              projectId={projectId}
              context={pageContext}
              variant="dock"
              onTaskChanged={handleAiTaskChanged}
            />
          </div>
        )}

        {!modeAi && (
        <nav aria-label={t("ui.sidebarNavAria")} className={`flex-1 space-y-6 overflow-y-auto px-3 pb-4 ${railCollapsed ? "lg:space-y-3 lg:px-2" : ""}`}>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title={t("nav.search")}
            // Label in Name (2.5.3): visible text is placeholder + ⌃K; the
            // old aria-label dropped the kbd so axe label-content-name-mismatch
            // failed when the rail was expanded.
            aria-label={`${t("nav.searchPlaceholder")} ⌃K`}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground ${railCell}`}
          >
            <Search className={`size-3.5 ${railIcon}`} aria-hidden />
            <span className={`flex-1 text-left ${railCollapsed ? "lg:hidden" : ""}`}>
              {t("nav.searchPlaceholder")}
            </span>
            <kbd className={`rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px] ${railCollapsed ? "lg:hidden" : ""}`}>
              ⌃K
            </kbd>
          </button>

          <section data-tour="sidebar-workspaces" className={railDivider}>
            <h2 className={`px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground ${railCollapsed ? "lg:hidden" : ""}`}>
              {t("nav.workspaces")}
            </h2>
            <ul role="list" className="space-y-1">
              {(workspaces ?? []).map((workspace) => {
                const active = workspace.id === workspaceId;
                return (
                  <li key={workspace.id}>
                    <Link
                      to={`/workspaces/${workspace.id}`}
                      aria-current={active ? "page" : undefined}
                      title={railCollapsed ? workspace.name : undefined}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${railCell} ${
                        active
                          ? "bg-elevated font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                      }`}
                    >
                      {workspace.emoji ? (
                        <EmojiTile
                          emoji={workspace.emoji}
                          size="sm"
                          className={railCollapsed ? "lg:size-8 lg:text-lg" : ""}
                        />
                      ) : (
                        <Avatar
                          name={workspace.name}
                          id={workspace.id}
                          className={railCollapsed ? "lg:size-8 lg:text-xs" : ""}
                        />
                      )}
                      <span className={`truncate ${railCollapsed ? "lg:hidden" : ""}`}>{workspace.name}</span>
                    </Link>
                  </li>
                );
              })}
              {workspacesFailed && (
                /* Intentionally NOT lg:hidden: hiding the failure behind the
                   collapsed rail's icon mode would rebuild the exact lie
                   this branch removes (silent "no workspaces"). */
                <li className="space-y-1.5 px-2 py-1">
                  <ErrorAlert
                    message={t("nav.workspacesLoadFailed")}
                    id="sidebar-workspaces-error"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reloadWorkspaces}
                  >
                    {t("common.retry")}
                  </Button>
                </li>
              )}
              {workspacesRaw === null && !workspacesFailed && (
                <li className={`space-y-1.5 px-2 py-1 ${railCollapsed ? "lg:hidden" : ""}`}>
                  <div className="skeleton h-6 w-full" />
                  <div className="skeleton h-6 w-4/5" />
                </li>
              )}
            </ul>
          </section>

          {workspaceId && (
            <section className={railDivider}>
              <h2 className={`px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground ${railCollapsed ? "lg:hidden" : ""}`}>
                {t("nav.projects")}
              </h2>
              <ul role="list" className="space-y-1">
                {(projects ?? []).map((project) => {
                  const active = project.id === projectId;
                  return (
                    <li key={project.id}>
                      <Link
                        to={`/workspaces/${workspaceId}/projects/${project.id}`}
                        aria-current={active ? "page" : undefined}
                        title={railCollapsed ? project.name : undefined}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${railCell} ${
                          active
                            ? "bg-elevated font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                        }`}
                      >
                        {/* EmojiTile renders nothing without an emoji; a bare
                            link whose only other child hides in the rail left
                            an invisible 36px cell with no hover feedback.
                            Fall back to initials like the workspace rows. */}
                        {project.emoji ? (
                          <EmojiTile
                            emoji={project.emoji}
                            size="sm"
                            className={railCollapsed ? "lg:size-8 lg:text-lg" : ""}
                          />
                        ) : (
                          <Avatar
                            name={project.name}
                            id={project.id}
                            className={railCollapsed ? "lg:size-8 lg:text-xs" : ""}
                          />
                        )}
                        <span className={`truncate ${railCollapsed ? "lg:hidden" : ""}`}>{project.name}</span>
                      </Link>
                    </li>
                  );
                })}
                {projectsFailed && (
                  <li className="space-y-1.5 px-2 py-1">
                    <ErrorAlert
                      message={t("nav.projectsLoadFailed")}
                      id="sidebar-projects-error"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={reloadProjects}
                    >
                      {t("common.retry")}
                    </Button>
                  </li>
                )}
              </ul>
            </section>
          )}

          {workspaceId && projectId && (
            <section className={railDivider}>
              <h2 className={`px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground ${railCollapsed ? "lg:hidden" : ""}`}>
                {t("nav.projectNav")}
              </h2>
              <ul role="list" className="space-y-1">
                {projectNavItems.map(({ to, icon: Icon, label, match }) => {
                  const active = match.test(location.pathname);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        aria-current={active ? "page" : undefined}
                        title={railCollapsed ? label : undefined}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${railCell} ${
                          active
                            ? "bg-elevated font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                        }`}
                      >
                        <Icon className={`size-4 shrink-0 ${railIcon}`} aria-hidden />
                        <span className={`truncate ${railCollapsed ? "lg:hidden" : ""}`}>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {workspaceId && (
            <section className={railDivider}>
              <h2 className={`px-2 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground ${railCollapsed ? "lg:hidden" : ""}`}>
                {t("nav.personal")}
              </h2>
              <ul role="list" className="space-y-1">
                <li>
                  <Link
                    to={`/workspaces/${workspaceId}/my-tasks`}
                    title={railCollapsed ? t("nav.myTasks") : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${railCell} ${
                      location.pathname.endsWith("/my-tasks")
                        ? "bg-elevated font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                    }`}
                  >
                    <ListTodo className={`size-4 ${railIcon}`} aria-hidden />
                    <span className={`${railCollapsed ? "lg:hidden" : ""}`}>{t("nav.myTasks")}</span>
                  </Link>
                </li>
              </ul>
            </section>
          )}

          <section className={railDivider}>
            <Link
              to="/"
              title={railCollapsed ? t("nav.newWorkspace") : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-elevated/60 hover:text-foreground ${railCell}`}
            >
              <Plus className={`size-4 ${railIcon}`} aria-hidden />
              <span className={`${railCollapsed ? "lg:hidden" : ""}`}>{t("nav.newWorkspace")}</span>
            </Link>
          </section>

          </nav>
        )}

        <div
          data-tour="sidebar-bottom"
          className={`relative shrink-0 border-t border-border py-2.5 ${railCollapsed ? "lg:px-2" : "px-3"}`}
        >
          {currentUser && (
            <div className={`flex items-center gap-1.5 ${railCollapsed ? "lg:flex-col lg:gap-2" : ""}`}>
              <ApiStatusDot className={railCollapsed ? "lg:hidden" : ""} />
              <NotificationsPanel
                workspaceId={workspaceId}
                direction="up"
                triggerClassName={railCell}
              />
              {/* In the 72px rail the full avatar + name + chevron trigger overflows
                  (long Gmail addresses). Collapse it to the avatar-only form, with
                  the API warmth dot hung off its corner. */}
              <UserMenu
                direction="up"
                compact={railCollapsed}
                icon={
                  railCollapsed ? (
                    <span className="relative inline-flex">
                      <Avatar
                        name={currentUser.username}
                        id={currentUser.id}
                        src={currentUser.avatarUrl}
                        className="size-8 text-xs"
                      />
                      <ApiStatusDot className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface" />
                    </span>
                  ) : undefined
                }
                triggerClassName={railCell}
              />
            </div>
          )}
          {/* Collapse only makes sense for the nav body — a 72px AI chat would
              be unusable, and mode AI already forces the expanded width. */}
          {!modeAi && (
            <button
              type="button"
              aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
              title={collapsed ? t("nav.expand") : t("nav.collapse")}
              onClick={() => setCollapsed((v) => !v)}
              className={`hidden w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground lg:flex ${railCell}`}
            >
              {collapsed ? <PanelLeftOpen className={`size-4 shrink-0 ${railIcon}`} aria-hidden /> : <PanelLeftClose className={`size-4 shrink-0 ${railIcon}`} aria-hidden />}
              <span className={`${railCollapsed ? "hidden lg:hidden" : ""}`}>{collapsed ? t("nav.expand") : t("nav.collapse")}</span>
            </button>
          )}
        </div>
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

      {/* When the drawer is open it is the app's modal: inert keeps header,
          page content, and the bottom bar out of the tab order and hides them
          from assistive tech, so keyboard focus stays inside the drawer.
          Portals to document.body (dropdown panels, command palette) are not
          inside these elements and remain reachable. */}
      <header inert={drawerOpen} className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
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
          <ThemeToggle compact />
          <NotificationsPanel
            workspaceId={workspaceId}
            direction="down"
          />
          <UserMenu compact direction="down" />
        </div>
      </header>

      {/* tabIndex -1 makes the hash jump move focus into the page: without it
          the browser only scrolls, and the next Tab restarts at the nav the
          skip link just bypassed. inert (drawer open) still blocks the focus,
          which is correct then. */}
      <main id="devflow-content" tabIndex={-1} inert={drawerOpen} className="min-w-0 flex-1 overflow-y-auto pt-14 pb-16 outline-none scroll-pt-16 scroll-pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0 lg:scroll-pt-0 lg:scroll-pb-0">
        {children}
      </main>

      <nav
        aria-label={t("ui.primaryNavAria")}
        inert={drawerOpen}
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
