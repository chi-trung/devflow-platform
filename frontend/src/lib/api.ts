import type {
  BurndownResponse,
  CreateLabelRequest,
  CreateEpicRequest,
  ActivityResponse,
  CustomFieldResponse,
  CustomFieldValueResponse,
  DashboardData,
  EpicCreatedResponse,
  EpicResponse,
  FieldErrors,
  GitHubIntegrationResponse,
  ImportResultResponse,
  LabelResponse,
  LoginResponse,
  NotificationPreferencesResponse,
  NotificationResponse,
  PagedResult,
  PullRequestResponse,
  SavedSearchResponse,
  SearchResponse,
  SprintResponse,
  ProjectDependencyGraphResponse,
  TaskDependencyResponse,
  TaskItemResponse,
  TeamReportResponse,
  TemplateResponse,
  TimeEntryResponse,
  UpdateEpicRequest,
  UserProfileResponse,
  VelocityResponse,
  WebhookResponse,
  WebhookTestResponse,
} from "../types/api";

// In dev the Vite proxy forwards /api to localhost; in production
// VITE_API_URL points at the deployed backend (e.g. https://api.example.com).
// Trailing slashes are stripped so `${API_BASE}/api/v1` never doubles up.
export const API_BASE = (import.meta.env.VITE_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
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

// ── Request deduplication & short-lived cache ──────────────────────
// Prevents multiple components from firing the same GET request
// simultaneously.  Responses are cached for 5 s so rapid re-mounts
// (e.g. StrictMode double-render, or navigating back) don't hit the
// network again.
const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5_000; // 5 seconds

function cacheKey(path: string, opts: RequestInit): string {
  const method = (opts.method ?? "GET").toUpperCase();
  const body = typeof opts.body === "string" ? opts.body : "";
  return `${method}:${path}:${body}`;
}

/** Drop all cached GET responses (call after mutations or auth changes). */
export function invalidateApiCache(): void {
  cache.clear();
}

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

  const method = (options.method ?? "GET").toUpperCase();
  const key = cacheKey(path, options);

  // Only cache GET requests (no body)
  if (method === "GET" && !options.body) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      return hit.data as T;
    }

    const existing = inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = send()
      .then(async (response) => {
        if (response.status === 401 && tokens.refresh) {
          const refreshed = await refreshSession();
          if (refreshed) {
            const retry = await send();
            if (!retry.ok) throw await parseProblemDetails(retry);
            if (retry.status === 204) return undefined as T;
            const data = (await retry.json()) as T;
            cache.set(key, { data, ts: Date.now() });
            return data;
          }
        }
        if (!response.ok) throw await parseProblemDetails(response);
        if (response.status === 204) return undefined as T;
        const data = (await response.json()) as T;
        cache.set(key, { data, ts: Date.now() });
        return data;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, promise);
    return promise as Promise<T>;
  }

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

  // A successful mutation invalidates every cached GET so subsequent
  // reads never serve pre-mutation data.
  cache.clear();
  inflight.clear();

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

export interface GetNotificationsParams {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export function getNotifications(
  params: GetNotificationsParams = {},
): Promise<PagedResult<NotificationResponse>> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.unreadOnly) search.set("unreadOnly", "true");
  const qs = search.toString();
  return api<PagedResult<NotificationResponse>>(
    `/notifications${qs ? `?${qs}` : ""}`,
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api("/notifications/read-all", { method: "POST" });
}

export async function deleteNotification(id: string): Promise<void> {
  await api(`/notifications/${id}`, { method: "DELETE" });
}

export async function deleteAllReadNotifications(): Promise<void> {
  await api("/notifications/read", { method: "DELETE" });
}

const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

// Helper to extract items from PagedResult responses
export function pagedItems<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object" && "items" in response) {
    const items = (response as { items: T[] }).items;
    return Array.isArray(items) ? items : (EMPTY_ARRAY as unknown as T[]);
  }
  return EMPTY_ARRAY as unknown as T[];
}

export interface SearchFilters {
  status?: string;
  priority?: string;
  assigneeId?: string;
  labelId?: string;
  dueBefore?: string;
  dueAfter?: string;
}

export function searchWorkspace(
  workspaceId: string,
  query: string,
  filters: SearchFilters = {},
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return api<SearchResponse>(
    `/workspaces/${workspaceId}/search${qs ? `?${qs}` : ""}`,
  );
}

export async function importTasks(
  workspaceId: string,
  projectId: string,
  file: File,
): Promise<ImportResultResponse> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const text = await file.text();
  return api<ImportResultResponse>(
    `/workspaces/${workspaceId}/projects/${projectId}/import/tasks`,
    {
      method: "POST",
      body: text,
      headers: { "Content-Type": isCsv ? "text/csv" : "application/json" },
    },
  );
}

export interface AppSettings {
  theme: string;
  emailNotifications: boolean;
}

export async function updateSettings(input: AppSettings): Promise<void> {
  try {
    localStorage.setItem("devflow.settings", JSON.stringify(input));
    if (input.emailNotifications !== undefined) {
      localStorage.setItem("devflow.settings.email", String(input.emailNotifications));
    }
  } catch {}
}

export function getDashboard(workspaceId: string): Promise<DashboardData> {
  return api<DashboardData>(`/workspaces/${workspaceId}/dashboard`);
}

export function getBurndown(
  workspaceId: string,
  projectId: string,
  startDate: string,
  endDate: string,
): Promise<BurndownResponse> {
  return api<BurndownResponse>(
    `/workspaces/${workspaceId}/projects/${projectId}/reporting/burndown?startDate=${startDate}&endDate=${endDate}`,
  );
}

export function getVelocity(
  workspaceId: string,
  projectId: string,
): Promise<VelocityResponse> {
  return api<VelocityResponse>(
    `/workspaces/${workspaceId}/projects/${projectId}/reporting/velocity`,
  );
}

export async function setTaskEstimation(
  workspaceId: string,
  projectId: string,
  taskId: string,
  storyPoints: number | null,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/estimation`,
    {
      method: "PUT",
      body: JSON.stringify({ storyPoints }),
    },
  );
}

export function getTeamReport(
  workspaceId: string,
): Promise<TeamReportResponse> {
  return api<TeamReportResponse>(`/workspaces/${workspaceId}/reporting/team`);
}

export function exportTasks(
  workspaceId: string,
  projectId: string,
  format: "csv" | "json",
): Promise<Blob> {
  return api<Blob>(
    `/workspaces/${workspaceId}/projects/${projectId}/export/tasks?format=${format}`,
    { headers: { Accept: format === "csv" ? "text/csv" : "application/json" } },
  );
}

export function getGitHubIntegration(
  workspaceId: string,
  projectId: string,
): Promise<GitHubIntegrationResponse | null> {
  return api<GitHubIntegrationResponse | null>(
    `/workspaces/${workspaceId}/projects/${projectId}/github`,
  );
}

export async function linkGitHubRepo(
  workspaceId: string,
  projectId: string,
  repositoryUrl: string,
): Promise<void> {
  await api(`/workspaces/${workspaceId}/projects/${projectId}/github/link`, {
    method: "POST",
    body: JSON.stringify({ repositoryUrl }),
  });
}

export async function unlinkGitHubRepo(
  workspaceId: string,
  projectId: string,
): Promise<void> {
  await api(`/workspaces/${workspaceId}/projects/${projectId}/github`, {
    method: "DELETE",
  });
}

export function getProjectPRs(
  workspaceId: string,
  projectId: string,
): Promise<PullRequestResponse[]> {
  return api<PullRequestResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/github/prs`,
  );
}

export async function addPR(
  workspaceId: string,
  projectId: string,
  input: {
    title: string;
    url: string;
    status: string;
    author?: string;
  },
): Promise<PullRequestResponse> {
  return api<PullRequestResponse>(
    `/workspaces/${workspaceId}/projects/${projectId}/github/prs`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function getTemplates(
  workspaceId: string,
  projectId: string,
): Promise<TemplateResponse[]> {
  return api<TemplateResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/templates`,
  );
}

export async function createTemplate(
  workspaceId: string,
  projectId: string,
  input: {
    name: string;
    title?: string | null;
    description?: string | null;
    priority: string;
    estimateMinutes?: number | null;
  },
): Promise<void> {
  await api(`/workspaces/${workspaceId}/projects/${projectId}/templates`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function applyTemplate(
  workspaceId: string,
  projectId: string,
  templateId: string,
): Promise<{ id: string } | void> {
  return api<{ id: string }>(
    `/workspaces/${workspaceId}/projects/${projectId}/templates/${templateId}/apply`,
    { method: "POST" },
  );
}

export async function deleteTemplate(
  workspaceId: string,
  projectId: string,
  templateId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/templates/${templateId}`,
    { method: "DELETE" },
  );
}

export function getActivities(
  workspaceId: string,
  projectId: string,
): Promise<ActivityResponse[]> {
  return api<ActivityResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/activities`,
  );
}

export function getCustomFields(
  workspaceId: string,
  projectId: string,
): Promise<CustomFieldResponse[]> {
  return api<CustomFieldResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/fields`,
  );
}

export async function createCustomField(
  workspaceId: string,
  projectId: string,
  input: { name: string; fieldType: string; options?: string | null; isRequired?: boolean },
): Promise<void> {
  await api(`/workspaces/${workspaceId}/projects/${projectId}/fields`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCustomField(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  input: { name: string; fieldType: string; options?: string | null; isRequired?: boolean; sortOrder?: number },
): Promise<void> {
  await api(`/workspaces/${workspaceId}/projects/${projectId}/fields/${fieldId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteCustomField(
  workspaceId: string,
  projectId: string,
  fieldId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/fields/${fieldId}`,
    { method: "DELETE" },
  );
}

export function getEpics(
  workspaceId: string,
  projectId: string,
): Promise<EpicResponse[]> {
  return api<EpicResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/epics`,
  );
}

export async function createEpic(
  workspaceId: string,
  projectId: string,
  input: CreateEpicRequest,
): Promise<EpicCreatedResponse> {
  return api<EpicCreatedResponse>(
    `/workspaces/${workspaceId}/projects/${projectId}/epics`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateEpic(
  workspaceId: string,
  projectId: string,
  epicId: string,
  input: UpdateEpicRequest,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/epics/${epicId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteEpic(
  workspaceId: string,
  projectId: string,
  epicId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/epics/${epicId}`,
    { method: "DELETE" },
  );
}

export function getTaskFieldValues(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<CustomFieldValueResponse[]> {
  return api<CustomFieldValueResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/fields/tasks/${taskId}`,
  );
}

export async function setTaskFieldValue(
  workspaceId: string,
  projectId: string,
  taskId: string,
  fieldId: string,
  value: string | null,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/fields/tasks/${taskId}`,
    { method: "POST", body: JSON.stringify({ fieldId, value }) },
  );
}

export async function bulkMoveTasks(
  workspaceId: string,
  projectId: string,
  taskIds: string[],
  status: TaskItemResponse["status"],
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/bulk/move`,
    { method: "POST", body: JSON.stringify({ taskIds, newStatus: status }) },
  );
}

export async function bulkAssignTasks(
  workspaceId: string,
  projectId: string,
  taskIds: string[],
  assigneeId: string | null,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/bulk/assign`,
    { method: "POST", body: JSON.stringify({ taskIds, assigneeId }) },
  );
}

export async function bulkDeleteTasks(
  workspaceId: string,
  projectId: string,
  taskIds: string[],
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/bulk/delete`,
    { method: "POST", body: JSON.stringify({ taskIds }) },
  );
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

export async function deleteLabel(
  workspaceId: string,
  projectId: string,
  labelId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/labels/${labelId}`,
    { method: "DELETE" },
  );
}

export function getTaskDependencies(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskDependencyResponse[]> {
  return api<TaskDependencyResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/dependencies`,
  );
}

export async function addTaskDependency(
  workspaceId: string,
  projectId: string,
  taskId: string,
  blockerTaskId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/dependencies`,
    { method: "POST", body: JSON.stringify({ blockerTaskId }) },
  );
}

export async function removeTaskDependency(
  workspaceId: string,
  projectId: string,
  taskId: string,
  dependencyId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/dependencies/${dependencyId}`,
    { method: "DELETE" },
  );
}

/**
 * Loads the whole project dependency graph in a single request (nodes + edges +
 * server-computed cyclic node ids), replacing the old per-task N+1 waterfall.
 */
export function getProjectDependencyGraph(
  workspaceId: string,
  projectId: string,
): Promise<ProjectDependencyGraphResponse> {
  return api<ProjectDependencyGraphResponse>(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/dependencies/graph`,
  );
}

export function getTimeEntries(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TimeEntryResponse[]> {
  return api<TimeEntryResponse[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/time-entries`,
  );
}

export async function logTimeEntry(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: { minutes: number; description: string | null },
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/time-entries`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function deleteTimeEntry(
  workspaceId: string,
  projectId: string,
  taskId: string,
  entryId: string,
): Promise<void> {
  await api(
    `/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/time-entries/${entryId}`,
    { method: "DELETE" },
  );
}

export interface BoardFilterState {
  sprint: string;
  search: string;
  priority: string;
  assignee: string;
  label: string;
  dueFrom: string;
  dueTo: string;
  blockedOnly: boolean;
}

const filterPresetsKey = (projectId: string) =>
  `devflow.boardFilters.${projectId}`;

export function loadFilterPresets(
  projectId: string,
): Record<string, BoardFilterState> {
  try {
    const raw = localStorage.getItem(filterPresetsKey(projectId));
    return raw ? (JSON.parse(raw) as Record<string, BoardFilterState>) : {};
  } catch {
    return {};
  }
}

export function saveFilterPreset(
  projectId: string,
  name: string,
  state: BoardFilterState,
): void {
  const presets = loadFilterPresets(projectId);
  presets[name] = state;
  try {
    localStorage.setItem(filterPresetsKey(projectId), JSON.stringify(presets));
  } catch {}
}

export function deleteFilterPreset(
  projectId: string,
  name: string,
): void {
  const presets = loadFilterPresets(projectId);
  delete presets[name];
  try {
    localStorage.setItem(filterPresetsKey(projectId), JSON.stringify(presets));
  } catch {}
}

export function getWebhooks(workspaceId: string): Promise<WebhookResponse[]> {
  return api<WebhookResponse[]>(`/workspaces/${workspaceId}/webhooks`);
}

export function createWebhook(
  workspaceId: string,
  input: { url: string; events: string[]; secret?: string },
): Promise<WebhookResponse> {
  return api<WebhookResponse>(`/workspaces/${workspaceId}/webhooks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getWebhook(
  workspaceId: string,
  id: string,
): Promise<WebhookResponse> {
  return api<WebhookResponse>(`/workspaces/${workspaceId}/webhooks/${id}`);
}

export async function deleteWebhook(
  workspaceId: string,
  id: string,
): Promise<void> {
  await api(`/workspaces/${workspaceId}/webhooks/${id}`, {
    method: "DELETE",
  });
}

export function testWebhook(
  workspaceId: string,
  id: string,
): Promise<WebhookTestResponse> {
  return api<WebhookTestResponse>(`/workspaces/${workspaceId}/webhooks/${id}/test`, {
    method: "POST",
  });
}

export function getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  return api<NotificationPreferencesResponse>("/users/me/notification-preferences");
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferencesResponse,
): Promise<void> {
  await api("/users/me/notification-preferences", {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}

export interface ReorderTaskPayload {
  id: string;
  status: string;
  position: number;
}

export async function reorderTasks(
  workspaceId: string,
  projectId: string,
  tasks: ReorderTaskPayload[],
): Promise<void> {
  await api(`/workspaces/${workspaceId}/projects/${projectId}/tasks/reorder`, {
    method: "PUT",
    body: JSON.stringify({ tasks }),
  });
}

export function getSavedSearches(): Promise<SavedSearchResponse[]> {
  return api<SavedSearchResponse[]>("/users/me/saved-searches");
}

export function createSavedSearch(input: {
  name: string;
  workspaceId: string;
  query: string;
  filtersJson?: string;
}): Promise<SavedSearchResponse> {
  return api<SavedSearchResponse>("/users/me/saved-searches", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      workspaceId: input.workspaceId,
      query: input.query,
      filtersJson: input.filtersJson ?? null,
    }),
  });
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await api(`/users/me/saved-searches/${id}`, { method: "DELETE" });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  await api(`/workspaces/${workspaceId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: "Owner" | "Admin" | "Member",
): Promise<void> {
  await api(`/workspaces/${workspaceId}/members/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}
