# 🚀 PROMPT CHO AGENT A — Sprint 22 (Activity Log Coverage + Team Lead)

**Bạn là Agent A (team lead)** trong đội DevFlow (ASP.NET Core 8 + React 19).
Branch prefix: `feat/sprint22-activity-log`.
**QUAN TRỌNG:** KHÔNG đụng file Agent B (SprintStart/Outbox/NotificationCleanup), Agent C (EpicProgress/DependencyGraph/NotificationUI), Agent D (Search/TeamReport).

---

## PHẦN 1 — Backend: Activity Log Coverage (A22.1)

### 1.1 Hiểu pattern hoạt động log hiện tại
- **Tham khảo:** `src/DevFlow.Application/Features/Tasks/Dependencies/DependencyHandlers.cs` — xem cách nó tạo `ActivityLog`.
- **Entity:** `src/DevFlow.Domain/Entities/ActivityLog.cs` — xem constructor và các property.
- **Repository:** `src/DevFlow.Application/Common/Interfaces/IActivityLogRepository.cs` (hoặc tương đương) — xem method `AddAsync`.
- **Lưu ý:** tìm cách handler hiện tại lưu ActivityLog. Nếu dùng `IUnitOfWork.SaveChangesAsync`, thêm vào cùng transaction.

### 1.2 Handler cần thêm ActivityLog
Thêm `ActivityLog` vào các handler sau (theo pattern DependencyHandlers):

1. **`src/DevFlow.Application/Features/Tasks/Create/CreateTaskItemCommandHandler.cs`**
   - Event: task được tạo. Message: `"created task \"{title}\""`.

2. **`src/DevFlow.Application/Features/Tasks/Update/UpdateTaskItemCommandHandler.cs`**
   - Event: task được cập nhật (chỉ log khi có thay đổi đáng kể: status, assignee, title, priority). Message: `"updated task \"{title}\""` (hoặc chi tiết hơn: `"moved task to {status}"`).

3. **`src/DevFlow.Application/Features/Tasks/Delete/DeleteTaskItemCommandHandler.cs`**
   - Event: task bị xóa. Message: `"deleted task \"{title}\""`.

4. **`src/DevFlow.Application/Features/Tasks/Subtasks/*`** (các handler subtask)
   - Event: subtask được tạo/hoàn thành. Message: `"added subtask \"{title}\""` / `"completed subtask \"{title}\""`.

5. **`src/DevFlow.Application/Features/Comments/Create/CreateCommentCommandHandler.cs`**
   - Event: comment được thêm. Message: `"commented on \"{taskTitle}\""`.

### 1.3 Chuẩn chung
- **Entity reference:** cần có `WorkspaceId`, `ProjectId`, `TaskItemId` (nếu có), `ActorUserId` (= `IUserContext.UserId`), `Message`.
- Inject `IActivityLogRepository` (hoặc repository phù hợp) vào constructor handler.
- Gọi `AddAsync` rồi để `IUnitOfWork.SaveChangesAsync` persist (KHÔNG gọi SaveChanges riêng).
- **KHÔNG thay đổi hành vi business logic hiện tại** — chỉ thêm logging.

### 1.4 Tests
- **File mới:** `tests/DevFlow.UnitTests/Features/Tasks/ActivityLogTests.cs` (hoặc thêm vào test hiện có).
  - Test: task create → ActivityLog được thêm.
  - Test: task delete → ActivityLog được thêm.
  - Test: comment create → ActivityLog được thêm.
  - Dùng NSubstitute mock `IActivityLogRepository`.

---

## 🧪 QUALITY GATES (bắt buộc)
1. Backend: `dotnet build` 0 warning, `dotnet test` xanh (thêm ít nhất 3 tests).
2. Commit: `feat: activity log coverage for tasks/comments/subtasks (A22.1)`
3. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/sprint22-activity-log
   git add .
   git commit -m "feat: activity log coverage for tasks/comments/subtasks (A22.1)"
   git push origin feat/sprint22-activity-log
   gh pr create --base main --head feat/sprint22-activity-log --title "feat: Sprint 22 Activity Log coverage (Agent A)" --body "Adds ActivityLog entries to task create/update/delete, subtask, and comment handlers."
   ```
4. **KHÔNG đụng** file Agent B (StartSprintCommandHandler, Outbox, NotificationService), Agent C (EpicPage, dependency graph components, NotificationsPanel), Agent D (Search, TeamReport).

> ⚠️ Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.
