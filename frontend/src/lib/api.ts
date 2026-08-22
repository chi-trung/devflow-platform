import type {
  CreateLabelRequest,
  DashboardData,
  FieldErrors,
  LabelResponse,
  LoginResponse,
  NotificationResponse,
  SearchResponse,
  SprintResponse,
  UserProfileResponse,
} from "../types/api";

// In dev the Vite proxy forwards /api to localhost; in production
// VITE_API_URL points at the deployed backend (e.g. https://api.example.com).
// Trailing slashes are stripped so `${API_BASE}/api/v1` never doubles up.
export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(
  /\/+$/,
  "",
);
const BASE = `${API_BASE}/api/v1`;
const ACCESS_KEY = "devflow.accessToken";
const REFRESH_KEY = "devflow.refreshToken";

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, title: string, fieldErrors: FieldErrors = {}) {
    super(title);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const tokens = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  save(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshInFlight: Promise<boolean> | null = null;

async function requestRefresh(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;

  try {
    const response = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!response.ok) {
      tokens.clear();
      return false;
    }

    const data = (await response.json()) as LoginResponse;
    tokens.save(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= requestRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function parseProblemDetails(response: Response): Promise<ApiError> {
  let title = `Request failed (${response.status})`;
  let fieldErrors: FieldErrors = {};

  try {
    const body = await response.json();
    if (typeof body.detail === "string") title = body.detail;
    if (body.errors && typeof body.errors === "object") {
      fieldErrors = body.errors as FieldErrors;
      const first = Object.values(fieldErrors)[0]?.[0];
      if (first && title.startsWith("Request failed")) title = first;
    }
  } catch {
    // non-JSON error body
  }

  return new ApiError(response.status, title, fieldErrors);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const send = async (): Promise<Response> =>
    fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(tokens.access
          ? { Authorization: `Bearer ${tokens.access}` }
          : {}),
        ...options.headers,
      },
    });

  let response = await send();

  if (response.status === 401 && tokens.refresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send();
    }
  }

  if (!response.ok) {
    throw await parseProblemDetails(response);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function getSprints(
  workspaceId: string,
  projectId: string,
): Promise<SprintResponse[]> {
  return api<SprintResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/sprints`,
  );
}

export function createSprint(
  workspaceId: string,
  projectId: string,
  input: { name: string; goal: string | null },
): Promise<{ id: string }> {
  return api<{ id: string }>(
    `/workspaces/${workspaceId}/projects/${projectId}/sprints`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function startSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  input: { startDateUtc: string; endDateUtc: string },
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/start`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function completeSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/complete`,
    { method: "POST" },
  );
}

export async function assignTaskToSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  taskId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/tasks/${taskId}`,
    { method: "PUT" },
  );
}

export async function removeTaskFromSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  taskId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/tasks/${taskId}`,
    { method: "DELETE" },
  );
}

export function updateProfile(input: {
  displayName?: string;
  username?: string;
}): Promise<UserProfileResponse> {
  return api<UserProfileResponse>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getNotifications(): Promise<NotificationResponse[]> {
  return api<NotificationResponse[]>("/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api("/notifications/read-all", { method: "POST" });
}

export function searchWorkspace(
  workspaceId: string,
  query: string,
): Promise<SearchResponse> {
  return api<SearchResponse>(
    `/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}`,
  );
}

export interface AppSettings {
  theme: string;
  emailNotifications: boolean;
}

export async function updateSettings(input: AppSettings): Promise<void> {
  try {
    localStorage.setItem("devflow.settings", JSON.stringify(input));
  } catch {}
}

export function getDashboard(workspaceId: string): Promise<DashboardData> {
  return api<DashboardData>(`/workspaces/${workspaceId}/dashboard`);
}

export function getLabels(
  workspaceId: string,
  projectId: string,
): Promise<LabelResponse[]> {
  return api<LabelResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/labels`,
  );
}

export function createLabel(
  workspaceId: string,
  projectId: string,
  data: CreateLabelRequest,
): Promise<LabelResponse> {
  return api<LabelResponse>(
    `/workspaces/${workspaceId}/projects/${projectId}/labels`,
    { method: "POST", body: JSON.stringify(data) },
  );
}
