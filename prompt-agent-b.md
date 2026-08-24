# 🚀 PROMPT CHO AGENT B — Sprint 22 (Sprint-Start Notifications + Outbox Wiring + Notification Cleanup)

**Bạn là Agent B (backend specialist)** trong đội DevFlow (ASP.NET Core 8, Clean Architecture: Domain/Application/Infrastructure/Api).
Branch prefix: `feat/backend-sprint22-notifications`.
**QUAN TRỌNG:** KHÔNG đụng file Agent A (task create/update/delete handlers, subtask handlers, CreateCommentCommandHandler), Agent C (frontend), Agent D (Search/Reporting).

---

## BỐI CẢNH
Sprint 21 đã thêm realtime notification push (IRealtimeNotificationService → SignalR) + prefs enforcement cho **mention** và **assignment**. Nhưng 3 gap vẫn còn:
1. **Sprint start không gửi notification/email gì cả** — `StartSprintCommandHandler` im lặng dù `EmailOnSprintStarted` pref + `SendSprintStartedEmailAsync` đã tồn tại.
2. **Outbox pattern được scaffold nhưng không ai dùng** — `OutboxRepository`, `OutboxDispatcher`, `OutboxProcessor` tồn tại nhưng không handler nào ghi `OutboxMessage`.
3. **Notification không có cleanup** — notifications tích lũy mãi, không có cơ chế xóa cũ.

---

## B22.1 — Sprint Start Notification

### Handler cần sửa
- **File:** `src/DevFlow.Application/Features/Sprints/Start/StartSprintCommandHandler.cs`

### Yêu cầu
1. Sau khi `sprint.Start(...)` + save, gửi notification tới **tất cả thành viên** project:
   - **Realtime:** push qua `IRealtimeNotificationService.NotifyUserAsync(userId, "SprintStarted", $"Sprint {sprint.Name} has started", taskId: null, projectId, workspaceId, ct)`.
   - **Persist:** tạo `Notification.Create(userId, "SprintStarted", $"Sprint {sprint.Name} has started", null, project.Id, project.WorkspaceId)` và lưu qua `INotificationRepository`.
   - **Email:** nếu `prefs?.EmailOnSprintStarted != false` và user có email → gọi `IEmailService.SendSprintStartedEmailAsync(email, sprint.Name, project.Name, workspaceId, projectId, sprintId)`.
2. **Ai là "tất cả thành viên"?** — lấy list members từ `IWorkspaceMemberRepository` hoặc repository tương đương (xem `ListWorkspaceMembersQueryHandler` để biết cách). Bỏ qua actor (người start sprint).
3. **Prefs:** dùng `INotificationPreferencesRepository.GetByUserIdAsync(userId)` — có sẵn từ Sprint 21.
4. Email fire-and-forget: dùng `.ContinueWith(_ => Task.CompletedTask, TaskContinuationOptions.OnlyOnCanceled)` pattern như handler khác.

### Tests
- **File mới/update:** `tests/DevFlow.UnitTests/Features/Sprints/StartSprintNotificationTests.cs`
  - Test: start sprint → notification được persist cho mỗi member.
  - Test: start sprint → email được gửi khi prefs cho phép.
  - Test: start sprint → email bị skip khi `EmailOnSprintStarted == false`.

---

## B22.2 — Outbox Wiring (webhook + email events)

### Bối cảnh
`OutboxProcessor`/`OutboxDispatcher`/`OutboxRepository` đã có nhưng **chưa được dùng**. Xem `src/DevFlow.Infrastructure/Outbox/` để hiểu cơ chế. OutboxMessage entity: `src/DevFlow.Domain/Entities/OutboxMessage.cs`.

### Yêu cầu
1. Chọn **1-2 event quan trọng** để ghi OutboxMessage (đừng over-engineer toàn bộ):
   - **Webhook delivery:** khi có webhook event được trigger (xem Webhooks feature — `src/DevFlow.Api/Controllers/WebhooksController.cs` và feature hiện tại), ghi OutboxMessage để processor gửi webhook một cách reliable.
   - **Hoặc Email:** ghi OutboxMessage cho email notifications thay vì fire-and-forget.
2. Pattern: trong handler, tạo `new OutboxMessage(...)` → `IOutboxRepository.AddAsync(...)` → save cùng transaction.
3. **QUAN TRỌNG:** kiểm tra xem `OutboxDispatcher`/`OutboxProcessor` có được DI-register và chạy background không. Nếu processor chưa được đăng ký chạy định kỳ, thêm nó (scheduled/background service) — hoặc document rõ nếu quá phức tạp.
4. Nếu scope quá lớn, ưu tiên: **chỉ webhook delivery**.

### Tests
- Test: webhook trigger → OutboxMessage được tạo.
- Test: processor xử lý OutboxMessage đúng.

---

## B22.3 — Notification Cleanup

### Yêu cầu
1. **Backend:** thêm endpoint `DELETE /api/v1/notifications` (hoặc `POST /api/v1/notifications/cleanup`) để xóa tất cả notifications đã đọc hoặc cũ hơn N ngày (mặc định 90).
2. **Repository:** thêm method vào `INotificationRepository` (vd `DeleteOlderThanAsync(Guid userId, DateTimeOffset cutoff)` hoặc `DeleteReadAsync`).
3. **Cân nhắc:** nếu có background job infrastructure sẵn, thêm cleanup định kỳ. Nếu không, chỉ cần endpoint cho frontend gọi.

### Tests
- Test: cleanup xóa notification đã đọc/cũ.
- Test: notification mới/chưa đọc giữ nguyên.

---

## 🧪 QUALITY GATES (bắt buộc)
1. Backend: `dotnet build` 0 warning, `dotnet test` xanh (thêm ít nhất 3 tests mới).
2. Commit: `feat: sprint-start notifications + outbox wiring + notification cleanup (B22.1-3)`
3. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/backend-sprint22-notifications
   git add .
   git commit -m "feat: sprint-start notifications + outbox wiring + notification cleanup (B22.1-3)"
   git push origin feat/backend-sprint22-notifications
   gh pr create --base main --head feat/backend-sprint22-notifications --title "feat: Sprint 22 sprint-start notifications, outbox wiring, cleanup (Agent B)" --body "B22.1: sprint-start notification push + email. B22.2: outbox wiring for webhook/email. B22.3: notification cleanup endpoint."
   ```
4. **KHÔNG đụng** file Agent A (CreateTaskItemCommandHandler, UpdateTaskItemCommandHandler, DeleteTaskItemCommandHandler, subtask handlers, CreateCommentCommandHandler), Agent C (frontend), Agent D (Search, Reporting).

> ⚠️ Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.
