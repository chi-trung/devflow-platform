# 🚀 PROMPT CHO AGENT B — Sprint 20 (Cycle/Lead Time + Velocity History)

**Bạn là Agent B** trong đội DevFlow (ASP.NET Core 8 + React 19).
Branch prefix: `feat/backend-sprint20-*`.
**QUAN TRỌNG:** Chỉ sửa file trong `src/` (backend). KHÔNG đụng frontend, KHÔNG đụng file Agent A & C.

---

## PHẦN 1 — Cycle Time & Lead Time Analytics (B20.1)

### 1.1 Thêm `StartedAtUtc` cho TaskItem
- **File:** `src/DevFlow.Domain/Entities/TaskItem.cs`
  - Thêm `public DateTimeOffset? StartedAtUtc { get; private set; }`
  - Trong `ChangeStatus(TaskItemStatus status)`: khi status chuyển sang `InProgress` mà `StartedAtUtc == null` → set `StartedAtUtc = DateTimeOffset.UtcNow`.
- **Migration mới:** thêm cột nullable `started_at_utc`:
  ```bash
  dotnet ef migrations add AddTaskStartedAtUtc --project src/DevFlow.Infrastructure --startup-project src/DevFlow.Api
  ```

### 1.2 Endpoint Cycle/Lead Time
- **File mới:** `src/DevFlow.Application/Features/Reporting/GetCycleLeadTimeQuery.cs` (hoặc thêm vào `ReportingHandlers.cs` nếu hợp lý)
  - `GetCycleLeadTimeQuery(WorkspaceId, ProjectId)` → response:
    ```csharp
    public sealed record CycleLeadTimeResponse(
        double? CycleTimeP50, double? CycleTimeP90,  // ngày, từ InProgress->Done
        double? LeadTimeP50, double? LeadTimeP90,     // ngày, từ Created->Done
        IReadOnlyList<TaskCycleLeadTime> Tasks);       // per-task breakdown (tối đa 100 mới nhất)
    public sealed record TaskCycleLeadTime(
        Guid TaskId, string Title, TaskItemStatus Status,
        DateTimeOffset CreatedAtUtc, DateTimeOffset? StartedAtUtc, DateTimeOffset? CompletedAtUtc,
        double? CycleTimeDays, double? LeadTimeDays);
    ```
  - **Tính toán:** chỉ tính task **đã Done** (`CompletedAtUtc != null`) trong khoảng thời gian hợp lý.
    - Cycle Time = `CompletedAtUtc - StartedAtUtc` (nếu StartedAtUtc null → dùng CreatedAtUtc làm fallback)
    - Lead Time = `CompletedAtUtc - CreatedAtUtc`
    - P50/P90 = percentile trên các giá trị (sort + index; P50 = vị trí `0.5*(n-1)`, P90 = `0.9*(n-1)`). Làm tròn 2 chữ số.
  - Dùng `ITaskItemRepository.GetForProjectAsync(projectId, null)` có sẵn. KHÔNG cần SQL phức tạp.

### 1.3 Controller
- **File:** `src/DevFlow.Api/Controllers/ReportingController.cs` — thêm endpoint:
  ```csharp
  [HttpGet("cycle-lead-time")]
  [ProducesResponseType(typeof(CycleLeadTimeResponse), StatusCodes.Status200OK)]
  ```
  Route: `GET /api/v1/workspaces/{wsId}/projects/{projId}/reporting/cycle-lead-time`

---

## PHẦN 2 — Velocity History Trend (B20.2)

### 2.1 Endpoint Velocity History
- **File mới:** `src/DevFlow.Application/Features/Reporting/GetVelocityHistoryQuery.cs` (hoặc thêm vào ReportingHandlers.cs)
  - `GetVelocityHistoryQuery(WorkspaceId, ProjectId)` → response:
    ```csharp
    public sealed record VelocityHistoryResponse(
        IReadOnlyList<VelocityHistoryPoint> Points,   // 10 sprints gần nhất, cũ->mới
        double AverageCompleted, double AverageTotal);
    public sealed record VelocityHistoryPoint(
        Guid SprintId, string SprintName,
        int TotalStoryPoints, int CompletedStoryPoints,
        DateTimeOffset? EndDateUtc);
  ```
- **Logic:** dùng `ISprintRepository.GetForProjectAsync(projectId)` → lọc sprint có `StartDateUtc != null`, sort theo `StartDateUtc`, lấy **10 mới nhất**.
- Tính story points per sprint: query tasks `GetForProjectAsync`, nhóm theo `SprintId`, sum `StoryPoints ?? 0` (Total) và sum chỉ task `Status == Done` (Completed).
- **KHÔNG gọi** `GetSprintVelocityQuery` từng cái — tự aggregate 1 lần cho gọn.

### 2.2 Controller
- **File:** `src/DevFlow.Api/Controllers/ReportingController.cs` — thêm:
  ```csharp
  [HttpGet("velocity-history")]
  [ProducesResponseType(typeof(VelocityHistoryResponse), StatusCodes.Status200OK)]
  ```
  Route: `GET /api/v1/workspaces/{wsId}/projects/{projId}/reporting/velocity-history`

---

## 🧪 QUALITY GATES (bắt buộc)
1. `dotnet build` 0 warning 0 error.
2. `dotnet test` (chạy từ gốc) phải xanh. **Thêm unit test** cho: percentile P50/P90 đúng, StartedAtUtc set khi chuyển InProgress.
3. Commit: `feat: add cycle lead time analytics + velocity history (Sprint 20)`.
4. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/backend-sprint20-analytics
   git add .
   git commit -m "feat: cycle/lead time + velocity history analytics (B20.1-2)"
   git push origin feat/backend-sprint20-analytics
   gh pr create --base main --head feat/backend-sprint20-analytics --title "feat: Sprint 20 cycle/lead time + velocity history (Agent B)" --body "Cycle & Lead Time P50/P90 analytics, Velocity history trend over 10 sprints, StartedAtUtc tracking."
   ```
5. **KHÔNG đụng** file: `src/DevFlow.Api/Controllers/SprintsController.cs`, `src/DevFlow.Domain/Entities/Sprint.cs`, `frontend/**`, `src/DevFlow.Application/Features/Reporting/ReportingHandlers.cs` (nếu Agent A đang sửa — xem dưới), `src/DevFlow.Application/Features/Sprints/**`.

> ⚠️ **Phối hợp với Agent A:** nếu Agent A cũng thêm vào `ReportingController.cs` / `ReportingHandlers.cs` (B20.3 rollover), chỉ thêm **method mới** vào cuối, không sửa method có sẵn. Commit sớm để giảm conflict.

> Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.
