# 🚀 PROMPT CHO AGENT C — Sprint 22 (Epic Progress UI + Dependency Graph Viz + Notification UX)

**Bạn là Agent C (frontend specialist)** trong đội DevFlow (React 19 + TypeScript + Vite + Tailwind v4 + i18next).
Branch prefix: `feat/frontend-sprint22-ui`.
**QUAN TRỌNG:** KHÔNG đụng file Agent A (backend task/comment handlers), Agent B (backend notifications/outbox), Agent D (Search, TeamReport). Chỉ làm frontend.

---

## BỐI CẢNH
Frontend đã có các page hoàn chỉnh (Board, Dashboard, Epics, Reports, Notifications, Templates...). Các gap cần xử lý trong Sprint 22:
1. **EpicsPage** chỉ hiển thị danh sách epic — thiếu progress bar, completion %, timeline visualization.
2. **Dependency graph** (GraphModal) hiển thị dạng danh sách — không phải DAG visualization.
3. **NotificationsPanel/NotificationsPage** thiếu "mark all read" và cleanup/archive.

---

## C22.1 — Epic Progress Visualization

### File chính
- `frontend/src/pages/EpicsPage.tsx`
- `frontend/src/components/epic/` (xem có component nào sẵn không)
- Backend epic endpoint: kiểm tra `EpicsController` trả về gì (có `taskCount`/`completedCount`/`progress` không).

### Yêu cầu
1. Mỗi epic trong danh sách hiển thị:
   - **Progress bar** (completion % = done tasks / total tasks).
   - **Completion badge** (vd "3/8 tasks" hoặc "38%").
   - **Deadline indicator** nếu epic có due date (sắp hết hạn → warning color).
2. Nếu backend **không trả về** task counts, xem `EpicResponse` — nếu thiếu, thêm field (backend change cho phép vì Agent A không đụng epic). Ưu tiên dùng field sẵn có trước, chỉ thêm backend nếu thực sự cần.
3. Styling theo design system hiện tại (xem `BoardPage.tsx` hoặc `DashboardPage.tsx` cho pattern badge/progress).

### i18n
- en: `epic.progress` ("Progress"), `epic.tasksDone` ("{{done}}/{{total}} tasks"), `epic.dueSoon` ("Due soon").
- vi: `epic.progress` ("Tiến độ"), `epic.tasksDone` ("{{done}}/{{total}} tasks"), `epic.dueSoon` ("Sắp hết hạn").

---

## C22.2 — Dependency Graph DAG Visualization

### File chính
- `frontend/src/components/board/GraphModal.tsx` (hiện tại hiển thị list)

### Yêu cầu
1. Hiển thị dependency dạng **DAG (directed acyclic graph)** thay vì list thuần:
   - Node = task (title + status color).
   - Edge = blocker → blocked (mũi tên).
   - **Lưu ý:** backend `GET .../dependencies/graph` trả `ProjectDependencyGraphResponse` — kiểm tra shape. Nếu nó trả đủ nodes+edges, dùng ngay.
2. Nếu không có thư viện graph sẵn (react-flow/svg), **dùng SVG tự vẽ** đơn giản (không thêm dependency nặng):
   - Layout theo level (BFS từ root) → vẽ node hình chữ nhật + mũi tên SVG.
   - Scrollable container nếu graph lớn.
   - Click node → mở task detail.
3. Giữ nguyên chức năng hiện có (tạo/remove dependency).

---

## C22.3 — Notification UX: Mark All Read + Cleanup

### File chính
- `frontend/src/components/notifications/NotificationsPanel.tsx`
- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/hooks/useNotifications.ts` (xem có sẵn mark-read logic không)
- Backend: `NotificationsController` — kiểm tra endpoint mark-read đã có chưa.

### Yêu cầu
1. **Mark all read:** nút "Mark all read" trong NotificationsPanel + NotificationsPage. Gọi endpoint `POST .../notifications/read-all` (tạo backend nếu chưa có — Agent B KHÔNG làm phần này).
2. **Clear/cleanup:** nút "Clear read" hoặc "Clear all" gọi cleanup endpoint (`POST /notifications/cleanup` — Agent B sẽ tạo). Nếu backend chưa có, gọi và bắt lỗi gracefully.
3. **Empty state:** khi đã đọc hết → hiển thị "All caught up!" state (icon + text).
4. **Filter tabs** (nếu chưa có): All / Unread / Mentions / Assignments.

---

## 🧪 QUALITY GATES (bắt buộc)
1. Frontend: `npm run build` xanh.
2. Commit: `feat: epic progress + dependency graph viz + notification UX (C22.1-3)`
3. Tạo PR:
   ```bash
   git checkout main && git pull
   git checkout -b feat/frontend-sprint22-ui
   git add .
   git commit -m "feat: epic progress + dependency graph viz + notification UX (C22.1-3)"
   git push origin feat/frontend-sprint22-ui
   gh pr create --base main --head feat/frontend-sprint22-ui --title "feat: Sprint 22 epic progress, dependency graph, notification UX (Agent C)" --body "C22.1: epic progress bar. C22.2: DAG dependency visualization. C22.3: mark-all-read + cleanup UI."
   ```
4. **KHÔNG đụng** file Agent A (backend task/comment handlers), Agent B (backend notifications/outbox), Agent D (Search, TeamReport).

> ⚠️ Nếu backend endpoint cho read-all/cleanup chưa tồn tại, hãy tạo nó trong cùng PR (bạn có quyền làm backend cho UI feature của mình) — nhưng KHÔNG đụng code Agent B.
