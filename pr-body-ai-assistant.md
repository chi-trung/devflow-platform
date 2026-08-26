## Tóm tắt

Floating AI Assistant: nút ✨ nổi ở góc dưới phải, mở panel chat. AI hiểu ngữ cảnh (board/sprints/epics/workspace) và thực thi hành động thật — tạo task, sprint, epic, project, workspace; set deadline, priority; assign; chuyển task vào sprint.

## Backend

- **IAiClient.ExecuteActionAsync** + impl ở Gemini (maxTokens 1000, timeout 30s), OpenAi, NoOp
- **AiExecuteContract** + **AiExecuteCommand** + **AiExecuteCommandHandler** — dispatcher: gọi LLM → parse JSON → dispatch sang command có sẵn, mỗi action bắt lỗi riêng
- **AiAssistantController**: `POST /api/v1/workspaces/{workspaceId}/ai/execute?projectId=...` (projectId optional)
- 11 action types; AI tự resolve tên → project/sprint/assignee thật trong workspace

## Frontend

- **AiFloatingButton** — nút ✨ fixed bottom-right, glow ping
- **AiAssistantPanel** — panel chat + input + spinner "Đang suy nghĩ…"
- **AiSuggestedPrompts** — chip gợi ý prompt theo từng trang
- **AiActionResults** — ✓/✗/⏭ từng action + summary
- Mount trong AppShell khi có workspaceId; i18n en + vi đầy đủ

## Verification

- dotnet build: 0 lỗi, 0 warning
- dotnet test: 378 unit + 2 integration pass
- npm run build: TS strict pass
- npm test: 30/30 pass (i18n parity pass)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
