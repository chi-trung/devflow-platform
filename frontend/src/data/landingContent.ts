// Content for the landing page sections that the footer/nav points at:
// #pricing, #docs, #community, #help.
//
// Long-form copy lives here with en/vi pairs (validated by
// marketing-data.test.ts), the same way changelog.ts and blog.ts do it; the
// page components pick text by locale. Hrefs stay in site.ts so every public
// page points at the same real destinations.
//
// Everything below must describe what the product actually does today. The
// hosted instance is free, the API base is reachable, Swagger is enabled in
// every environment, and export/import exist; nothing here promises more.

import type { Localized } from "./changelog";

export const PRICING = {
  planName: { en: "Everything, free", vi: "Toàn bộ, miễn phí" } as Localized,
  price: { en: "$0", vi: "0đ" } as Localized,
  period: {
    en: "Free during public beta",
    vi: "Miễn phí trong giai đoạn beta công khai",
  } as Localized,
  blurb: {
    en: "The hosted instance is free to use — no credit card, no seat minimum, no locked features. It runs on shared infrastructure, so cold starts can occur after idle periods; the landing page pings the API to warm it.",
    vi: "Instance công khai miễn phí — không cần thẻ, không giới hạn ghế, không khóa tính năng. Nó chạy trên hạ tầng dùng chung nên có thể khởi động chậm sau thời gian ít truy cập; trang chủ tự ping API để làm ấm.",
  } as Localized,
  bullets: [
    {
      en: "Unlimited workspaces, projects and tasks",
      vi: "Không giới hạn workspace, dự án và task",
    },
    {
      en: "AI planner drafting steps, subtasks and acceptance criteria in each task",
      vi: "AI lập kế hoạch soạn các bước, subtask và tiêu chí nghiệm thu trong từng task",
    },
    {
      en: "Knowledge base, sprints, burndown and velocity reports",
      vi: "Knowledge base, sprint, báo cáo burndown và velocity",
    },
    {
      en: "GitHub integration, webhooks, personal access tokens",
      vi: "Tích hợp GitHub, webhook, personal access token",
    },
    {
      en: "CSV/JSON export of any project, plus full backup",
      vi: "Xuất CSV/JSON mọi dự án, kèm bản backup đầy đủ",
    },
  ] as Localized[],
  note: {
    en: "One plan today. If paid options are added later, usage under these terms stays free.",
    vi: "Hiện tại chỉ có một gói. Nếu sau này có thêm gói trả phí, mức dùng theo điều khoản này vẫn miễn phí.",
  } as Localized,
};

export interface DocCard {
  title: Localized;
  desc: Localized;
  cta: Localized;
  /** App route ("/settings"), section anchor ("#x") or absolute URL. */
  href: string;
  /** True when href leaves the site (Swagger). */
  external?: boolean;
  /** Optional inline code sample rendered in a mono box. */
  code?: string;
}

export const DOCS_CARDS: DocCard[] = [
  {
    title: { en: "Interactive API reference", vi: "Tài liệu API tương tác" },
    desc: {
      en: "Every endpoint is documented by the running API itself: open Swagger, pick an auth scheme, and call endpoints against the live backend.",
      vi: "Mọi endpoint được chính API đang chạy tài liệu hóa: mở Swagger, chọn scheme xác thực và gọi endpoint ngay trên backend thật.",
    },
    cta: { en: "Open Swagger UI", vi: "Mở Swagger UI" },
    href: "swagger",
    external: true,
  },
  {
    title: { en: "Personal access tokens", vi: "Personal access token" },
    desc: {
      en: "Create df_ tokens in Settings with explicit scopes (read, write, tasks, admin). We store only the hash; lose the plaintext and you create a new one.",
      vi: "Tạo token df_ trong Settings với scope rõ ràng (read, write, tasks, admin). Chúng tôi chỉ lưu hash; mất bản gốc thì phải tạo token mới.",
    },
    cta: { en: "Go to Settings", vi: "Tới Settings" },
    href: "/settings",
    // ${apiBase} is substituted at render time from lib/api's API_BASE so the
    // sample always matches the environment the page runs in.
    code: `curl -H "Authorization: Bearer df_..." \\
  \${apiBase}/api/v1/workspaces`,
  },
  {
    title: { en: "Export and import", vi: "Xuất và nhập dữ liệu" },
    desc: {
      en: "Reports export tasks as CSV and the board imports a CSV task list. The backup endpoints take a full JSON snapshot of a project and read it back, so scripted round-trips work without the UI.",
      vi: "Reports xuất task dạng CSV và board import ngược lại một danh sách task CSV. Các endpoint backup lấy snapshot JSON đầy đủ của dự án và đọc trả lại được, nên round-trip bằng script chạy không cần UI.",
    },
    cta: { en: "Backup endpoints in Swagger", vi: "Endpoint backup trong Swagger" },
    href: "swagger",
    external: true,
  },
  {
    title: { en: "GitHub integration", vi: "Tích hợp GitHub" },
    desc: {
      en: "Connect an account, list repositories, and install webhooks from the project's GitHub page. Task keys in branch names and PR titles tie repos to the board automatically.",
      vi: "Kết nối tài khoản, liệt kê repository và cài webhook từ trang GitHub của dự án. Mã task trong tên nhánh và tiêu đề PR gắn repository với board một cách tự động.",
    },
    cta: { en: "Read the blog post", vi: "Đọc bài viết" },
    href: "/blog",
  },
];

export const COMMUNITY_CARDS: DocCard[] = [
  {
    title: { en: "Source code", vi: "Mã nguồn" },
    desc: {
      en: "The whole stack (API, frontend, infra config) is public on GitHub. Read it, fork it, self-host it; issues and pull requests are how the project moves.",
      vi: "Toàn bộ stack (API, frontend, cấu hình hạ tầng) công khai trên GitHub. Đọc, fork, tự host; issue và pull request là cách dự án vận động.",
    },
    cta: { en: "View the repository", vi: "Xem repository" },
    href: "github-repo",
    external: true,
  },
  {
    title: { en: "Bugs and ideas", vi: "Bug và ý tưởng" },
    desc: {
      en: "One place to report problems and request features. Account and data questions are handled there as well — it is the fastest way to reach a maintainer.",
      vi: "Một chỗ duy nhất để báo lỗi và đề xuất tính năng. Câu hỏi về tài khoản và dữ liệu cũng được xử lý ở đó — đó là cách nhanh nhất để liên hệ người bảo trì.",
    },
    cta: { en: "Open an issue", vi: "Mở một issue" },
    href: "github-issues",
    external: true,
  },
  {
    title: { en: "Engineering notes", vi: "Ghi chú kỹ thuật" },
    desc: {
      en: "Short posts about how features actually work, including what they store and what they don't. Written by whoever shipped the code.",
      vi: "Các bài viết ngắn giải thích tính năng vận hành thế nào, gồm cả thứ chúng lưu trữ và thứ không. Viết bởi chính người đã ship code.",
    },
    cta: { en: "Read the blog", vi: "Đọc blog" },
    href: "/blog",
  },
];

export interface Faq {
  q: Localized;
  a: Localized;
}

export const FAQS: Faq[] = [
  {
    q: {
      en: "Is DevFlow really free?",
      vi: "DevFlow có thật sự miễn phí?",
    },
    a: {
      en: "Yes. The hosted instance is free: one plan, no card to register. It runs on shared infrastructure, so cold starts can happen after quiet periods; the landing page pings the API to reduce that.",
      vi: "Đúng vậy. Instance công khai miễn phí: một gói duy nhất, đăng ký không cần thẻ. Nó chạy trên hạ tầng dùng chung nên có thể khởi động chậm sau thời gian ít người dùng; trang chủ ping API để giảm việc đó.",
    },
  },
  {
    q: {
      en: "Where is my data stored?",
      vi: "Dữ liệu của tôi lưu ở đâu?",
    },
    a: {
      en: "Frontend on Vercel, API on Render, Postgres on Supabase. Passwords are BCrypt hashes, personal access tokens are SHA256 hashes, attachments live in the database. Nightly backups are kept for 30 days.",
      vi: "Frontend trên Vercel, API trên Render, Postgres trên Supabase. Mật khẩu là bcrypt hash, personal access token là SHA256 hash, tệp đính kèm nằm trong database. Bản sao lưu chạy mỗi đêm, giữ 30 ngày.",
    },
  },
  {
    q: {
      en: "Which AI model does the agent use?",
      vi: "AI agent dùng model nào?",
    },
    a: {
      en: "The integration is provider-agnostic; the hosted deployment currently uses Google Gemini (gemini-2.5-flash) over Google's API. API keys live in server environment variables only, and prompts aren't used for training.",
      vi: "Việc tích hợp không phụ thuộc nhà cung cấp; bản triển khai công khai hiện dùng Google Gemini (gemini-2.5-flash) qua API của Google. API key chỉ nằm trong biến môi trường phía server, và prompt không dùng để huấn luyện.",
    },
  },
  {
    q: {
      en: "I forgot my password. Now what?",
      vi: "Tôi quên mật khẩu thì sao?",
    },
    a: {
      en: "Password reset by email is not available yet. While signed in you can change your password in Profile; Google/GitHub-linked accounts can sign in that way. Otherwise open a GitHub issue and the maintainers will help.",
      vi: "Đặt lại mật khẩu qua email chưa khả dụng. Khi còn đăng nhập, bạn có thể đổi mật khẩu trong Profile; tài khoản đã liên kết Google/GitHub có thể đăng nhập bằng cách đó. Nếu không, hãy mở một issue trên GitHub và người bảo trì sẽ giúp.",
    },
  },
  {
    q: {
      en: "Can I take my work with me?",
      vi: "Tôi có thể mang theo dữ liệu khi rời đi?",
    },
    a: {
      en: "Yes. Tasks export to CSV from Reports, and every project exports as a JSON backup that imports back into DevFlow. The endpoints are in Swagger, so a script can pull your data without the UI.",
      vi: "Có. Task xuất ra CSV từ Reports, và mọi dự án xuất được bản backup JSON import ngược lại vào DevFlow. Các endpoint nằm trong Swagger, nên một script có thể kéo dữ liệu đi mà không cần UI.",
    },
  },
  {
    q: {
      en: "How do I delete my account?",
      vi: "Làm sao để xóa tài khoản?",
    },
    a: {
      en: "Project and workspace deletion is in-app. Full account deletion needs a maintainer for now — open a GitHub issue and we remove the account, including from backups after the 30-day window.",
      vi: "Xóa dự án và workspace thực hiện trong app. Xóa trọn tài khoản hiện cần người bảo trì — hãy mở một issue trên GitHub và chúng tôi sẽ xóa tài khoản, kể cả khỏi các bản sao lưu sau cửa sổ giữ 30 ngày.",
    },
  },
];

export function isValidLandingContent(): boolean {
  const nonEmpty = (l: Localized) =>
    l.en.trim() !== "" && l.vi.trim() !== "";
  const cardValid = (c: DocCard) =>
    nonEmpty(c.title) && nonEmpty(c.desc) && nonEmpty(c.cta) && c.href !== "";
  return (
    nonEmpty(PRICING.planName) &&
    nonEmpty(PRICING.price) &&
    nonEmpty(PRICING.period) &&
    nonEmpty(PRICING.blurb) &&
    nonEmpty(PRICING.note) &&
    PRICING.bullets.every(nonEmpty) &&
    DOCS_CARDS.every(cardValid) &&
    COMMUNITY_CARDS.every(cardValid) &&
    FAQS.every((f) => nonEmpty(f.q) && nonEmpty(f.a))
  );
}
