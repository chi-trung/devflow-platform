# 🚀 PROMPT CHO AGENT C — Sprint 20 (Custom Field Values on Cards + Analytics Charts)

**Bạn là Agent C** trong đội DevFlow (React 19 + TypeScript + Vite + Tailwind v4).
Branch prefix: `feat/frontend-sprint20-*`.
**QUAN TRỌNG:** Chỉ sửa file trong `frontend/src/`. KHÔNG đụng backend, KHÔNG đụng file Agent A & B.

---

## PHẦN 1 — Custom Field Values trên Kanban Cards (F20.1)

Backend **đã có sẵn** API:
- `GET /api/v1/workspaces/{wsId}/projects/{projId}/tasks/{taskId}/custom-fields` → `CustomFieldValueResponse[]`
- `PUT .../tasks/{taskId}/custom-fields/{fieldId}` → set value
- Check `frontend/src/lib/api.ts`: đã có `getTaskCustomFieldValues(workspaceId, projectId, taskId)` (đã import type `CustomFieldValueResponse`). Nếu chưa có `setCustomFieldValue`, thêm theo pattern `api<T>()`.

### 1.1 TaskCard badges
- **File:** `frontend/src/components/board/TaskCard.tsx`
  - Fetch custom field values cho task (tối đa hiển thị **3 badge** đầu tiên, mỗi badge `bg-elevated text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]`).
  - Chỉ render khi có value (`value != null` và `!== ""`). Label = field name, value = `value`.
  - Gọi API một lần khi card mount — dùng `useApi` hoặc `useEffect` (theo pattern TaskPullRequests trong TaskDetailPanel). Nếu lỗi → silent, không hiện gì.

### 1.2 TaskDetailPanel values
- **File:** `frontend/src/components/board/TaskDetailPanel.tsx`
  - Thêm section "Custom Fields" (giữa DependencySection và TimeTrackingSection hoặc sau SubtaskSection).
  - List tất cả fields có value: `field.name` + `field.value` (render theo `field.fieldType`).
  - Nếu chưa có editable: **tối thiểu hiển thị read-only list** các field values của task.
  - i18n: thêm keys `taskDetail.customFields`, `taskDetail.noCustomFields` vào `en.json` + `vi.json` (section `taskDetail.*`).

---

## PHẦN 2 — Cycle/Lead Time & Velocity Trend Charts (F20.2)

Backend Agent B sẽ thêm 2 endpoint — **dùng khi chúng tồn tại** (test bằng cách fetch, nếu 404 thì để placeholder):
- `GET .../reporting/cycle-lead-time` → `{ cycleTimeP50, cycleTimeP90, leadTimeP50, leadTimeP90, tasks[] }`
- `GET .../reporting/velocity-history` → `{ points[]: {sprintId, sprintName, totalStoryPoints, completedStoryPoints, endDateUtc}, averageCompleted, averageTotal }`

### 2.1 CycleLeadTimeChart.tsx
- **File mới:** `frontend/src/components/reporting/CycleLeadTimeChart.tsx`
  - Dùng `@tremor/react` nếu có, hoặc SVG đơn giản như `VelocityChart.tsx` hiện tại (đọc file này làm reference).
  - Hiển thị 4 số lớn: Cycle P50, Cycle P90, Lead P50, Lead P90 (đơn vị "d" = days).
  - Optional: mini scatter plot của per-task cycle time (trục x = task index, y = days).

### 2.2 VelocityTrendChart.tsx
- **File mới:** `frontend/src/components/reporting/VelocityTrendChart.tsx`
  - Bar chart 10 sprints (như VelocityChart.tsx): planned (ghost) vs completed (solid) per sprint.
  - Đường trung bình `averageCompleted` (dashed line).
  - Reuse styling constants pattern từ `VelocityChart.tsx`.

### 2.3 Wire vào ReportsPage
- **File:** `frontend/src/pages/ReportsPage.tsx`
  - Thêm 2 chart mới bên dưới `VelocityChart`/`BurndownChartApi`.
  - Fetch 2 endpoint mới bằng pattern `useApi` hiện có; nếu lỗi → ẩn chart + hiện placeholder text (`reports.analyticsUnavailable`).
  - i18n keys: `reports.cycleLeadTime`, `reports.velocityTrend`, `reports.cycleTimeP50`, `reports.cycleTimeP90`, `reports.leadTimeP50`, `reports.leadTimeP90`, `reports.days`, `reports.analyticsUnavailable`.

---

## 🧪 QUALITY GATES (bắt buộc)
1. `npm run build` trong `frontend/` phải xanh (TypeScript strict).
2. Commit: `feat: custom field values on cards + cycle/velocity charts (Sprint 20)`.
3. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/frontend-sprint20-analytics
   git add .
   git commit -m "feat: custom field values on cards + cycle/lead & velocity trend charts (F20.1-2)"
   git push origin feat/frontend-sprint20-analytics
   gh pr create --base main --head feat/frontend-sprint20-analytics --title "feat: Sprint 20 custom field values + analytics charts (Agent C)" --body "Custom field value badges on cards, detail panel values, cycle/lead time & velocity trend charts."
   ```
4. **KHÔNG đụng** file: `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/CustomFieldsPage.tsx`, `frontend/src/components/dashboard/**`, `frontend/src/components/board/SprintBar.tsx` (nếu Agent A đang làm), `src/**`, `frontend/src/lib/api.ts` (nếu có conflict, chỉ thêm hàm mới, không sửa hàm có sẵn).

> ⚠️ **Phối hợp:** nếu `frontend/src/lib/api.ts` có conflict với Agent A — chỉ **append** hàm mới, không sửa hàm có sẵn. Nếu endpoint backend chưa có (Agent B chưa xong), để placeholder + note trong PR, ĐỪNG block.

> Nếu gặp rate limit (429): commit phần đã xong ngay, đừng bỏ lửng file.
