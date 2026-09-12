// Legal page content for /privacy and /terms, rendered by PrivacyPage and
// TermsPage.
//
// Same rules as blog.ts: localized pairs live here, not in the i18n catalogs,
// validated by marketing-data.test.ts. Every claim must match what the code
// actually does (auth, storage, export, hosting, backups) — no boilerplate
// promises about things DevFlow doesn't offer.

import type { Localized } from "./changelog";

export interface LegalSection {
  heading: Localized;
  /** Rendered as <p> blocks in order. Bullet lists are plain sentences here. */
  paragraphs: Localized[];
}

/** ISO date "yyyy-mm-dd" shown as "Last updated" on both legal pages. */
export const LEGAL_UPDATED = "2026-09-12";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: { en: "What we collect", vi: "Chúng tôi thu thập gì" },
    paragraphs: [
      {
        en: "Account data: your email, username, and display name, plus a BCrypt password hash if you register with a password. If you sign in with Google or GitHub, we store the provider's stable user id and profile email so the login can find your account again.",
        vi: "Dữ liệu tài khoản: email, tên đăng nhập và tên hiển thị, kèm một bcrypt password hash nếu bạn đăng ký bằng mật khẩu. Nếu bạn đăng nhập bằng Google hoặc GitHub, chúng tôi lưu user id ổn định của provider cùng email hồ sơ để lần sau đăng nhập tìm lại được tài khoản.",
      },
      {
        en: "Work data: everything you create while using the product: workspaces, projects, tasks, comments, labels, sprints, knowledge entries, and file attachments (stored in the database). We also keep an activity log of changes made through the app.",
        vi: "Dữ liệu công việc: mọi thứ bạn tạo khi dùng sản phẩm: workspace, dự án, task, bình luận, nhãn, sprint, mục tri thức và tệp đính kèm (lưu trong database). Chúng tôi cũng giữ nhật ký hoạt động cho các thay đổi thực hiện qua app.",
      },
      {
        en: "GitHub sign-in stores the OAuth access token for your account because listing your repositories and setting up webhooks requires calling GitHub as you. Google sign-in stores only identity; its token is discarded after sign-in.",
        vi: "Đăng nhập GitHub lưu access token OAuth cho tài khoản của bạn vì việc liệt kê repository và thiết lập webhook phải gọi GitHub với danh tính của bạn. Đăng nhập Google chỉ lưu danh tính; token của nó bị loại bỏ sau khi đăng nhập.",
      },
    ],
  },
  {
    heading: { en: "How we use it", vi: "Chúng tôi dùng dữ liệu thế nào" },
    paragraphs: [
      {
        en: "To run the product: authentication, realtime board updates, notifications, search, and the AI agent that plans work inside your projects. That is the whole list.",
        vi: "Để vận hành sản phẩm: xác thực, cập nhật board realtime, thông báo, tìm kiếm và AI agent lập kế hoạch công việc trong dự án của bạn. Đó là toàn bộ danh sách.",
      },
      {
        en: "Sessions work with JWT access and refresh tokens kept in your browser's localStorage. Personal access tokens (df_...) are stored only as SHA256 hashes on our side; you keep the plaintext.",
        vi: "Phiên đăng nhập dùng JWT access và refresh token lưu trong localStorage của trình duyệt. Personal access token (df_...) phía chúng tôi chỉ tồn tại dưới dạng SHA256 hash; bạn giữ bản gốc.",
      },
      {
        en: "There are no third-party analytics or advertising trackers on this site.",
        vi: "Trang này không có công cụ phân tích bên thứ ba hay mã quảng cáo nào.",
      },
    ],
  },
  {
    heading: { en: "AI processing", vi: "Xử lý bởi AI" },
    paragraphs: [
      {
        en: "The AI agent sends task and project context to whichever language model the deployment configures. The hosted instance defaults to Google's Gemini (gemini-2.5-flash) called over Google's API. Provider API keys live in server environment variables, never in your browser, and prompts are not used to train models.",
        vi: "AI agent gửi ngữ cảnh task và dự án tới model ngôn ngữ mà bản triển khai cấu hình. Instance công khai mặc định dùng Google Gemini (gemini-2.5-flash) gọi qua API của Google. API key của provider nằm trong biến môi trường phía server, không bao giờ ở trình duyệt, và prompt không dùng để huấn luyện model.",
      },
    ],
  },
  {
    heading: { en: "Where data lives", vi: "Dữ liệu nằm ở đâu" },
    paragraphs: [
      {
        en: "The frontend is served by Vercel, the API and its Postgres database by Render. Nightly automated database backups are kept for 30 days. If you need your region or hosting details to match a policy, open an issue on the GitHub repository and ask.",
        vi: "Frontend được phục vụ bởi Vercel, còn API và database Postgres bởi Render. Bản sao lưu database tự động chạy mỗi đêm và giữ trong 30 ngày. Nếu chính sách của bạn cần biết vùng địa lý hay nhà lưu trữ, hãy mở một issue trên repository GitHub và hỏi.",
      },
    ],
  },
  {
    heading: { en: "Sharing", vi: "Chia sẻ dữ liệu" },
    paragraphs: [
      {
        en: "We do not sell personal data and do not share it with anyone beyond the hosting providers named above, who process it to keep the service running. GitHub only ever sees requests made with your own stored token, scoped to what the integration needs.",
        vi: "Chúng tôi không bán dữ liệu cá nhân và không chia sẻ với ai ngoài các nhà lưu trữ kể trên, những bên xử lý dữ liệu để dịch vụ chạy. GitHub chỉ nhận các request thực hiện bằng token của chính bạn, trong phạm vi tích hợp cần.",
      },
    ],
  },
  {
    heading: { en: "Deletion", vi: "Xóa dữ liệu" },
    paragraphs: [
      {
        en: "You can delete workspaces and projects from Settings, which removes them from the product. Task rows removed this way are soft-deleted: they disappear from every view but stay in the database until a purge. There is no self-service button to delete an entire account yet; open a GitHub issue and the maintainers will do it, including removal from backups after their 30-day window.",
        vi: "Bạn có thể xóa workspace và dự án trong Settings; thao tác này loại chúng khỏi sản phẩm. Dòng task xóa theo cách này là soft-delete: biến mất khỏi mọi màn hình nhưng còn trong database cho tới khi bị purge. Chưa có nút tự xóa trọn vẹn tài khoản; hãy mở một issue trên GitHub và người bảo trì sẽ làm, kể cả việc loại khỏi các bản sao lưu sau cửa sổ 30 ngày.",
      },
    ],
  },
  {
    heading: { en: "Changes to this policy", vi: "Thay đổi của chính sách" },
    paragraphs: [
      {
        en: "This page is updated in the repository like everything else, and the date at the top reflects the last change. Continued use after an update means the update applies to you.",
        vi: "Trang này được cập nhật trong repository như mọi thứ khác, và ngày ở đầu trang phản ánh lần thay đổi cuối. Tiếp tục sử dụng sau một cập nhật nghĩa là bản cập nhật áp dụng cho bạn.",
      },
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: { en: "The service", vi: "Dịch vụ" },
    paragraphs: [
      {
        en: "DevFlow is a project management and AI-assisted development workflow tool. The hosted instance is currently free to use. It is maintained by a small team in the open at github.com/chi-trung/devflow-platform, and there is no company entity behind it yet.",
        vi: "DevFlow là công cụ quản lý dự án và quy trình phát triển có AI hỗ trợ. Instance công khai hiện dùng miễn phí. Nó được duy trì bởi một nhóm nhỏ theo hướng mã nguồn mở tại github.com/chi-trung/devflow-platform, và chưa có pháp nhân công ty đứng sau.",
      },
      {
        en: "The free instance runs on hobby-tier infrastructure with no uptime guarantee. Expect occasional cold starts and maintenance windows.",
        vi: "Instance miễn phí chạy trên hạ tầng bậc hobby, không cam kết thời gian hoạt động. Hãy chờ đợi những lần khởi động lạnh và các khoảng bảo trì.",
      },
    ],
  },
  {
    heading: { en: "Your account", vi: "Tài khoản của bạn" },
    paragraphs: [
      {
        en: "You are responsible for activity under your credentials. Keep your password and personal access tokens safe: a df_ token authenticates API calls exactly as you, limited by whatever scopes it was created with.",
        vi: "Bạn chịu trách nhiệm cho mọi hoạt động diễn ra dưới thông tin đăng nhập của mình. Hãy giữ mật khẩu và personal access token an toàn: một token df_ xác thực các API call đúng như chính bạn, trong giới hạn các scope nó được tạo với.",
      },
      {
        en: "Notify the maintainers through a GitHub issue if you believe your account or a token has been compromised so the token can be revoked.",
        vi: "Báo cho người bảo trì qua một issue trên GitHub nếu bạn cho rằng tài khoản hoặc một token đã bị lộ, để token đó có thể bị thu hồi.",
      },
    ],
  },
  {
    heading: { en: "Acceptable use", vi: "Sử dụng hợp lệ" },
    paragraphs: [
      {
        en: "Use DevFlow to organize real work. Do not use it to store or distribute unlawful content, to attack the service or other users, or to route bulk automated traffic beyond what normal API use means. Rate limits and audit trails exist, and abuse can get an account suspended.",
        vi: "Dùng DevFlow để tổ chức công việc thật. Không dùng nó để lưu trữ hay phát tán nội dung phi pháp, tấn công dịch vụ hoặc người dùng khác, hay dẫn luồng tự động hàng loạt vượt quá khuôn khổ dùng API thông thường. Có giới hạn tốc độ và vết kiểm toán, và hành vi lạm dụng có thể khiến tài khoản bị tạm ngưng.",
      },
    ],
  },
  {
    heading: { en: "Your content", vi: "Nội dung của bạn" },
    paragraphs: [
      {
        en: "Workspaces, projects, tasks and attachments you create belong to you. You grant the operators only the hosting and processing rights needed to run the product for you. Project export (CSV for tasks, JSON for full backups) exists so leaving is always possible.",
        vi: "Workspace, dự án, task và tệp đính kèm bạn tạo thuộc về bạn. Bạn cấp cho bên vận hành duy nhất các quyền lưu trữ và xử lý cần thiết để chạy sản phẩm phục vụ bạn. Chức năng xuất dự án (CSV cho task, JSON cho bản backup đầy đủ) tồn tại để việc rời đi luôn khả thi.",
      },
    ],
  },
  {
    heading: { en: "GitHub integration", vi: "Tích hợp GitHub" },
    paragraphs: [
      {
        en: "Connecting a repository lets DevFlow read pull request and branch events through webhooks, and open pull requests on your behalf when you click. The integration uses your stored GitHub token and acts within the permissions that token has; your repository's own permission model still applies.",
        vi: "Kết nối một repository cho phép DevFlow đọc các sự kiện pull request và nhánh qua webhook, và mở pull request thay bạn khi bạn bấm nút. Tích hợp dùng token GitHub đã lưu của bạn và hành động trong phạm vi quyền của token đó; mô hình quyền của repository vẫn áp dụng.",
      },
    ],
  },
  {
    heading: { en: "Disclaimers and liability", vi: "Tuyên bố miễn trừ và trách nhiệm pháp lý" },
    paragraphs: [
      {
        en: "The service is provided as is, without warranty of any kind. AI-generated plans and code are drafts: review them before shipping, exactly as you would a junior engineer's pull request. The maintainers are not liable for data loss or business interruption beyond what applicable law forbids them to disclaim.",
        vi: "Dịch vụ được cung cấp nguyên trạng, không bảo đảm dưới bất kỳ hình thức nào. Kế hoạch và mã do AI tạo ra là bản nháp: hãy review trước khi ship, đúng như bạn review pull request của một kỹ sư mới. Người bảo trì không chịu trách nhiệm cho mất mát dữ liệu hay gián đoạn kinh doanh vượt quá mức luật hiện hành không cho phép miễn trừ.",
      },
    ],
  },
  {
    heading: { en: "Changes to these terms", vi: "Thay đổi của điều khoản" },
    paragraphs: [
      {
        en: "These terms change as the product does; the date at the top marks the last revision. If a change is unacceptable to you, stop using the service and ask for account deletion.",
        vi: "Điều khoản này thay đổi cùng với sản phẩm; ngày ở đầu trang đánh dấu lần sửa cuối. Nếu một thay đổi không thể chấp nhận với bạn, hãy ngừng dùng dịch vụ và yêu cầu xóa tài khoản.",
      },
    ],
  },
];

export function isValidLegalData(): boolean {
  return [...PRIVACY_SECTIONS, ...TERMS_SECTIONS].every(
    (section) =>
      section.heading.en.trim() !== "" &&
      section.heading.vi.trim() !== "" &&
      section.paragraphs.length > 0 &&
      section.paragraphs.every(
        (p) => p.en.trim() !== "" && p.vi.trim() !== "",
      ),
  );
}
