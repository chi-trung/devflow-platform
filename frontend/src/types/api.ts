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
}

export interface WorkspaceMemberResponse {
  userId: string;
  email: string;
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
  status: "Backlog" | "InProgress" | "InReview" | "Done";
  priority: "Low" | "Medium" | "High" | "Critical";
  assigneeId: string | null;
  sprintId: string | null;
  dueDateUtc: string | null;
  completedAtUtc: string | null;
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

export interface FieldErrors {
  [field: string]: string[];
}
