# 🚀 PROMPT CHO AGENT C — Sprint 21 (Dashboard Charts + Export Enhancement)

**Bạn là Agent C** trong đội DevFlow (React 19 + TypeScript + Vite + Tailwind v4).
Branch prefix: `feat/frontend-sprint21-dashboard`.
**QUAN TRỌNG:** Chỉ sửa file trong `frontend/src/`. KHÔNG đụng backend, KHÔNG đụng file Agent A & B.

---

## Context — Dashboard Hiện Tại

Verified in code: `DashboardPage.tsx` hiện có:
- `StatsCards` (total tasks, in progress, completed, overdue)
- `CumulativeFlow` (stacked bar snapshot)
- `TaskDistribution` (pie chart)
- `RecentActivity` list
- **KHÔNG có** cycle/lead time chart (chỉ có ở `ReportsPage` dưới dạng `CycleLeadTimeChart`)

Export hiện tại: `ExportProjectTasksQuery` — chỉ export tasks của 1 project. Không có cross-project export.

---

## PHẦN 1 — Dashboard Cycle/Lead Time Trend (F21.1)

### 1.1 Tạo component DashboardCycleLeadChart
- **File mới:** `frontend/src/components/dashboard/DashboardCycleLeadChart.tsx`
  - Không cần SVG chart phức tạp — hiển thị **4 stat tiles** lớn (P50/P90 cycle/lead time) nhưng có **mini sparkline** (xu hướng).
  - Gọi `GET /api/v1/workspaces/{wsId}/projects/{projId}/reporting/cycle-lead-time` (đã có sẵn từ Sprint 20, Agent B).
  - Dùng `useApi` pattern:
    ```typescript
    const { data } = useApi<CycleLeadTimeResponse>(...);
    ```
  - Nếu `data` null/error → render placeholder "Analytics data not available yet" (dùng i18n key `dashboard.analyticsUnavailable` đã có).
  - Layout: grid 2x2 với 4 tiles:
    ```
    ┌──────────────┬──────────────┐
    │ Cycle P50    │ Cycle P90    │
    │ 2.4d         │ 5.1d         │
    ├──────────────┼──────────────┤
    │ Lead P50     │ Lead P90     │
    │ 4.2d         │ 8.7d         │
    └──────────────┴──────────────┘
    ```
  - Mỗi tile: rounded border, label text-muted-foreground, value font-mono text-lg font-semibold.
  - Reuse CSS variables pattern từ `DashboardPage.tsx` hiện tại.

### 1.2 Wire vào DashboardPage
- **File:** `frontend/src/pages/DashboardPage.tsx`
  - Thêm `DashboardCycleLeadChart` bên dưới `CumulativeFlow` (hoặc cạnh `TaskDistribution`).
  - Import component + render:
    ```tsx
    <DashboardCycleLeadChart workspaceId={workspaceId} projectId={projectId} />
    ```
  - Cần `workspaceId` và `projectId` — kiểm tra DashboardPage xem đã có 2 biến này chưa (thường có từ `useParams` hoặc state). Nếu DashboardPage là workspace-level (không có projectId), dùng project đầu tiên từ `dashboard.data` hoặc cho phép user chọn project.

### 1.3 i18n
- **File:** `frontend/src/i18n/en.json` + `frontend/src/i18n/vi.json`
  - Key `dashboard.cycleTime` và `dashboard.leadTime` đã có từ Sprint 20.
  - Thêm (nếu thiếu): `dashboard.cycleTimeLabel`, `dashboard.leadTimeLabel`.

---

## PHẦN 2 — Export Enhancement (F21.2) — Optional, nếu đơn giản

### 2.1 Export button cải tiến
- **File:** `frontend/src/pages/ReportsPage.tsx`
  - Export hiện tại: `exportTasks(workspaceId, projectId, format)` → CSV/JSON.
  - Thêm **filter scope** cho export: "All tasks" vs "Current view" (nếu có filter active).
  - Hoặc đơn giản: thêm export button cho **velocity chart** (export chart data as CSV).

### 2.2 Export CSV từ chart data
- **File:** `frontend/src/components/reporting/CycleLeadTimeChart.tsx` (hoặc component mới `ExportChartButton.tsx`)
  - Thêm nút export CSV bên cạnh chart title.
  - Khi click: generate CSV từ `data.tasks` (taskId, title, cycleTimeDays, leadTimeDays) + trigger download.
  - Dùng `Blob` + `URL.createObjectURL` pattern (giống ReportsPage.tsx `handleExport`).

---

## PHẦN 3 — Dashboard select project (F21.3) — Nếu DashboardPage workspace-level

### 3.1 Nếu DashboardPage hiện tại không có project selector
- **File:** `frontend/src/pages/DashboardPage.tsx`
  - DashboardPage hiện tại có thể là workspace-level (không biết projectId).
  - Thêm dropdown chọn project (dùng `useApi` lấy `projects` từ workspace).
  - Khi chọn project, pass projectId xuống `DashboardCycleLeadChart` và `CumulativeFlow` (nếu cần project-scoped data).
  - Mặc định chọn project đầu tiên.

---

## 🧪 QUALITY GATES (bắt buộc)
1. `npm run build` trong `frontend/` phải xanh (TypeScript strict).
2. Commit: `feat: dashboard cycle/lead time chart + export enhancement (Sprint 21)`
3. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/frontend-sprint21-dashboard
   git add .
   git commit -m "feat: dashboard cycle/lead time chart + export enhancement (F21.1-2)"
   git push origin feat/frontend-sprint21-dashboard
   gh pr create --base main --head feat/frontend-sprint21-dashboard --title "feat: Sprint 21 dashboard cycle/lead time + export (Agent C)" --body "Dashboard cycle/lead time P50/P90 tiles, CSV export enhancement for chart data."
   ```
4. **KHÔNG đụng** file: `src/**`, `frontend/src/pages/MyTasksPage.tsx`, `frontend/src/components/AppShell.tsx` (nếu Agent A đang sửa navigation), `frontend/src/lib/api.ts` (nếu có conflict, chỉ append hàm mới).

> ⚠️ DashboardPage có thể không có `projectId` — nếu workspace-level, cần thêm project selector. Xem `useParams()` để biết route params.

> Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.