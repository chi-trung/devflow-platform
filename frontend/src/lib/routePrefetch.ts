// Route-shape → page-chunk prefetch table, mirroring App.tsx's lazy() routes.
//
// Vite dedupes dynamic import() by resolved module id: `import("../pages/
// BoardPage")` here and App.tsx's lazy(() => import("./pages/BoardPage"))
// resolve to the SAME chunk, so a prefetch warms exactly the module the
// router will ask for next. A wrong path fails tsc/Rollup at build time, not
// at hover time.

type PageLoader = () => Promise<unknown>;

interface RouteShape {
  /** Stable key: the dedupe bucket in `once` and the test's return value. */
  name: string;
  test: RegExp;
  load: PageLoader;
}

// Anchored patterns only, so shapes are disjoint (the nested `/settings`
// project route can never swallow the top-level account `/settings`, and
// vice versa). Order therefore does not affect correctness — static routes
// first for readability. NotFoundPage is deliberately absent: it only ever
// renders for unmatched URLs, which no link points at.
const ROUTES: RouteShape[] = [
  { name: "dashboard", test: /^\/$/, load: () => import("../pages/DashboardPage") },
  { name: "login", test: /^\/login$/, load: () => import("../pages/LoginPage") },
  { name: "register", test: /^\/register$/, load: () => import("../pages/RegisterPage") },
  { name: "profile", test: /^\/profile$/, load: () => import("../pages/ProfilePage") },
  { name: "settings", test: /^\/settings$/, load: () => import("../pages/SettingsPage") },
  { name: "notifications", test: /^\/notifications$/, load: () => import("../pages/NotificationsPage") },
  { name: "saved-searches", test: /^\/saved-searches$/, load: () => import("../pages/SavedSearchesPage") },
  { name: "changelog", test: /^\/changelog$/, load: () => import("../pages/ChangelogPage") },
  { name: "blog", test: /^\/blog$/, load: () => import("../pages/BlogPage") },
  { name: "privacy", test: /^\/privacy$/, load: () => import("../pages/LegalPages") },
  { name: "terms", test: /^\/terms$/, load: () => import("../pages/LegalPages") },
  { name: "workspace", test: /^\/workspaces\/[^/]+$/, load: () => import("../pages/WorkspacePage") },
  { name: "my-tasks", test: /^\/workspaces\/[^/]+\/my-tasks$/, load: () => import("../pages/MyTasksPage") },
  { name: "search", test: /^\/workspaces\/[^/]+\/search$/, load: () => import("../pages/SearchPage") },
  { name: "workspace-webhooks", test: /^\/workspaces\/[^/]+\/webhooks$/, load: () => import("../pages/WebhooksPage") },
  { name: "board", test: /^\/workspaces\/[^/]+\/projects\/[^/]+$/, load: () => import("../pages/BoardPage") },
  // The legacy /tasks/:id path only redirects onto the board's ?task=
  // overlay — warm the board chunk (the real destination), not the thin
  // redirect shell.
  { name: "task-detail", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/tasks\/[^/]+$/, load: () => import("../pages/BoardPage") },
  { name: "sprints", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/sprints$/, load: () => import("../pages/SprintPlanningPage") },
  { name: "reports", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/reports$/, load: () => import("../pages/ReportsPage") },
  { name: "epics", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/epics$/, load: () => import("../pages/EpicsPage") },
  { name: "milestones", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/milestones$/, load: () => import("../pages/MilestonesPage") },
  { name: "knowledge", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/knowledge$/, load: () => import("../pages/KnowledgePage") },
  { name: "labels", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/labels$/, load: () => import("../pages/LabelsPage") },
  { name: "fields", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/fields$/, load: () => import("../pages/CustomFieldsPage") },
  { name: "templates", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/templates$/, load: () => import("../pages/TemplatesPage") },
  { name: "github", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/github$/, load: () => import("../pages/GitHubPage") },
  { name: "activities", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/activities$/, load: () => import("../pages/ActivitiesPage") },
  { name: "project-settings", test: /^\/workspaces\/[^/]+\/projects\/[^/]+\/settings$/, load: () => import("../pages/ProjectSettingsPage") },
];

// Chunks the signed-in first paint is most likely to need next. Fired from
// main.tsx during the boot locale wait when a session token exists.
const AUTHED_CORE = [
  "dashboard",
  "workspace",
  "board",
  "my-tasks",
  "notifications",
] as const;

/**
 * Resolves a pathname or anchor href to a route key, or null when no lazy
 * route matches. Query/hash are stripped and one trailing slash ignored, so
 * callers can pass `a.getAttribute("href")` verbatim.
 */
export function matchRoute(href: string): string | null {
  let path = href;
  const cut = path.search(/[?#]/);
  if (cut !== -1) path = path.slice(0, cut);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  for (const route of ROUTES) {
    if (route.test.test(path)) return route.name;
  }
  return null;
}

// Dedupe buckets across the whole session (shared by boot prefetch and the
// hover listener — both live in the same module instance). A failed load
// deletes its key so the next hover/focus retries instead of poisoning the
// route for the rest of the visit.
const started = new Set<string>();

/** Runs `load` at most once per key; a rejection re-arms the key. Exported
 *  (not just used internally) because the retry-on-error path is the
 *  interesting failure mode and needs an injectable loader to test. */
export function once(key: string, load: PageLoader): void {
  if (started.has(key)) return;
  started.add(key);
  void load().catch(() => {
    started.delete(key);
  });
}

/** Warms the chunk for an internal href (callers pass paths starting "/").
 *  Unknown shapes are a no-op — the router's lazy() still resolves on the
 *  actual navigation, so a table gap costs the old behavior, nothing more. */
export function prefetchRoute(href: string): void {
  const name = matchRoute(href);
  if (!name) return;
  const route = ROUTES.find((r) => r.name === name);
  if (route) once(route.name, route.load);
}

/** Fires the chunks the first signed-in navigation usually needs, in parallel
 *  with the boot locale wait (called from main.tsx when a session exists). */
export function prefetchAuthedCore(): void {
  for (const name of AUTHED_CORE) {
    const route = ROUTES.find((r) => r.name === name);
    if (route) once(route.name, route.load);
  }
}
