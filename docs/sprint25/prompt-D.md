# 🚀 Sprint 25 — Prompt cho Agent D (Fullstack: Activity Transparency)

**Branch:** `feat/sprint25-activity-transparency` (tạo mới từ `main`)

---

## Bối cảnh

Activity log của DevFlow hiện rất thô: `ListActivitiesQuery` trả toàn bộ log của project (lấy 50 mới nhất), không có filter. Frontend `ActivitiesPage` hiện list đơn thuần, không phân biệt ai là ai làm gì, không lọc theo actor/entity/date. Khi project lớn, user khó truy vết "ai đã sửa task này", "tuần này có gì thay đổi".

Mục tiêu: biến activity log thành **công cụ truy vết minh bạch** — lọc theo actor, theo task, theo loại action, theo khoảng thời gian.

## 🎯 Nhiệm vụ

### D25.1: Backend — Nâng cấp ListActivitiesQuery với filter

`src/DevFlow.Application/Features/Activities/ListActivitiesQuery.cs` hiện:

```csharp
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListActivitiesQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<IReadOnlyList<ActivityResponse>>, IWorkspaceRequest;
```

**Thêm các filter optional:**

```csharp
public sealed record ListActivitiesQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid? ActorUserId = null,      // lọc theo người thực hiện
    Guid? TaskItemId = null,       // lọc theo task
    string? Action = null,         // lọc theo action ("created task", "updated task"...)
    DateTimeOffset? FromUtc = null,
    DateTimeOffset? ToUtc = null,
    int Take = 50,                 // mặc định 50, max 200
    int Page = 1)
    : IRequest<ActivityResponsePage>, IWorkspaceRequest;
```

Trả về kiểu phân trang (không phải list phẳng):
```csharp
public sealed record ActivityResponsePage(
    IReadOnlyList<ActivityResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);
```

**Repository:** thêm method mới vào `IActivityLogRepository` (hoặc mở rộng `GetForProjectAsync` — thêm overload):
```csharp
Task<ActivityLogPage> GetFilteredAsync(
    Guid projectId,
    Guid? actorUserId,
    Guid? taskItemId,
    string? action,
    DateTimeOffset? fromUtc,
    DateTimeOffset? toUtc,
    int skip,
    int take,
    CancellationToken cancellationToken = default);
```
Implement trong Infrastructure dùng `IQueryable` + `Where` từng filter (chỉ apply filter khi có giá trị). `TotalCount` = count sau filter, `Items` = skip/take.

**Action list:** thêm 1 file `ActivityAction.cs` (enum hoặc const) liệt kê các action đang dùng: `"created task"`, `"updated task"`, `"deleted task"`, `"created comment"`, `"updated comment"`, `"deleted comment"`, `"created subtask"`, `"detached subtask"`, `"deleted epic"`, ... — kiểm tra chuỗi `ActivityVerb` trong các command (`IProjectEvent.ActivityVerb`) và tổng hợp lại. Đây là để frontend hiển thị filter dropdown đúng.

**Controller:** mở rộng endpoint GET `/activities` nhận query params `actorUserId`, `taskItemId`, `action`, `from`, `to`, `page`, `pageSize`.

> **Lưu ý:** `IActivityLogRepository.GetForProjectAsync` hiện đang được `ListActivitiesQueryHandler` dùng. Đừng phá handler cũ — thêm mới, hoặc cập nhật handler dùng method mới với default filter (không filter = trả về y như cũ). Kiểm tra xem còn chỗ nào khác gọi `GetForProjectAsync` (vd TaskDetailPanel history) — nếu có, giữ nguyên signature cũ.

### D25.2: Frontend — ActivitiesPage nâng cấp

`frontend/src/pages/ActivitiesPage.tsx` + `getActivities` trong `frontend/src/lib/api.ts`:

**UI filter bar:**
- **Actor dropdown** — danh sách members (lấy từ `GET /workspaces/{id}/members`), label "Tất cả mọi người" / "All members".
- **Task filter** — input nhập task title, khi bấm thì query `?taskItemId=`. (Có thể dùng search nhẹ: tìm task theo title, lấy id.)
- **Action dropdown** — list từ `ActivityAction` (created task, updated task, ...).
- **Date range** — 2 input `<input type="date">` from/to.

**List render:**
- Phân trang: nút Prev/Next + "Page X / Y".
- Nhóm theo ngày (Today / Yesterday / hôm khác) để dễ đọc — optional nhưng nice-to-have.
- Mỗi item hiện rõ: avatar/name actor, action, target, time.

**i18n:** thêm đủ key vào `en.json` + `vi.json`.

## ✅ Quality Gates

- `dotnet test` 100% green. Thêm ít nhất **4 unit tests** cho `GetFilteredAsync` (lọc theo actor, lọc theo task, lọc theo action, phân trang/date range).
- `npm run build` pass (TypeScript strict).
- KHÔNG sửa file lock: `Program.cs`, `api.ts` (chỉ thêm/sửa `getActivities` signature — nếu cần tham số mới, giữ backward compatible bằng default).
- Push lên branch `feat/sprint25-activity-transparency`, mở PR, tag **Agent A** review.

## ⚠️ Lưu ý

- Backend trước, frontend sau — đảm bảo API ổn định rồi mới wire UI (thói quen repo).
- Đừng đổi `ActivityResponse` shape (id, taskItemId, actorName, action, target, createdAtUtc) — nếu cần thêm field, thêm mới, không xóa field cũ (frontend đang dùng).
- Kiểm tra `frontend/src/types/api.ts` để update `ActivityResponse` type nếu bạn thêm field.
