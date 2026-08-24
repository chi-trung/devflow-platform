# 🚀 Sprint 25 — Prompt cho Agent B (Backend: Presence Broadcast + Task Watchers)

**Branch:** `feat/backend-sprint25-watchers` (tạo mới từ `main`)

---

## Bối cảnh

DevFlow đang có `ProjectHub` (SignalR) với `JoinProject`/`LeaveProject` — nhưng **KHÔNG hề broadcast** `user-joined`/`user-left` event nào. Frontend `usePresence` (PR #108) lắng nghe 2 event đó nên presence avatars **không hoạt động**. Đồng thời, DevFlow chưa có tính năng "theo dõi task" (watch) — user muốn nhận thông báo khi task thay đổi mà không cần bị mention.

## 🎯 Nhiệm vụ

### B25.1: Presence broadcast trong ProjectHub

`src/DevFlow.Api/Hubs/ProjectHub.cs` hiện là:

```csharp
[Authorize]
public sealed class ProjectHub : Hub
{
    public Task JoinProject(Guid projectId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, GroupName(projectId));
    public Task LeaveProject(Guid projectId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(projectId));
    public static string GroupName(Guid projectId) => $"project-{projectId}";
}
```

**Sửa thành:** broadcast `user-joined` / `user-left` tới group `project-{projectId}` khi có người join/leave. Payload: `{ userId, username, displayName }`.

- `JoinProject`: thêm vào group **rồi** `Clients.OthersInGroup(GroupName(projectId)).SendAsync("user-joined", new { userId, username, displayName })`.
- `LeaveProject`: gửi `user-left` trước **rồi** remove khỏi group.
- Lấy `userId` từ `Context.UserIdentifier`; lấy `username`/`displayName` từ claim `name` / `displayName` nếu có (nếu không có thì chỉ gửi `userId` — frontend đã có memberMap để map username).
- `OnConnectedAsync` / `OnDisconnectedAsync`: xử lý case mất kết nối — nếu connection đang trong group nào thì broadcast `user-left`. (Gợi ý: override `OnDisconnectedAsync`, đọc group mà connection đã join — có thể lưu `projectId` trong Context.Items khi JoinProject.)

> **Lưu ý:** Frontend `usePresence` đọc selfId từ `localStorage.getItem("devflow.currentUser")` — đó là BUG của Agent C, Agent C sẽ fix ở phía frontend (đọc từ AuthContext). Bạn **không cần** quan tâm tới selfId, chỉ cần broadcast đúng sự kiện. Self sẽ tự bị lọc bằng `userId === selfId`.

### B25.2: Task Watchers (Backend)

**Yêu cầu:** User có thể "theo dõi" một task; khi task đó có comment mới hoặc đổi status, những người watch sẽ nhận notification (realtime + persist + email theo preference `EmailOnAssignment` nếu đã có).

**Thiết kế theo CQRS + pattern có sẵn (tham khảo `Comment/Create` + `Notification` entity):**

1. **Entity mới:** `TaskWatcher` trong `DevFlow.Domain/Entities/`:
   - `TaskItemId` (Guid), `UserId` (Guid), `CreatedAtUtc`.
   - `static TaskWatcher Create(Guid taskId, Guid userId)`.
   - Unique index `(TaskItemId, UserId)` — 1 user watch 1 task 1 lần.

2. **Migration:** EF migration mới cho bảng `task_watchers`.

3. **Repository:** `ITaskWatcherRepository` + implement trong Infrastructure:
   - `AddAsync`, `RemoveAsync`, `GetByTaskAsync(taskId)`, `ExistsAsync(taskId, userId)`.

4. **Commands (Application layer, kèm `[RequireWorkspaceRole(Member)]` + `IWorkspaceRequest`):**
   - `WatchTaskCommand { WorkspaceId, ProjectId, TaskId }` → thêm watcher.
   - `UnwatchTaskCommand { WorkspaceId, ProjectId, TaskId }` → xóa watcher.
   - `IsWatchingTaskQuery { WorkspaceId, ProjectId, TaskId }` → trả `bool`.

5. **Notify watchers** trong `CreateCommentCommandHandler` và `UpdateTaskItemCommandHandler` (đã có sẵn realtime notify pattern):
   - Sau khi comment/update thành công, query watchers của task (trừ chính user thao tác), tạo `Notification.Create(watcherId, "TaskUpdate", "..." , taskId, projectId, workspaceId)` cho mỗi người + `realtimeNotificationService.NotifyUserAsync(...)`.
   - Email: tái sử dụng preference check như `CreateComment` (nếu có `EmailOnAssignment`/`EmailOnMention`).

6. **Controller:** endpoint mới trong `TasksController` (hoặc `TaskWatchersController` mới):
   - `PUT .../tasks/{taskId}/watch` → `WatchTaskCommand`
   - `DELETE .../tasks/{taskId}/watch` → `UnwatchTaskCommand`
   - `GET .../tasks/{taskId}/watch` → `IsWatchingTaskQuery`

7. **Tests:** ít nhất 4 unit tests:
   - Watch thêm mới watcher thành công.
   - Unwatch xóa watcher.
   - Watcher nhận notification khi comment được tạo trên task.
   - Watcher nhận notification khi task đổi status.
   - (Bonus) Email preference tôn trọng.

## ✅ Quality Gates

- `dotnet test` 100% green (hiện 184/184 — giữ nguyên, thêm tests mới).
- KHÔNG sửa file ngoài phạm vi của bạn. Đặc biệt: `Program.cs`, `api.ts`, `AuthContext.tsx` là file lock của Agent A/C.
- Không đụng tới `ProjectHub` ngoài B25.1, không đụng `usePresence`.
- Push lên branch `feat/backend-sprint25-watchers`, mở PR, tag **Agent A** review.

## ⚠️ Lưu ý

- Tham khảo `src/DevFlow.Application/Features/Comments/Create/CreateCommentCommandHandler.cs` để đúng pattern notification/email.
- Tham khảo `src/DevFlow.Application/Common/Authorization/IWorkspaceRequest.cs` để đúng attribute `RequireWorkspaceRole`.
- Migration phải có symmetric rollback (thói quen repo: `AddSprintXX...` naming).
