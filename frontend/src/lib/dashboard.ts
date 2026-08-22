import { api, getDashboard } from "./api";
import type {
  DashboardActivityItem,
  DashboardData,
  ProjectResponse,
  TaskItemResponse,
} from "../types/api";

const DAY_MS = 86_400_000;

function emptyDashboard(): DashboardData {
  return {
    totalTasks: 0,
    tasksByStatus: { Backlog: 0, InProgress: 0, InReview: 0, Done: 0 },
    tasksByPriority: { Low: 0, Medium: 0, High: 0, Critical: 0 },
    overdueCount: 0,
    recentActivity: [],
    upcomingDeadlines: [],
  };
}

interface ProjectSlice {
  project: ProjectResponse;
  tasks: TaskItemResponse[];
  activities: DashboardActivityItem[];
}

async function fetchProjectSlice(
  workspaceId: string,
  project: ProjectResponse,
): Promise<ProjectSlice> {
  const base = `/workspaces/${workspaceId}/projects/${project.id}`;
  const [tasks, activities] = await Promise.all([
    api<TaskItemResponse[]>(`${base}/tasks`).catch(() => []),
    api<DashboardActivityItem[]>(`${base}/activities`).catch(() => []),
  ]);
  return { project, tasks, activities };
}

function deriveFromSlices(slices: ProjectSlice[]): DashboardData {
  const data = emptyDashboard();
  const now = Date.now();
  const weekAhead = now + 7 * DAY_MS;

  for (const { project, tasks, activities } of slices) {
    for (const task of tasks) {
      data.totalTasks += 1;
      if (task.status in data.tasksByStatus) {
        data.tasksByStatus[task.status] += 1;
      }
      if (task.priority in data.tasksByPriority) {
        data.tasksByPriority[task.priority] += 1;
      }
      if (
        task.dueDateUtc &&
        task.status !== "Done" &&
        new Date(task.dueDateUtc).getTime() < now
      ) {
        data.overdueCount = (data.overdueCount ?? 0) + 1;
      }
      if (
        task.dueDateUtc &&
        task.status !== "Done" &&
        new Date(task.dueDateUtc).getTime() >= now &&
        new Date(task.dueDateUtc).getTime() <= weekAhead
      ) {
        data.upcomingDeadlines.push({
          id: task.id,
          title: task.title,
          projectId: project.id,
          projectKey: project.key,
          status: task.status,
          priority: task.priority,
          dueDateUtc: task.dueDateUtc,
        });
      }
    }

    for (const activity of activities.slice(0, 40)) {
      data.recentActivity.push({ ...activity, projectId: project.id });
    }
  }

  data.upcomingDeadlines.sort(
    (a, b) =>
      new Date(a.dueDateUtc).getTime() - new Date(b.dueDateUtc).getTime(),
  );
  data.upcomingDeadlines = data.upcomingDeadlines.slice(0, 5);

  data.recentActivity.sort(
    (a, b) =>
      new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
  );
  data.recentActivity = data.recentActivity.slice(0, 5);

  return data;
}

export async function deriveDashboard(
  workspaceId: string,
): Promise<DashboardData> {
  const projects = await api<ProjectResponse[]>(
    `/workspaces/${workspaceId}/projects`,
  );
  if (!Array.isArray(projects)) {
    throw new Error("Unexpected projects response");
  }
  const slices = await Promise.all(
    projects.map((project) => fetchProjectSlice(workspaceId, project)),
  );
  return deriveFromSlices(slices);
}

export interface DashboardResult {
  data: DashboardData;
  source: "api" | "derived";
}

export async function loadDashboard(
  workspaceId: string,
): Promise<DashboardResult> {
  try {
    const data = await getDashboard(workspaceId);
    if (data && typeof data.totalTasks === "number") {
      return { data, source: "api" };
    }
    throw new Error("Unexpected dashboard response");
  } catch {
    return { data: await deriveDashboard(workspaceId), source: "derived" };
  }
}
