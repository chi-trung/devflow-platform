import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { ToastProvider } from "./components/ui/ToastProvider";

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
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

function LoadingFallback() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/saved-searches" element={<SavedSearchesPage />} />
                <Route
                  path="/workspaces/:workspaceId"
                  element={<WorkspacePage />}
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
                  path="/workspaces/:workspaceId/projects/:projectId/reports"
                  element={<ReportsPage />}
                />
                <Route
                  path="/workspaces/:workspaceId/projects/:projectId/epics"
                  element={<EpicsPage />}
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
