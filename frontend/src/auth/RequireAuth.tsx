import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ShellSkeleton } from "../components/ShellSkeleton";

/**
 * Auth gate. While the session is being restored the shell layout skeleton
 * renders instead of a blank "Loading…" screen, so the app doesn't look hung
 * on slow cold starts.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <ShellSkeleton />;
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
