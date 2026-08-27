import { lazy, Suspense, useEffect, useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { ToastProvider } from "./components/ui/ToastProvider";
import { API_BASE, api, pagedItems } from "./lib/api";
import { useApi } from "./hooks/useApi";
import type { ProjectResponse } from "./types/api";

const LandingPage = lazy(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then(m => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage").then(m => ({ default: m.WorkspacePage })));
const BoardPage = lazy(() => import("./pages/BoardPage").then(m => ({ default: m.BoardPage })));
const SprintPlanningPage = lazy(() => import("./pages/SprintPlanningPage").then(m => ({ default: m.SprintPlanningPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then(m => ({ default: m.ReportsPage })));
const SavedSearchesPage = lazy(() => import("./pages/SavedSearchesPage").then(m => ({ default: m.SavedSearchesPage })));
const EpicsPage = lazy(() => import("./pages/EpicsPage").then(m => ({ default: m.EpicsPage })));
const MilestonesPage = lazy(() => import("./pages/MilestonesPage").then(m => ({ default: m.MilestonesPage })));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage").then(m => ({ default: m.KnowledgePage })));
const LabelsPage = lazy(() => import("./pages/LabelsPage").then(m => ({ default: m.LabelsPage })));
const CustomFieldsPage = lazy(() => import("./pages/CustomFieldsPage").then(m => ({ default: m.CustomFieldsPage })));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage").then(m => ({ default: m.TemplatesPage })));
const WebhooksPage = lazy(() => import("./pages/WebhooksPage").then(m => ({ default: m.WebhooksPage })));
const GitHubPage = lazy(() => import("./pages/GitHubPage").then(m => ({ default: m.GitHubPage })));
const ActivitiesPage = lazy(() => import("./pages/ActivitiesPage").then(m => ({ default: m.ActivitiesPage })));
const SearchPage = lazy(() => import("./pages/SearchPage").then(m => ({ default: m.SearchPage })));
const MyTasksPage = lazy(() => import("./pages/MyTasksPage").then(m => ({ default: m.MyTasksPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const ProjectSettingsPage = lazy(() => import("./pages/ProjectSettingsPage").then(m => ({ default: m.ProjectSettingsPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

function LoadingFallback() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

// `/` is public: anonymous visitors see the marketing landing page, signed-in
// users land on the dashboard. Same URL, different content based on auth.
function HomeRoute() {
  const { status } = useAuth();
  if (status === "loading") return <LoadingFallback />;
  return status === "authenticated" ? <DashboardPage /> : <LandingPage />;
}

// Remounts WorkspacePage when the workspace param changes so no state (project
// lists, stats, members) from the previous workspace can leak into the next
// one. Without this, the N+1 stats fetch would call /tasks with an old project
// list + a new workspaceId → spurious 404s in the console (workspace mismatch).
function KeyedWorkspacePage() {
  const { workspaceId } = useParams();
  return <WorkspacePage key={workspaceId} />;
}

// Legacy/typed-in URL `/workspaces/:id/reports` has no project segment, but the
// reports route requires one. Load the workspace's projects and redirect to the
// first project's reports (or the workspace page when there are none) instead
// of falling through to the 404.
function WorkspaceReportsRedirect() {
  const { workspaceId = "" } = useParams();
  const { data } = useApi<unknown>(() => api(`/workspaces/${workspaceId}/projects`), [
    workspaceId,
  ]);
  const projects = useMemo(() => pagedItems<ProjectResponse>(data), [data]);
  const first = projects[0];
  return <Navigate to={first ? `/workspaces/${workspaceId}/projects/${first.id}/reports` : `/workspaces/${workspaceId}`} replace />;
}

// Wake the Render free-tier backend as early as possible. Render sleeps after
// ~15 min idle; the first request to a cold instance can take 30-60s. Firing a
// cheap health probe on every page load (and at an interval while the tab is
// open) means the user's first real action usually hits a warm instance.
function BackendWarmer() {
  useEffect(() => {
    // Use /api/v1/ping (dedicated keepalive probe, AllowAnonymous) rather than
    // bare /health — bare /health is caught by ad-blocker/browser-extension
    // blocklists (ERR_BLOCKED_BY_CLIENT), which this probe's fetch would
    // silently swallow anyway. keepalive.ts uses the same endpoint.
    const healthUrl = `${API_BASE}/api/v1/ping`;

    const ping = () => {
      fetch(healthUrl, { cache: "no-store" }).catch(() => {});
    };

    ping();
    const interval = window.setInterval(() => {
      if (!document.hidden) ping();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BackendWarmer />
        <ToastProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/saved-searches" element={<SavedSearchesPage />} />
                <Route
                  path="/workspaces/:workspaceId"
                  element={<KeyedWorkspacePage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId"
                  element={<BoardPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/sprints"
                  element={<SprintPlanningPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/reports"
                  element={<WorkspaceReportsRedirect />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/reports"
                  element={<ReportsPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/epics"
                  element={<EpicsPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/milestones"
                  element={<MilestonesPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/knowledge"
                  element={<KnowledgePage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/labels"
                  element={<LabelsPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/fields"
                  element={<CustomFieldsPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/templates"
                  element={<TemplatesPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/webhooks"
                  element={<WebhooksPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/github"
                  element={<GitHubPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/activities"
                  element={<ActivitiesPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/settings"
                  element={<ProjectSettingsPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/my-tasks"
                  element={<MyTasksPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/search"
                  element={<SearchPage />}
                />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
