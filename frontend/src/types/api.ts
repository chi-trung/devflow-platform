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
  /** When true, AI plans are auto-applied (self-approval on). */
  approveAiPlans?: boolean;
}

export interface AiPlanSubtaskResponse {
  title: string;
  description: string | null;
  priority: string;
}

export interface AiPlanResponse {
  id: string;
  taskId: string;
  projectId: string;
  status: string;
  applied: boolean;
  summary: string | null;
  steps: string[];
  subtasks: AiPlanSubtaskResponse[];
  definitionOfDone: string[];
  createdAtUtc: string;
}

export type AiActionStatus = "success" | "failed" | "skipped" | "pending";

/**
 * The full payload of a single AI-proposed action, echoed back on pending
 * actions so the client can re-submit it (unchanged) to the confirm endpoint
 * when the user presses Accept.
 */
export interface AiExecuteActionContract {
  type: string;
  title?: string | null;
  description?: string | null;
  priority?: string;
  dueDate?: string | null;
  assignee?: string | null;
  taskRef?: string | null;
  parentTaskRef?: string | null;
  projectRef?: string | null;
  sprintRef?: string | null;
  epicRef?: string | null;
}

export interface ExecutedAction {
  type: string;
  label: string;
  entityId: string | null;
  status: AiActionStatus;
  message: string | null;
  /** Present only on "pending" actions — the original contract to re-send on
   * Accept. Null for already-executed actions. */
  contract?: AiExecuteActionContract | null;
  /** Structured failure detail, present only when the action failed with a
   * classified error (e.g. a hierarchy violation). */
  error?: AiActionErrorDetail | null;
}

/**
 * Structured failure detail so the client can classify the error and offer a
 * targeted recovery hint instead of a generic failure message.
 */
export interface AiActionErrorDetail {
  /** Stable machine-readable code, e.g. "hierarchy_violation". */
  code: string;
  message: string;
  parentId?: string | null;
  actualType?: string | null;
  requiredType?: string | null;
  recoveryHint?: string | null;
}

/**
 * A context-aware prompt suggestion returned by the AI suggest endpoint: an
 * i18n key plus optional interpolation params (e.g. sprint/epic names, counts).
 */
export interface AiSuggestion {
  key: string;
  args?: Record<string, string> | null;
}

export interface AiExecuteResponse {
  summary: string | null;
  actions: ExecutedAction[];
  error: string | null;
  /** Optional bullet points rendered as a list when the AI answer spans
   *  several distinct points (e.g. "here are the open sprints: …"). */
  replyItems?: string[] | null;
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
  epicId: string | null;
  parentTaskId: string | null;
  dueDateUtc: string | null;
  completedAtUtc: string | null;
  position?: number;
  storyPoints?: number | null;
  /**
   * Backend note: the task list does NOT include isBlocked/labelIds/
   * estimateMinutes/totalLoggedMinutes/subtaskCount — those TS fields never
   * existed on TaskItemResponse. Blocked state lives in the per-task
   * /dependencies response; per-task labels in the assign/remove endpoints;
   * logged time in /time-entries. */

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
  /** Same server-computed fields as PagedResult. */
  hasPreviousPage: boolean;
  hasNextPage: boolean;
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
  /** Computed server-side (PagedResult.HasPreviousPage/HasNextPage). */
  hasPreviousPage: boolean;
  hasNextPage: boolean;
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

export interface SearchCustomFieldResult {
  taskId: string;
  taskTitle: string;
  projectKey: string;
  fieldName: string;
  value: string | null;
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
  totalCustomFields: number;
}

export interface SearchResponse {
  tasks: SearchTaskResult[];
  projects: SearchProjectResult[];
  epics: SearchEpicResult[];
  labels: SearchLabelResult[];
  users: SearchUserResult[];
  comments: SearchCommentResult[];
  customFields: SearchCustomFieldResult[];
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
  completedTasks: number;
  totalTasks: number;
  /** Completion as a fraction 0–1 (backend rounds to 2 decimals) — NOT a percent. */
  completionRate: number;
}

export interface VelocityResponse {
  sprints: SprintVelocity[];
  /** Completion as a fraction 0–1 — NOT a percent. */
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
  /** Backend sends and expects these — omitting them on PUT resets them to false. */
  inAppOnAssignment: boolean;
  inAppOnMention: boolean;
  inAppOnSprintStarted: boolean;
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

export type KnowledgeType = "Adr" | "Pattern" | "Runbook";

export type KnowledgeStatus =
  | "Draft"
  | "Proposed"
  | "Accepted"
  | "Superseded"
  | "Deprecated";

export interface KnowledgeEntryResponse {
  id: string;
  projectId: string;
  taskId: string | null;
  title: string;
  body: string | null;
  type: KnowledgeType;
  status: KnowledgeStatus;
  weight: number;
  tags: string | null;
  supersededById: string | null;
  needsReview: boolean;
  driftReason: string | null;
  driftedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface CreateKnowledgeEntryRequest {
  title: string;
  body?: string | null;
  type: KnowledgeType;
  tags?: string | null;
}

export interface UpdateKnowledgeEntryRequest {
  title: string;
  body?: string | null;
  type: KnowledgeType;
  tags?: string | null;
  status: KnowledgeStatus;
}

export interface KnowledgeEntryCreatedResponse {
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