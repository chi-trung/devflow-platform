# 🚀 PROMPT CHO AGENT A — Sprint 21 (My Tasks Page — Cross-Project Assigned Tasks)

**Bạn là Agent A (team lead)** trong đội DevFlow (ASP.NET Core 8 + React 19).
Branch prefix: `feat/sprint21-my-tasks`.
**QUAN TRỌNG:** KHÔNG đụng file Agent B (NotificationService, NotificationBroadcaster, NotificationPreferences, EmailService, CommentHandlers, TaskHandlers) và Agent C (DashboardPage, ReportsPage, chart components, ExportController, ExportHandlers).

---

## PHẦN 1 — Backend: My Tasks API (A21.1)

### 1.1 Query + Handler
- **File mới:** `src/DevFlow.Application/Features/Tasks/MyTasks/GetMyTasksQuery.cs`
  ```csharp
  [RequireWorkspaceRole(WorkspaceRole.Member)]
  public sealed record GetMyTasksQuery(Guid WorkspaceId, Guid UserId) : IRequest<IReadOnlyList<MyTaskItem>>, IWorkspaceRequest;

  public sealed record MyTaskItem(
      Guid Id, Guid ProjectId, string ProjectName, string ProjectKey,
      string Title, string Status, string Priority,
      DateTimeOffset? DueDateUtc, DateTimeOffset? CompletedAtUtc,
      Guid? SprintId, string? SprintName);
  ```
- **File mới:** `src/DevFlow.Application/Features/Tasks/MyTasks/GetMyTasksQueryHandler.cs`
  - Inject `IUserContext`, `IProjectRepository`, `ITaskItemRepository`, `ISprintRepository`.
  - Load tất cả projects trong workspace → foreach project lấy tasks với `AssigneeId == userId`.
  - Nếu task có `SprintId`, load sprint name từ `ISprintRepository`.
  - Gom tất cả vào list, sort theo `CreatedAtUtc` DESC (hoặc DueDateUtc ASC).
  - Trả về `IReadOnlyList<MyTaskItem>`.

### 1.2 Controller endpoint
- **File mới:** `src/DevFlow.Api/Controllers/MyTasksController.cs`
  ```csharp
  [Route("api/v1/workspaces/{workspaceId:guid}/my-tasks")]
  [ApiController]
  [Authorize]
  public sealed class MyTasksController(ISender sender) : ControllerBase
  {
      [HttpGet]
      [ProducesResponseType(typeof(IReadOnlyList<MyTaskItem>), StatusCodes.Status200OK)]
      public async Task<IActionResult> GetMyTasks(Guid workspaceId)
      {
          var userId = User.GetUserId(); // dùng extension method có sẵn
          var result = await sender.Send(new GetMyTasksQuery(workspaceId, userId));
          return Ok(result);
      }
  }
  ```
  - Route: `GET /api/v1/workspaces/{workspaceId}/my-tasks`
  - Dùng `User.GetUserId()` extension method từ `DevFlow.Api.Extensions` (kiểm tra xem extension có sẵn không — nếu không, lấy từ claim `ClaimTypes.NameIdentifier`).

### 1.3 Tests
- **File mới:** `tests/DevFlow.UnitTests/Features/Tasks/MyTasksHandlerTests.cs`
  - Test: trả về tasks assignee đúng user.
  - Test: bỏ qua tasks của user khác.
  - Test: empty list khi không có task nào.
  - Dùng NSubstitute mock theo pattern `ListTaskItemsQueryHandlerTests.cs` (thường dùng InMemory hoặc mock repository).

---

## PHẦN 2 — Frontend: My Tasks Page (A21.2)

### 2.1 API helper
- **File:** `frontend/src/lib/api.ts` — thêm hàm:
  ```typescript
  export interface MyTaskItem {
    id: string;
    projectId: string;
    projectName: string;
    projectKey: string;
    title: string;
    status: string;
    priority: string;
    dueDateUtc: string | null;
    completedAtUtc: string | null;
    sprintId: string | null;
    sprintName: string | null;
  }

  export function getMyTasks(workspaceId: string): Promise<MyTaskItem[]> {
    return api<MyTaskItem[]>(`/workspaces/${workspaceId}/my-tasks`);
  }
  ```
  CHỈ append vào cuối file, không sửa hàm có sẵn.

### 2.2 My Tasks Page
- **File mới:** `frontend/src/pages/MyTasksPage.tsx`
  - Dùng layout `AppShell` như các page khác.
  - Gọi `getMyTasks(workspaceId)` với `useApi`.
  - Hiển thị danh sách task dạng table hoặc card list:
    - Mỗi task: `[projectKey] Title` — Status badge, Priority dot, Due date, Sprint name.
    - Click → navigate tới `BoardPage` với task filter (dùng `?selectedTaskId=` param).
    - Empty state: "No tasks assigned to you" với i18n key.
  - Skeleton loading, error state (pattern từ `SprintPlanningPage.tsx`).

### 2.3 Navigation
- **File:** `frontend/src/components/AppShell.tsx` — thêm nav item "My Tasks" (sau "Dashboard" / "Board"):
  - Icon: `UserCheck` hoặc `ListTodo` từ lucide-react.
  - Route: `/workspaces/:workspaceId/projects/my-tasks` (hoặc `/workspaces/:workspaceId/my-tasks`).
  - i18n keys: `nav.myTasks` (en: "My Tasks", vi: "Việc của tôi").
  - Import icon + thêm vào navItems array.

### 2.4 Router
- **File:** `frontend/src/App.tsx` — thêm route:
  ```tsx
  <Route path="workspaces/:workspaceId/my-tasks" element={<MyTasksPage />} />
  ```
  (hoặc trong nested route structure phù hợp).

### 2.5 i18n
- **File:** `frontend/src/i18n/en.json` + `frontend/src/i18n/vi.json`
  - `nav.myTasks`: "My Tasks" / "Việc của tôi"
  - `myTasks.title`: "My Tasks" / "Việc của tôi"
  - `myTasks.empty`: "No tasks assigned to you." / "Bạn chưa được giao task nào."
  - `myTasks.loading`: "Loading your tasks…" / "Đang tải việc của bạn…"
  - `myTasks.error`: "Could not load your tasks." / "Không thể tải danh sách việc."
  - `myTasks.dueDate`: "Due: {{date}}"
  - `myTasks.sprint`: "Sprint: {{name}}"

---

## 🧪 QUALITY GATES (bắt buộc)
1. Backend: `dotnet build` 0 warning, `dotnet test` xanh (thêm ít nhất 3 tests cho handler).
2. Frontend: `npm run build` xanh.
3. Commit: `feat: cross-project My Tasks page (A21.1-2)`
4. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/sprint21-my-tasks
   git add .
   git commit -m "feat: cross-project My Tasks page (A21.1-2)"
   git push origin feat/sprint21-my-tasks
   gh pr create --base main --head feat/sprint21-my-tasks --title "feat: Sprint 21 My Tasks cross-project view (Agent A)" --body "My Tasks page: GET /workspaces/{wsId}/my-tasks endpoint + frontend page showing assigned tasks across all projects."
   ```
5. **KHÔNG đụng** file Agent B (NotificationService, NotificationBroadcaster, NotificationPreferences, EmailService, CommentHandlers, TaskHandlers) và Agent C (DashboardPage, ReportsPage, chart components, ExportController, ExportHandlers, api.ts type helpers cho chart).

> ⚠️ Nếu `User.GetUserId()` extension không tồn tại — tự tạo helper method trong `MyTasksController` lấy từ `ClaimTypes.NameIdentifier`.

> Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.