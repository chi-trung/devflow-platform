// Public changelog + roadmap data, rendered by ChangelogPage.
//
// Text lives here (not in the i18n catalogs) because content entries evolve
// independently of UI chrome: every string carries its `en` and `vi` forms
// side by side, which is the parity guarantee. Page chrome (headings, badges)
// still goes through t() with keys in en.json/vi.json — those are covered by
// the i18n-parity / i18n-usage tests.
//
// Seed entries are taken from real git history; add a new entry per release,
// newest first.

export interface Localized {
  en: string;
  vi: string;
}

export type ChangeCategory = "added" | "improved" | "fixed" | "removed";

export interface ChangelogEntry {
  version: string;
  /** ISO date "yyyy-mm-dd", formatted per locale at render time. */
  date: string;
  title: Localized;
  /** Grouped by category; omit a category if the release has none. */
  changes: Partial<Record<ChangeCategory, Localized[]>>;
}

export type RoadmapStatus = "planned" | "inProgress";

export interface RoadmapItem {
  title: Localized;
  status: RoadmapStatus;
  /** Locale-neutral display string, e.g. "Q4 2026". Optional. */
  eta?: string;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "v1.3",
    date: "2026-09-05",
    title: { en: "Intelligence & hardening", vi: "Thông minh & vững vàng" },
    changes: {
      added: [
        {
          en: "Personal access tokens — df_ tokens authenticate API calls end-to-end",
          vi: "Personal access token — token df_ xác thực API calls trọn vẹn",
        },
        {
          en: "Automated nightly database backups with 30-day retention",
          vi: "Tự động sao lưu database mỗi đêm, giữ 30 ngày",
        },
      ],
      improved: [
        {
          en: "UI polish across Reports, Knowledge, Epics and Notifications",
          vi: "Tinh chỉnh giao diện cho Reports, Knowledge, Epics và Notifications",
        },
        {
          en: "Drift warnings and supersede dropdown for knowledge entries",
          vi: "Cảnh báo drift và dropdown thay thế cho knowledge entries",
        },
      ],
      fixed: [
        {
          en: "API response types aligned with the backend contract (blocked state, pagination fields)",
          vi: "Đồng bộ API response types với backend (blocked state, các trường phân trang)",
        },
      ],
    },
  },
  {
    version: "v1.2",
    date: "2026-08-26",
    title: { en: "AI & knowledge", vi: "AI & tri thức" },
    changes: {
      added: [
        {
          en: "AI agent — real LLM planning with knowledge-gated prompts and per-project self-approval",
          vi: "AI agent — lập kế hoạch LLM thật, prompt dựa trên knowledge, tự phê duyệt theo dự án",
        },
        {
          en: "Knowledge base — ADR / Pattern / Runbook entries with lifecycle and auto-capture when tasks ship",
          vi: "Knowledge base — mục ADR / Pattern / Runbook có vòng đời, tự thu thập khi task ship",
        },
        {
          en: "Board swimlanes — group cards by assignee or epic",
          vi: "Swimlane cho board — gom thẻ theo assignee hoặc epic",
        },
        {
          en: "Epic-to-epic dependencies and project-level RBAC guard",
          vi: "Phụ thuộc epic-to-epic và phân quyền RBAC cấp dự án",
        },
      ],
    },
  },
  {
    version: "v1.1",
    date: "2026-08-24",
    title: { en: "Collaboration & access", vi: "Cộng tác & truy cập" },
    changes: {
      added: [
        {
          en: "Google sign-in (Authorization Code + PKCE)",
          vi: "Đăng nhập Google (Authorization Code + PKCE)",
        },
        {
          en: "Cross-project My Tasks page",
          vi: "Trang My Tasks gộp việc xuyên dự án",
        },
        {
          en: "Saved searches and notification preferences (in-app + email)",
          vi: "Lưu tìm kiếm và tùy chọn thông báo (in-app + email)",
        },
        {
          en: "Webhook test-fire and full project import/export (JSON + Excel)",
          vi: "Test webhook và import/export nguyên dự án (JSON + Excel)",
        },
      ],
    },
  },
  {
    version: "v1.0",
    date: "2026-08-22",
    title: { en: "The core", vi: "Nền tảng cốt lõi" },
    changes: {
      added: [
        {
          en: "Clean Architecture + CQRS API with JWT auth and rotating refresh tokens",
          vi: "API Clean Architecture + CQRS với JWT auth và refresh token xoay vòng",
        },
        {
          en: "Kanban board with realtime updates (SignalR), comments, watchers and attachments",
          vi: "Kanban board cập nhật realtime (SignalR), bình luận, người theo dõi và đính kèm",
        },
        {
          en: "Sprints with drag-and-drop planning, burndown, velocity and team reports",
          vi: "Sprint với kế hoạch kéo-thả, burndown, velocity và báo cáo đội nhóm",
        },
        {
          en: "Labels, custom fields, task templates, bulk operations and advanced search",
          vi: "Labels, custom fields, task template, thao tác hàng loạt và tìm kiếm nâng cao",
        },
        {
          en: "Webhooks, email notifications and PWA support",
          vi: "Webhook, thông báo email và hỗ trợ PWA",
        },
      ],
    },
  },
];

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    title: { en: "GitHub sign-in alongside Google", vi: "Đăng nhập GitHub song song với Google" },
    status: "planned",
  },
  {
    title: { en: "Recurring tasks and automation rules", vi: "Task lặp lại và quy tắc tự động hóa" },
    status: "planned",
  },
  {
    title: { en: "Deeper AI agent capabilities", vi: "AI agent mạnh hơn" },
    status: "inProgress",
  },
  {
    title: {
      en: "Native-feel mobile experience on top of the existing PWA",
      vi: "Trải nghiệm mobile như native trên nền PWA hiện có",
    },
    status: "planned",
  },
];

export function isValidChangelogData(): boolean {
  const entriesValid = CHANGELOG_ENTRIES.every(
    (entry) =>
      /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
      entry.title.en.trim() !== "" &&
      entry.title.vi.trim() !== "" &&
      Object.values(entry.changes).every(
        (items) =>
          items !== undefined &&
          items.length > 0 &&
          items.every((item) => item.en.trim() !== "" && item.vi.trim() !== ""),
      ),
  );
  const roadmapValid = ROADMAP_ITEMS.every(
    (item) => item.title.en.trim() !== "" && item.title.vi.trim() !== "",
  );
  return entriesValid && roadmapValid;
}
