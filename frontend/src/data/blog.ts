// Public engineering notes for /blog, rendered by BlogPage.
//
// Same rules as changelog.ts: content lives here (not the i18n catalogs)
// with every string carrying its en and vi forms side by side, validated by
// marketing-data.test.ts. Posts must describe things that actually shipped —
// dates match real commits, and nothing promises features that don't exist.

import type { Localized } from "./changelog";

export interface BlogPost {
  /** URL slug, also used as React key. Must stay stable once published. */
  slug: string;
  date: string; // ISO "yyyy-mm-dd"
  title: Localized;
  /** Rendered as <p> blocks in order. */
  body: Localized[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "task-keys-and-commit-links",
    date: "2026-09-09",
    title: {
      en: "Task keys and automatic commit links",
      vi: "Mã task và liên kết commit tự động",
    },
    body: [
      {
        en: "A board card with no stable id is hard to cite. Tasks in DevFlow now carry per-project keys like DEV-123, minted from a counter. The first implementation collided under parallel creates (Postgres unique violation 23505), so key allocation now retries on conflict, and a backfill migration gave keys to every row that existed before the feature.",
        vi: "Một thẻ trên board không có id ổn định thì rất khó dẫn chiếu. Các task trong DevFlow giờ mang mã theo từng dự án, dạng DEV-123, được cấp từ một bộ đếm. Bản cài đặt đầu tiên xung đột khi tạo song song (lỗi unique 23505 của Postgres), nên việc cấp mã giờ thử lại khi xung đột, và một migration backfill đã cấp mã cho mọi dòng có trước tính năng này.",
      },
      {
        en: "The key is the join to GitHub. A commit message or pull request title containing DEV-123 links itself to that task: PRs show up on the card, the create-branch button opens GitHub with the key in the branch name, and webhook events keep task status in sync with the repo.",
        vi: "Mã chính là điểm nối với GitHub. Một commit message hoặc tiêu đề pull request chứa DEV-123 sẽ tự liên kết với task đó: PR hiển thị trên thẻ, nút tạo nhánh mở GitHub với mã nằm trong tên nhánh, và các webhook giữ trạng thái task đồng bộ với repository.",
      },
      {
        en: "The point is an audit trail you don't have to maintain: repository history traces back to the work item without anyone pasting links by hand.",
        vi: "Mục tiêu là một vết kiểm toán không cần ai chăm: lịch sử repository truy ngược về công việc mà không ai phải dán liên kết thủ công.",
      },
    ],
  },
  {
    slug: "pr-state-on-the-board",
    date: "2026-09-09",
    title: {
      en: "PR badges and a pr: filter on the board",
      vi: "Nhãn PR và bộ lọc pr: trên board",
    },
    body: [
      {
        en: "Open a pull request against a branch that matches a task key and the card now carries the PR state: open, merged, or closed, with counts when a task has several. The summary rides along with the task list response, so it renders with the board and updates live on webhook events.",
        vi: "Mở một pull request trên nhánh khớp mã task và thẻ bài sẽ hiển thị trạng thái PR: đang mở, đã merge hoặc đã đóng, kèm số lượng khi một task có nhiều PR. Bản tóm tắt đi cùng response danh sách task nên hiển thị ngay khi board tải lên và cập nhật trực tiếp khi có webhook.",
      },
      {
        en: "The board search gained a pr: operator beside assignee:, label: and is:blocked. Typing pr:open narrows the column to work waiting on review; pr:none finds tasks with no linked pull request at all.",
        vi: "Ô tìm kiếm trên board có thêm toán tử pr: bên cạnh assignee:, label: và is:blocked. Gõ pr:open thu cột về những việc đang chờ review; pr:none tìm các task chưa liên kết pull request nào.",
      },
    ],
  },
  {
    slug: "github-sign-in",
    date: "2026-09-08",
    title: {
      en: "GitHub sign-in, and what it means for tokens",
      vi: "Đăng nhập bằng GitHub và ý nghĩa với token",
    },
    body: [
      {
        en: "DevFlow added GitHub as a second OAuth provider next to Google. A social login row binds the provider's stable subject id to your account, so the same GitHub identity keeps landing on the same workspace no matter which button you press first.",
        vi: "DevFlow thêm GitHub làm OAuth provider thứ hai bên cạnh Google. Một bản ghi social login gắn subject id ổn định của provider với tài khoản của bạn, nên cùng một danh tính GitHub luôn đưa về đúng workspace bất kể bạn bấm nút nào trước.",
      },
      {
        en: "The difference is what we keep: Google sign-in stores only the identity, and its access token is discarded after sign-in. GitHub sign-in stores the access token, because listing your repositories and checking webhook permissions needs to call GitHub as you. That token is refreshed on each sign-in and is used for nothing else.",
        vi: "Khác biệt nằm ở thứ được lưu lại: đăng nhập Google chỉ lưu danh tính, còn access token bị vứt sau khi đăng nhập. Đăng nhập GitHub lưu access token, vì việc liệt kê repository và kiểm tra quyền webhook phải gọi GitHub với danh tính của bạn. Token đó được làm mới mỗi lần đăng nhập và không dùng vào việc gì khác.",
      },
    ],
  },
];

export function isValidBlogData(): boolean {
  const slugs = new Set<string>();
  return BLOG_POSTS.every((post) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return false;
    if (post.title.en.trim() === "" || post.title.vi.trim() === "") return false;
    if (post.body.length === 0) return false;
    if (slugs.has(post.slug)) return false;
    slugs.add(post.slug);
    return post.body.every((p) => p.en.trim() !== "" && p.vi.trim() !== "");
  });
}
