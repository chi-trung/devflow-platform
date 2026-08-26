export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  id: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  /** Optional single emoji used as the workspace logo. */
  emoji?: string | null;
}

export interface WorkspaceMemberResponse {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
}

export interface ProjectMemberResponse {
  userId: string;
  username: string;
  displayName: string;
  role: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  /** Optional single emoji used as the project logo. */
  emoji?: string | null;
  /** Optional palette key the frontend maps to a cover gradient. */
  coverColor?: string | null;
}

export interface SprintResponse {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: string;
  startDateUtc: string | null;
  endDateUtc: string | null;
  completedAtUtc: string | null;
}

export interface TaskItemResponse {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  /** Optional acceptance criteria / definition-of-done checklist (Sprint A). */
  definitionOfDone?: string | null;
  status: "Idea" | "Planning" | "Approval" | "Ready" | "InProgress" | "Review" | "Done";
  priority: "Low" | "Medium" | "High" | "Critical";
  assigneeId: string | null;
  sprintId: string | null;
  dueDateUtc: string | null;
  completedAtUtc: string | null;
  isBlocked?: boolean;
  estimateMinutes?: number | null;
  totalLoggedMinutes?: number;
  labelIds?: string[];
  position?: number;
  storyPoints?: number | null;
  /** Number of completed child subtasks, when the backend includes it. */
  subtaskCount?: number;
  /** Attachment summary for card thumbnails (B32.2). */
  attachmentSummary?: {
    count: number;
    previews: Array<{ id: string; contentType: string }>;
  };
}

export interface TaskDependencyResponse {
  id: string;
  blockedTaskId: string;
  blockerTaskId: string;
  blockerTitle: string;
  blockerStatus: TaskItemResponse["status"];
  isResolved: boolean;
}

export interface TaskGraphNode {
  id: string;
  title: string;
  status: TaskItemResponse["status"];
  assigneeId: string | null;
  projectId: string;
}

/**
 * Backend naming note: `fromTaskId` is the *blocked* task and `toTaskId` is the
 * *blocker* task (the edge mirrors the TaskDependencies row, not the arrow).
 */
export interface DependencyGraphEdge {
  fromTaskId: string;
  toTaskId: string;
  isCyclic: boolean;
}

export interface ProjectDependencyGraphResponse {
  nodes: TaskGraphNode[];
  edges: DependencyGraphEdge[];
  cyclicNodeIds: string[];
}

export interface TimeEntryResponse {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  minutes: number;
  description: string | null;
  dateUtc?: string;
  createdAtUtc?: string;
}

export interface CommentResponse {
  id: string;
  taskItemId: string;
  authorId: string;
  content: string;
  createdAtUtc: string;
}

export interface ActivityResponse {
  id: string;
  taskItemId: string | null;
  actorName: string;
  action: string;
  target: string;
  createdAtUtc: string;
}

export interface ActivityResponsePage {
  items: ActivityResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface TaskAttachmentResponse {
  id: string;
  taskItemId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAtUtc: string;
}

export interface TaskWatcherResponse {
  userId: string;
  username: string;
  displayName: string;
}

export interface DeadLetterMessageDto {
  id: string;
  type: string;
  occurredAtUtc: string;
  processedAtUtc?: string;
  retryCount: number;
  error?: string;
  failedPermanentlyAt: string;
}

export interface FieldErrors {
  [field: string]: string[];
}

export interface UserProfileResponse {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
}

export interface NotificationResponse {
  id: string;
  type: string;
  message: string;
  createdAtUtc: string;
  readAtUtc: string | null;
  taskItemId: string | null;
  projectId: string | null;
  workspaceId: string | null;
  actorUserId: string | null;
  actorName: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchTaskResult {
  id: string;
  title: string;
  status: string;
  projectKey: string;
}

export interface SearchProjectResult {
  id: string;
  name: string;
  key: string;
  status: string;
}

export interface SearchEpicResult {
  id: string;
  name: string;
  projectKey: string;
}

export interface SearchLabelResult {
  id: string;
  name: string;
  color: string;
  projectKey: string;
}

export interface SearchUserResult {
  id: string;
  displayName: string;
  username: string;
}

export interface SearchCommentResult {
  id: string;
  content: string;
  taskItemId: string;
  taskTitle: string;
  projectKey: string;
}

/** Pagination metadata for every search result group. */
export interface SearchPagination {
  page: number;
  pageSize: number;
  totalTasks: number;
  totalProjects: number;
  totalEpics: number;
  totalLabels: number;
  totalUsers: number;
  totalComments: number;
}

export interface SearchResponse {
  tasks: SearchTaskResult[];
  projects: SearchProjectResult[];
  epics: SearchEpicResult[];
  labels: SearchLabelResult[];
  users: SearchUserResult[];
  comments: SearchCommentResult[];
  pagination: SearchPagination;
}

export interface ImportResultResponse {
  imported: number;
  skipped: number;
  errors: string[];
}

export type TaskStatus = TaskItemResponse["status"];
export type TaskPriority = TaskItemResponse["priority"];

export interface DashboardDeadlineTask {
  id: string;
  title: string;
  projectId: string;
  projectKey?: string | null;
  status: string;
  priority: string;
  dueDateUtc: string;
}

export interface DashboardActivityItem extends ActivityResponse {
  projectId?: string | null;
}

export interface DashboardData {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  overdueCount?: number | null;
  recentActivity: DashboardActivityItem[];
  upcomingDeadlines: DashboardDeadlineTask[];
}

export interface LabelResponse {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAtUtc?: string;
}

export interface CreateLabelRequest {
  name: string;
  color: string;
}

export interface BurndownPoint {
  date: string;
  remainingTasks: number;
  idealRemaining: number;
}

export interface BurndownResponse {
  startDate: string;
  endDate: string;
  totalTasks: number;
  points: BurndownPoint[];
}

export interface SprintVelocity {
  sprintId: string;
  sprintName: string;
  totalTasks: number;
  completedTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPercent: number;
}

export interface VelocityResponse {
  sprints: SprintVelocity[];
  averageCompletionRate: number;
}

export interface TeamMemberStats {
  userId: string;
  userName: string;
  tasksAssigned: number;
  tasksCompleted: number;
  totalMinutesLogged: number;
  inProgressCount: number;
  avgCycleTimeDays: number | null;
}

export interface TeamReportTrends {
  completedDelta: number;
  cycleTimeDelta: number | null;
}

export interface TeamReportResponse {
  members: TeamMemberStats[];
  totalTasks: number;
  totalCompleted: number;
  totalMinutesLogged: number;
  trends: TeamReportTrends;
}

export interface GitHubIntegrationResponse {
  id: string;
  projectId: string;
  repositoryUrl: string;
  isActive: boolean;
  createdAtUtc: string;
  hasWebhookSecret?: boolean;
}

export interface PullRequestResponse {
  id: string;
  title: string;
  url: string;
  status: string;
  author: string | null;
  linkedTaskId: string | null;
  createdAtUtc: string;
}

export interface TemplateResponse {
  id: string;
  projectId: string;
  name: string;
  title: string | null;
  description: string | null;
  priority: string;
  estimateMinutes: number | null;
}

export interface CustomFieldResponse {
  id: string;
  projectId: string;
  name: string;
  fieldType: "text" | "number" | "date" | "select";
  options: string | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface CustomFieldValueResponse {
  fieldId: string;
  fieldName: string;
  fieldType: CustomFieldResponse["fieldType"];
  value: string | null;
}

export interface ProjectCustomFieldValuesResponse {
  taskId: string;
  values: CustomFieldValueResponse[];
}

export interface WebhookResponse {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAtUtc: string;
}

export interface WebhookTestResponse {
  delivered: boolean;
  statusCode: number;
  latencyMs: number;
  error: string | null;
}

export interface NotificationPreferencesResponse {
  emailOnAssignment: boolean;
  emailOnMention: boolean;
  emailOnSprintStarted: boolean;
  emailOnStatusChanged: boolean;
  inAppOnStatusChanged: boolean;
  emailOnCommentAdded: boolean;
  inAppOnCommentAdded: boolean;
  emailOnRoleChanged: boolean;
  inAppOnRoleChanged: boolean;
  emailOnRemovedFromWorkspace: boolean;
  inAppOnRemovedFromWorkspace: boolean;
}

export interface SavedSearchResponse {
  id: string;
  name: string;
  workspaceId: string;
  query: string;
  filtersJson: string | null;
  createdAtUtc: string;
}

export interface EpicResponse {
  id: string;
  projectId: string;
  milestoneId: string | null;
  name: string;
  description: string | null;
  startDateUtc: string | null;
  endDateUtc: string | null;
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  /** Ids of epics this epic is blocked by. Absent on older backend responses — guard with `?? []`. */
  blockedByEpicIds?: string[];
}

export type MilestoneStatus = "Planned" | "Active" | "Completed";

export interface MilestoneResponse {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  targetDateUtc: string | null;
  status: MilestoneStatus;
}

export interface CreateMilestoneRequest {
  name: string;
  description?: string | null;
  targetDateUtc?: string | null;
}

export interface UpdateMilestoneRequest {
  name: string;
  description?: string | null;
  targetDateUtc?: string | null;
  status: MilestoneStatus;
}

export interface MilestoneCreatedResponse {
  id: string;
}

export interface EpicDependencyResponse {
  epicId: string;
  blockedByEpicId: string;
}

export interface EpicCreatedResponse {
  id: string;
}

export interface CreateEpicRequest {
  name: string;
  description?: string | null;
  milestoneId?: string | null;
  startDateUtc?: string | null;
  endDateUtc?: string | null;
}

export interface UpdateEpicRequest {
  name: string;
  description?: string | null;
  milestoneId?: string | null;
  startDateUtc?: string | null;
  endDateUtc?: string | null;
}

export interface PatResponse {
  id: string;
  name: string;
  scopes: string[];
  expiresAtUtc: string;
  createdAtUtc: string;
  lastUsedAtUtc: string | null;
}

export interface PatCreatedResponse {
  id: string;
  token: string;
}

export interface CycleLeadTimeResponse {
  cycleTimeP50: number | null;
  cycleTimeP90: number | null;
  leadTimeP50: number | null;
  leadTimeP90: number | null;
  tasks: Array<{ taskId: string; title: string; cycleTimeDays: number | null; leadTimeDays: number | null }>;
}

export interface VelocityHistoryResponse {
  points: Array<{
    sprintId: string;
    sprintName: string;
    totalStoryPoints: number;
    completedStoryPoints: number;
    endDateUtc: string;
  }>;
  averageCompleted: number;
  averageTotal: number;
}