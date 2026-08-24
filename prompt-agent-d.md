# 🚀 PROMPT CHO AGENT D — Sprint 22 (Search Enhancement + Team Report Depth) — FULLSTACK

**Bạn là Agent D (fullstack specialist)** trong đội DevFlow (ASP.NET Core 8 + React 19).
Branch prefix: `feat/sprint22-search-reporting`.
**QUAN TRỌNG:** KHÔNG đụng file Agent A (task/comment/subtask handlers), Agent B (StartSprintCommandHandler, Outbox, notification cleanup), Agent C (EpicPage, GraphModal, NotificationsPanel).

---

## BỐI CẢNH
Search hiện chỉ cover task title/description + project name/key — **không search comments, epics, labels, users**. Team Report còn basic (không có per-member breakdown, trend indicators).

---

## D22.1 — Search Enhancement

### Backend
- **File chính:** `src/DevFlow.Application/Features/Search/SearchQueryHandler.cs`, `SearchQuery.cs`, `src/DevFlow.Api/Controllers/SearchController.cs`.
- Mở rộng `SearchQueryHandler` để search thêm:
  1. **Comments** — match `Comment.Content` (join qua task).
  2. **Epics** — match `Epic.Name` (xem `IEpicRepository`).
  3. **Labels** — match `Label.Name` (xem `ILabelRepository`).
  4. **Users** — match `User.DisplayName`/`Username` (member của workspace).
- **Response shape:** mở rộng `SearchResult` để trả về các loại mới (EpicResult, LabelResult, UserResult, CommentResult hoặc gom vào nhóm "other"). Kiểm tra frontend `SearchPage.tsx` để biết shape hiện tại, tránh phá vỡ UI.
- **Giới hạn:** top 5-10 kết quả mỗi loại, tổng ≤ 20.

### Frontend
- **File:** `frontend/src/pages/SearchPage.tsx`, `frontend/src/components/CommandPalette.tsx`.
- Hiển thị kết quả theo **tab hoặc section**: Tasks / Projects / Epics / Labels / Users / Comments.
- Mỗi kết quả: icon + title + meta (project key, type badge) → click navigate.
- Command palette: mở rộng để hiển thị epic/label/user kết quả (không chỉ tasks).

### i18n
- en: `search.tabTasks`, `search.tabProjects`, `search.tabEpics`, `search.tabLabels`, `search.tabUsers`, `search.tabComments`.
- vi: `search.tabTasks` ("Tasks"), `search.tabProjects` ("Dự án"), `search.tabEpics` ("Epics"), `search.tabLabels` ("Nhãn"), `search.tabUsers` ("Thành viên"), `search.tabComments` ("Bình luận").

### Tests (backend)
- Test: search tìm thấy comment match keyword.
- Test: search tìm thấy epic/label/user.
- Test: search vẫn trả tasks đúng.

---

## D22.2 — Team Report Depth

### Backend
- **File chính:** `src/DevFlow.Application/Features/Reporting/ReportingHandlers.cs` (TeamReport section), `src/DevFlow.Api/Controllers/ReportingController.cs`.
- Mở rộng team report:
  1. **Per-member breakdown:** tasks completed, avg cycle time, tasks in progress cho từng member.
  2. **Trend indicators:** so sánh sprint hiện tại vs trước (completed up/down, cycle time up/down) — arrow indicators.
- **Response shape:** thêm các field mới (memberStats: [{ userId, name, completedCount, avgCycleTimeDays, inProgressCount }], trends: { completedDelta, cycleTimeDelta }).
- **QUAN TRỌNG:** kiểm tra `TeamReportResponse` shape hiện tại + frontend `ReportsPage.tsx` consumer — mở rộng chứ KHÔNG phá vỡ field cũ.

### Frontend
- **File:** `frontend/src/pages/ReportsPage.tsx`, `frontend/src/components/reporting/` (xem có TeamReport component không).
- Hiển thị:
  1. **Member table:** name | tasks completed | avg cycle time | in progress.
  2. **Trend chips:** ▲/▼ completed so với sprint trước, ▲/▼ cycle time.
  3. Trend indicator màu: green = tốt (completed tăng / cycle time giảm), red = xấu.

### i18n
- en: `report.member`, `report.completed`, `report.avgCycleTime`, `report.inProgress`, `report.vsPrevSprint`, `report.completedUp`, `report.completedDown`, `report.cycleUp`, `report.cycleDown`.
- vi: tương ứng tiếng Việt.

---

## 🧪 QUALITY GATES (bắt buộc)
1. Backend: `dotnet build` 0 warning, `dotnet test` xanh (thêm ít nhất 3 tests).
2. Frontend: `npm run build` xanh.
3. Commit: `feat: enhanced search + team report depth (D22.1-2)`
4. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/sprint22-search-reporting
   git add .
   git commit -m "feat: enhanced search + team report depth (D22.1-2)"
   git push origin feat/sprint22-search-reporting
   gh pr create --base main --head feat/sprint22-search-reporting --title "feat: Sprint 22 search enhancement + team report depth (Agent D)" --body "D22.1: search comments/epics/labels/users. D22.2: per-member team report + trend indicators."
   ```
5. **KHÔNG đụng** file Agent A (task/comment/subtask handlers), Agent B (StartSprintCommandHandler, Outbox, notification cleanup), Agent C (EpicPage, GraphModal, NotificationsPanel).

> ⚠️ Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.
