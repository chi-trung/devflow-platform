# 🚀 PROMPT CHO AGENT A — Sprint 20 (Sprint Rollover API + Team Performance Dashboard)

**Bạn là Agent A (team lead)** trong đội DevFlow (ASP.NET Core 8 + React 19).
Branch prefix: `feat/backend-sprint20-*` (backend), `feat/frontend-sprint20-*` (frontend).
**QUAN TRỌNG:** KHÔNG đụng file Agent B (ReportingHandlers.cs, ReportingController.cs endpoints cycle-lead-time/velocity-history, TaskItem.cs StartedAtUtc) và Agent C (TaskCard.tsx, TaskDetailPanel.tsx, ReportsPage.tsx charts, components/reporting/CycleLeadTimeChart.tsx, VelocityTrendChart.tsx).

---

## PHẦN 1 — Backend: Sprint Rollover Automation (B20.3)

### 1.1 Rollover command + handler
- **File mới:** `src/DevFlow.Application/Features/Sprints/Rollover/RolloverSprintCommand.cs`
  ```csharp
  public sealed record RolloverSprintCommand(
      Guid WorkspaceId, Guid ProjectId, Guid SprintId) : IRequest<RolloverResult>, IWorkspaceRequest;

  public sealed record RolloverResult(int RolledOverTasks, int CompletedTasks, Guid? TargetSprintId);
  ```
- **Logic handler:**
  1. Load sprint (`ISprintRepository.GetByIdAsync`). Nếu chưa `Completed` → **không làm gì**, trả `RolloverResult(0, 0, null)` (hoặc throw InvalidOperationException — chọn không throw để API an toàn, trả 200 với kết quả rỗng).
  2. Load toàn bộ tasks của project (`ITaskItemRepository.GetForProjectAsync`).
  3. Lọc task thuộc sprint này (`task.SprintId == sprintId`) và **chưa Done** (`Status != Done`).
  4. Tìm sprint **Planned kế tiếp** trong project (`GetForProjectAsync` → filter `Status == Planned`, sort theo `StartDateUtc` hoặc `CreatedAtUtc`, lấy cái đầu tiên). Nếu có → set `task.AssignToSprint(targetSprint.Id)`. Nếu không có → set `task.RemoveFromSprint()` (trả về backlog).
  5. Ghi activity log cho mỗi task: `ActivityLog.Create(workspaceId, projectId, task.Id, Guid.Empty, $"Rolled over from sprint {sprint.Name}", task.Title)`.
  6. `unitOfWork.SaveChangesAsync`.
  7. Trả `RolloverResult(rolledCount, completedCount, targetSprint?.Id)`.

### 1.2 Controller endpoint
- **File:** `src/DevFlow.Api/Controllers/SprintsController.cs` — thêm **method mới** (không sửa method có sẵn):
  ```csharp
  [HttpPost("{sprintId:guid}/rollover")]
  [ProducesResponseType(typeof(RolloverResult), StatusCodes.Status200OK)]
  ```
  Route: `POST /api/v1/workspaces/{wsId}/projects/{projId}/sprints/{sprintId}/rollover`
- Inject `ISender` như các action khác. Theo pattern `Complete` action hiện có.

### 1.3 Unit tests
- **File mới:** `tests/DevFlow.UnitTests/Features/Sprints/RolloverSprintHandlerTests.cs`
  - Test: task chưa Done → chuyển sang sprint planned kế tiếp.
  - Test: không có sprint planned → task về backlog (SprintId null).
  - Test: task Done không bị đụng.
  - Dùng NSubstitute mock `ISprintRepository`, `ITaskItemRepository`, `IActivityLogRepository`, `IUnitOfWork` (theo pattern `PatHandlerTests.cs`).

---

## PHẦN 2 — Frontend: Team Performance Dashboard + CFD (F20.3)

### 2.1 Cumulative Flow Diagram (CFD)
- **File mới:** `frontend/src/components/dashboard/CumulativeFlow.tsx`
  - SVG stacked area chart hiển thị số task theo trạng thái (Backlog/InProgress/InReview/Done) theo thời gian.
  - **Nguồn dữ liệu:** không có API CFD riêng → **tính client-side từ dashboard data** có sẵn (`loadDashboard` → task counts per status). Vẽ 1 lần snapshot hiện tại (không cần lịch sử thời gian thực). Nếu phức tạp, tối giản thành stacked bar các status hiện tại.
  - Màu: dùng CSS vars (`var(--color-primary)`, `--color-border`, opacity scale) theo pattern `VelocityChart.tsx`.
  - Label tiếng Việt/Anh qua `t()`.

### 2.2 Team performance numbers (P50/P90 cycle time)
- **File mới:** `frontend/src/components/dashboard/TeamPerformancePanel.tsx`
  - Gọi `GET .../reporting/cycle-lead-time` (Agent B đang làm). Nếu 404/chưa có → hiện placeholder text.
  - Hiển thị 4 stat tiles: Cycle P50, Cycle P90, Lead P50, Lead P90 (đơn vị "d").
  - Reuse `StatsCards` styling nếu đơn giản, hoặc tự render grid 2x2.

### 2.3 Wire vào DashboardPage
- **File:** `frontend/src/pages/DashboardPage.tsx`
  - Thêm `TeamPerformancePanel` và `CumulativeFlow` vào dưới `StatsCards` (khu vực hiện có). Import + render theo pattern đã có.
  - i18n keys: `dashboard.teamPerformance`, `dashboard.cycleTime`, `dashboard.leadTime`, `dashboard.cfd`, `dashboard.cfdUnavailable`, `dashboard.p50`, `dashboard.p90`, `dashboard.days` (thêm vào `en.json` + `vi.json`, section `dashboard.*`).

### Files frontend (CHỈ các file này):
- `frontend/src/components/dashboard/CumulativeFlow.tsx` (mới)
- `frontend/src/components/dashboard/TeamPerformancePanel.tsx` (mới)
- `frontend/src/pages/DashboardPage.tsx` (thêm import + render)
- `frontend/src/lib/api.ts` (thêm hàm `getCycleLeadTime` nếu chưa có — CHỈ append)
- `frontend/src/i18n/en.json` + `frontend/src/i18n/vi.json`
- `frontend/src/types/api.ts` (thêm type `CycleLeadTimeResponse` nếu cần)

---

## 🧪 QUALITY GATES (bắt buộc)
1. Backend: `dotnet build` 0 warning, `dotnet test` xanh.
2. Frontend: `npm run build` xanh.
3. Commit: `feat: sprint rollover API + team performance dashboard (Sprint 20)`.
4. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/sprint20-rollover-dashboard
   git add .
   git commit -m "feat: sprint rollover API + team performance dashboard/CFD (B20.3+F20.3)"
   git push origin feat/sprint20-rollover-dashboard
   gh pr create --base main --head feat/sprint20-rollover-dashboard --title "feat: Sprint 20 rollover + team dashboard (Agent A)" --body "Sprint rollover API (POST /sprints/{id}/rollover), Cumulative Flow Diagram + team performance P50/P90 panel."
   ```
5. **KHÔNG đụng** file Agent B/C đã liệt kê ở đầu. Nếu `ReportingController.cs`/`ReportingHandlers.cs` cần sửa — chỉ append method mới, không sửa method có sẵn.

> ⚠️ **Phối hợp:** Agent B đang thêm cycle-lead-time/velocity-history vào `ReportingController.cs`. Chỉ **append** method mới vào cuối file. Nếu conflict khi merge — giải quyết theo hướng giữ cả 2.

> Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.
