## Tổng quan

Fix 2 vấn đề trên production:
1. **AI assistant trả 500 khi Gemini quá tải / chậm** (503 "high demand" → timeout 30s → 500)
2. **Web vào lần đầu loading rất lâu** (Render free-tier ngủ → cold start 30-60s)

## Thay đổi

**Backend (`src/`):**
- `GeminiAiClient`: retry 429/503 với exponential backoff (tối đa 3 lần/model), sau đó fallback sang model flash khác. Tất cả retry chia sẻ 1 ngân sách timeout (60s plan / 30s execute). Dùng chung 1 luồng gửi cho cả `PlanTaskAsync` và `ExecuteActionAsync`.
- `AiExecuteCommandHandler`: catch `OperationCanceledException` → trả lỗi thân thiện "timed out", không còn 500.
- `PlanTaskCommandHandler`: tương tự — map cancellation → 503.
- `GlobalExceptionHandlingMiddleware`: map `TaskCanceledException`/`OperationCanceledException` → 503 để không đường nào trả 500 khi timeout.

**Web load nhanh:**
- `keep-alive.yml`: ping mỗi 3 phút (trước là 5) để Render free-tier không ngủ giữa các ping.
- `App.tsx` `BackendWarmer`: probe `/health` khi app tải + mỗi 60s khi tab còn mở, để thao tác đầu tiên của user thường chạm instance còn ấm.

**Tests:** +3 cho `AiExecuteCommandHandler` (timeout, 503 overload, happy path). Toàn bộ 381 unit + 2 integration + 30 frontend đều pass.

## Verification
- [x] `dotnet build` — 0 warning, 0 error
- [x] `dotnet test` — 381 unit + 2 integration pass
- [x] `npm run build` — TS strict sạch
- [x] `vitest` — 30 pass
