# 🚀 Sprint 25 — Prompt cho Agent C (Frontend: Fix Presence + Role-aware UI)

**Branch:** `feat/frontend-sprint25-role-presence` (tạo mới từ `main`)

---

## Bối cảnh

Hai vấn đề cần xử lý:
1. **Presence avatars không hoạt động** do 2 bug trong code bạn viết ở PR #108:
   - `usePresence` đọc selfId từ `localStorage.getItem("devflow.currentUser")` nhưng **KHÔNG có nơi nào ghi key đó** → self-join bị lọc nhầm.
   - (Server bug — Agent B sẽ fix B25.1) ProjectHub chưa broadcast `user-joined`/`user-left`.
2. **UI không phân biệt role:** sau Sprint 25 RBAC hardening, một số op (import/export backup, delete epic) yêu cầu **Admin**. Nhưng frontend vẫn hiện nút cho mọi member → user bấm sẽ nhận 403.

## 🎯 Nhiệm vụ

### C25.1: Fix `usePresence` — đọc selfId từ AuthContext

`frontend/src/hooks/usePresence.ts` hiện đang:

```ts
const raw = localStorage.getItem("devflow.currentUser");
if (raw) {
  const parsed = JSON.parse(raw);
  selfId = parsed?.id ?? parsed?.userId ?? null;
}
```

**Sửa thành:** nhận `currentUserId` như tham số từ hook, hoặc đọc từ `useAuth()` bên trong hook. AuthContext đã export `currentUser.id` (là `claims.sub`). 

Cách sửa sạch nhất: **thêm tham số `currentUserId: string | null`** vào `usePresence` và truyền `currentUser?.id ?? null` từ `BoardPage` (BoardPage đã có sẵn `useAuth()`). Bỏ hoàn toàn `localStorage` lookup.

Signature mới:
```ts
export function usePresence(
  projectId: string | undefined,
  members: WorkspaceMemberResponse[] = [],
  currentUserId?: string | null,
)
```

### C25.2: Role-aware UI — ẩn hành động Admin với Member

`BoardPage.tsx` đã có:
```ts
const { currentUser } = useAuth();
const myRole = members?.find((m) => m.userId === currentUser?.id)?.role;
```
`myRole` có thể là `"Owner" | "Admin" | "Member"` (hoặc undefined). `isAdmin = myRole === "Admin" || myRole === "Owner"`.

Sau Sprint 25 RBAC, các op sau **cần Admin** (mọi member khác sẽ bị 403):
- **Import backup** (`ImportTasksModal` — mở bằng nút trong BoardPage toolbar)
- **Export backup full** (`ExportImportModal` — full project backup, không phải export task CSV)
- **Delete epic** (`EpicsPage` delete button)

**Yêu cầu:**
- Trong `ImportTasksModal` / `ExportImportModal` / `EpicsPage`: nếu `!isAdmin`, **ẩn hoặc disable** nút import/export/delete kèm tooltip "Admin only".
- Trong `BoardPage` toolbar: nút mở `ImportTasksModal` chỉ hiện khi `isAdmin`.
- Thêm i18n keys mới vào `en.json` + `vi.json`: `adminOnly` ("Admin only" / "Chỉ quản trị viên"), `adminOnlyHint` (tooltip giải thích).

> **Gợi ý clean:** tạo một helper hook `useWorkspaceRole()` (wrap `useAuth` + member lookup) hoặc prop-drill `isAdmin` từ BoardPage xuống modal. Tránh gọi API members 2 lần — modal có thể nhận `isAdmin` như prop.

### C25.3 (nhẹ): Comment skeleton + tab title — verify hoạt động

PR #108 của bạn thêm comment skeleton + `document.title` = project name. Sprint này chỉ cần **verify không regression** (build pass, không crash khi chuyển project). Nếu có bug nhỏ thì fix.

## ✅ Quality Gates

- `npm run build` pass (TypeScript strict).
- KHÔNG sửa file lock: `Program.cs`, `api.ts`, `AuthContext.tsx` (trừ khi bạn cần export thứ gì — nếu vậy báo Agent A trước).
- Không sửa `usePresence` logic server-side (đó là Agent B).
- Push lên branch `feat/frontend-sprint25-role-presence`, mở PR, tag **Agent A** review.

## ⚠️ Lưu ý

- `BoardPage` đã import `useAuth` và `currentUser` — dùng sẵn, đừng tạo thêm.
- i18n: luôn thêm vào cả `en.json` và `vi.json`.
- Đừng ẩn nút một cách mù quáng — chỉ ẩn đúng op yêu cầu Admin (import/export backup/delete epic). Các op Member vẫn phải hiện.
