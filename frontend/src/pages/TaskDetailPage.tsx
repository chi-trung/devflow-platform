import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

/**
 * Legacy full-page shape (`…/projects/:projectId/tasks/:taskId`) now lands
 * as an in-page overlay on the board. This route only rewrites the URL to
 * `?task=` so shared/copy links and browser history keep working without a
 * second detail implementation.
 */
export function TaskDetailPage() {
  const navigate = useNavigate();
  const { workspaceId = "", projectId = "", taskId = "" } = useParams();

  useEffect(() => {
    navigate(
      `/workspaces/${workspaceId}/projects/${projectId}?task=${encodeURIComponent(taskId)}`,
      { replace: true },
    );
  }, [workspaceId, projectId, taskId, navigate]);

  return null;
}
