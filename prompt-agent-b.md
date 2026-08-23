# 🚀 PROMPT CHO AGENT B — Sprint 21 (Realtime Notification Delivery + Email Enhancement)

**Bạn là Agent B** trong đội DevFlow (ASP.NET Core 8 + React 19).
Branch prefix: `feat/backend-sprint21-notifications`.
**QUAN TRỌNG:** Chỉ sửa file trong `src/` (backend). KHÔNG đụng frontend, KHÔNG đụng file Agent A & C.

---

## Context — Notification System Hiện Tại

### Existing code (verified):
- `src/DevFlow.Api/Hubs/NotificationHub.cs` — `INotificationBroadcaster` interface + `NotificationBroadcaster` implementation (SignalR via `IHubContext<NotificationHub>`). Groups: `user:{userId}`, `workspace:{workspaceId}`, `project:{projectId}`. **Đã register trong Program.cs** (`AddSingleton<INotificationBroadcaster, NotificationBroadcaster>`).
- `src/DevFlow.Application/Features/Comments/Create/CreateCommentCommandHandler.cs` — tạo `Notification` entity + gọi `IEmailService` khi @mention. **KHÔNG gọi `INotificationBroadcaster`**.
- `src/DevFlow.Application/Features/Tasks/Update/UpdateTaskItemCommandHandler.cs` — tạo notification khi task được assign. **KHÔNG gọi `INotificationBroadcaster`**.
- `src/DevFlow.Domain/Entities/NotificationPreferences.cs` — `EmailOnAssignment`, `EmailOnMention`, `EmailOnSprintStarted` (all default true). **KHÔNG được handler nào check**.
- `src/DevFlow.Infrastructure/Email/ResendEmailService.cs` — gọi Resend API. **Email HTML có link `<a href="#">` chết.**
- `src/DevFlow.Api/Program.cs` — `ResendEmailService` được đăng ký nếu `RESEND_API_KEY` có, fallback `NoOpEmailService`.

### Frontend contract (đã có sẵn, KHÔNG sửa):
- Frontend `useNotifications` hook đã lắng nghe `connection.on("notification", handler)`.
- Payload shape: `{ type: string | null, message: string | null, taskId: string | null, projectId: string | null, workspaceId: string | null }`.

---

## PHẦN 1 — Real-time Notification Push (B21.1)

### 1.1 Tạo NotificationService (Application layer)
- **File mới:** `src/DevFlow.Application/Common/Interfaces/INotificationBroadcaster.cs` — KHÔNG tạo mới (đã có ở `src/DevFlow.Api/Hubs/NotificationHub.cs`). Check lại: interface `INotificationBroadcaster` ở Api layer → Application layer không thể inject. **Cần refactor:**
  - Move interface `INotificationBroadcaster` vào `src/DevFlow.Application/Common/Interfaces/` (xóa bản cũ ở Api layer).
  - Update `NotificationBroadcaster` ở Api layer để implement interface từ Application.
  - Hoặc tạo interface mới `IRealtimeNotificationService` ở Application layer:
    ```csharp
    // src/DevFlow.Application/Common/Interfaces/IRealtimeNotificationService.cs
    public interface IRealtimeNotificationService
    {
        Task NotifyUserAsync(Guid userId, string type, string message, Guid? taskId, Guid? projectId, Guid? workspaceId);
    }
    ```
  - Implement ở Infrastructure layer (hoặc Api layer) dùng `INotificationBroadcaster` / `IHubContext<NotificationHub>`.

### 1.2 Implement + register
- **File mới:** `src/DevFlow.Infrastructure/RealTime/SignalRNotificationService.cs`
  ```csharp
  public sealed class SignalRNotificationService(IHubContext<NotificationHub> hubContext) : IRealtimeNotificationService
  {
      public async Task NotifyUserAsync(Guid userId, string type, string message, Guid? taskId, Guid? projectId, Guid? workspaceId)
      {
          await hubContext.Clients.Group($"user:{userId}").SendAsync("notification", new
          {
              type,
              data = new { message, taskId = taskId?.ToString(), projectId = projectId?.ToString(), workspaceId = workspaceId?.ToString() }
          });
      }
  }
  ```
  - Register: `services.AddSingleton<IRealtimeNotificationService, SignalRNotificationService>();` trong `DependencyInjection.cs` (Infrastructure).

### 1.3 Inject vào Comment handler
- **File:** `src/DevFlow.Application/Features/Comments/Create/CreateCommentCommandHandler.cs`
  - Inject `IRealtimeNotificationService`.
  - Sau khi tạo notification (sau `await notificationRepository.AddAsync`), gọi:
    ```csharp
    await realtimeService.NotifyUserAsync(
        mentionedUser.Id, "Mention",
        $"mentioned you in a comment on \"{task.Title}\"",
        task.Id, project.Id, project.WorkspaceId);
    ```

### 1.4 Inject vào Task assign handler
- **File:** `src/DevFlow.Application/Features/Tasks/Update/UpdateTaskItemCommandHandler.cs`
  - Đọc handler hiện tại — nếu đã tạo notification khi assign → inject `IRealtimeNotificationService` + gọi tương tự.
  - Nếu chưa tạo notification → thêm: khi `AssigneeId` thay đổi, tạo Notification entity + broadcast.

---

## PHẦN 2 — Notification Preferences Enforcement (B21.2)

### 2.1 Thêm INotificationPreferencesRepository
- **Interface:** `src/DevFlow.Application/Common/Interfaces/INotificationPreferencesRepository.cs`
  ```csharp
  public interface INotificationPreferencesRepository
  {
      Task<NotificationPreferences?> GetByUserIdAsync(Guid userId, CancellationToken ct);
  }
  ```
- **Implement:** `src/DevFlow.Infrastructure/Persistence/Repositories/NotificationPreferencesRepository.cs`
  ```csharp
  public sealed class NotificationPreferencesRepository(AppDbContext db) : INotificationPreferencesRepository
  {
      public Task<NotificationPreferences?> GetByUserIdAsync(Guid userId, CancellationToken ct)
          => db.NotificationPreferences.FirstOrDefaultAsync(np => np.UserId == userId, ct);
  }
  ```
- Register: `services.AddScoped<INotificationPreferencesRepository, NotificationPreferencesRepository>();` trong Infrastructure `DependencyInjection.cs`.

### 2.2 Check prefs trong Comment handler
- **File:** `src/DevFlow.Application/Features/Comments/Create/CreateCommentCommandHandler.cs`
  - Inject `INotificationPreferencesRepository`.
  - Trước khi gửi email (dòng 65-70), load prefs:
    ```csharp
    var prefs = await preferencesRepository.GetByUserIdAsync(mentionedUser.Id, cancellationToken);
    if (prefs?.EmailOnMention == true && !string.IsNullOrWhiteSpace(mentionedUser.Email))
    {
        // send email (existing code)
    }
    ```

### 2.3 Check prefs trong Task assign handler
- **File:** `src/DevFlow.Application/Features/Tasks/Update/UpdateTaskItemCommandHandler.cs`
  - Tương tự: load prefs của assignee, chỉ gửi email nếu `EmailOnAssignment == true`.

---

## PHẦN 3 — Email Links Thật (B21.3)

### 3.1 Frontend URL config
- **File:** `src/DevFlow.Infrastructure/Email/ResendEmailService.cs`
  - Thêm config `FRONTEND_URL` (hoặc lấy từ `IConfiguration`).
  - Sửa các `<a href="#">` thành URL thật:
    - Task assigned: `${frontendUrl}/workspaces/{workspaceId}/projects/{projectId}/board?selectedTaskId={taskId}`
    - Mention: tương tự
    - Sprint started: `${frontendUrl}/workspaces/{workspaceId}/projects/{projectId}/sprints/{sprintId}`
  - Cần truyền workspaceId/projectId/sprintId vào các method `IEmailService` (hiện tại chỉ có `toEmail, taskTitle, projectName, assignedBy`). **Thêm tham số**:
    ```csharp
    Task SendTaskAssignedEmailAsync(string toEmail, string taskTitle, string projectName, string assignedBy, string workspaceId, string projectId, string taskId);
    ```
  - Update call sites trong `CreateCommentCommandHandler` và `UpdateTaskItemCommandHandler` để truyền IDs.

---

## 🧪 QUALITY GATES (bắt buộc)
1. `dotnet build` 0 warning 0 error.
2. `dotnet test` (chạy từ gốc) phải xanh.
3. **Thêm unit test** cho: notification broadcast gọi đúng user, prefs check skip email khi disabled.
4. Commit: `feat: realtime notification push + prefs enforcement + email links (Sprint 21)`
5. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/backend-sprint21-notifications
   git add .
   git commit -m "feat: realtime notification push + prefs enforcement + email links (B21.1-3)"
   git push origin feat/backend-sprint21-notifications
   gh pr create --base main --head feat/backend-sprint21-notifications --title "feat: Sprint 21 realtime notification delivery + email enhancements (Agent B)" --body "SignalR push on @mention/assign, notification prefs check, real email links via FRONTEND_URL config."
   ```
6. **KHÔNG đụng** file: `frontend/**`, `src/DevFlow.Api/Controllers/MyTasksController.cs`, `src/DevFlow.Application/Features/Tasks/MyTasks/**`, `src/DevFlow.Application/Features/Export/**`, `src/DevFlow.Api/Controllers/ExportController.cs`.

> ⚠️ Nếu move interface `INotificationBroadcaster` từ Api→Application, update `Program.cs` import. Đảm bảo `NotificationBroadcaster` (Api layer) implement interface từ Application sau khi move.

> ⚠️ `IRealtimeNotificationService` ở Application layer, `SignalRNotificationService` ở Infrastructure layer. Cần `using Microsoft.AspNetCore.SignalR` trong Infrastructure — thêm package reference `Microsoft.AspNetCore.SignalR.Core` vào `DevFlow.Infrastructure.csproj` nếu thiếu.

> Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.