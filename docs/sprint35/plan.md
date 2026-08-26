# 🚀 Sprint 35 — AI Agent (Landing-Parity E): Real LLM Planning + Self-Approval

> **Plan ref:** `wise-prancing-ritchie.md` — Sprint E, "PR 5 — Sprint E" (AI agent, real LLM) + Sprint F copy cleanup.
> **Status:** Complete ✅
> **PR:** backend commit `36d7a45` on `feat/landing-parity-sprint-e`, frontend PR in the same branch.
> **Branch:** `feat/landing-parity-sprint-e`

## Goal

Close the landing ↔ app gap for the **AI agent** claim — *"An AI agent that
plans work and writes the code, gated by your knowledge. Toggle self-approval
on for a fully autonomous flow."* The app previously had no AI at all; this
sprint adds a real, provider-agnostic LLM planning flow (user supplies their
own API key + base URL), knowledge-gated prompts, and a per-project
self-approval toggle.

Also handles the **Sprint F** copy cleanup: the landing's *"MCP server for
your tools"* claim is rephrased (MCP won't ship — the app exposes a REST API +
webhooks instead).

## E1 — Backend: AI client + planning pipeline

- **`IAiClient`** (`src/DevFlow.Application/Common/Interfaces/IAiClient.cs`) —
  `PlanTaskAsync(systemPrompt, userContext, ct)`. Provider-agnostic.
- **`OpenAiAiClient`** (`src/DevFlow.Infrastructure/AI/`) — calls any
  OpenAI-compatible `/chat/completions` endpoint via the configured
  `Ai:BaseUrl` (works with OpenAI, LiteLLM, Ollama, …); `Ai:ApiKey`, `Ai:Model`
  from config. Throws `InvalidOperationException` on API/auth errors.
- **`NoOpAiClient`** — fallback when no key configured; returns null so the
  handler maps to a friendly 503.
- **`AiPlan` entity + migration** — persisted plan with JSON-stored steps /
  subtasks / DoD, status lifecycle `Pending → Applied | Superseded`,
  `ai_plans` table + `approve_ai_plans` column on `projects` (default false).
- **`PlanTaskCommand`** (`[RequireWorkspaceRole(Member)]`, `IProjectEvent`) —
  builds a knowledge-grounded prompt (task + up to 12 weighted
  `KnowledgeEntry`s, body truncated to 800 chars), calls `IAiClient`, parses
  the JSON contract, supersedes prior pending plans, stores the plan, and
  **auto-applies when `project.ApproveAiPlans` is true**.
- **`ApplyAiPlanCommand`** — validates the plan is `Pending`, supersedes other
  pending plans, applies via the shared **`AiPlanApplier`** (dedupes subtasks
  by title, priority fallback to Medium, copies sprint/epic/assignee context,
  joins DoD with `\n`).
- **`GetLatestAiPlanQuery`** — returns the latest plan (null → 204).
- **`AiController`** — `POST /ai/plan`, `POST /ai/{planId}/apply`,
  `GET /ai/plans/{taskId}/latest`.
- **`AiPlanningUnavailableException`** → 503 via `GlobalExceptionHandlingMiddleware`.
- **`UpdateProjectCommand`** — optional `ApproveAiPlans` parameter.

## E2 — Frontend: AiPlanPanel

- **`frontend/src/components/ai/AiPlanPanel.tsx`** — mounted in
  `TaskDetailPanel.tsx` after `TaskPullRequests`. "Ask AI to plan" button →
  renders the generated plan (summary, steps, proposed subtasks with priority
  badges, DoD checklist with "all met" badge) → Apply / Regenerate; pending /
  applied status badges; error alert on 503.
- **`api.ts`** — `getLatestAiPlan` (null on 204), `planAiTask`, `applyAiPlan`.
- **`types/api.ts`** — `AiPlanResponse`, `AiPlanSubtaskResponse`,
  `approveAiPlans?` on `ProjectResponse`.
- **i18n (en + vi, parity 100%)** — `ai.*` keys: aiPlanner, askAiToPlan,
  generating, pending, applied, steps, proposedSubtasks, dod, allMet,
  applyPlan, applying, regenerate, planFailed, applyFailed.

## F — Landing copy cleanup

- `landing.features.ai.b3` "MCP server for your tools" → **"REST API +
  webhooks for your tools"** (en + vi). No other MCP references remain in the
  frontend.

## Verification

- [x] `dotnet test` — 378/378 (16 new: PlanTaskCommandHandler 6,
      ApplyAiPlanCommandHandler 5, AiPlanContract 4, + lifecycle).
- [x] `npm run build` (tsc strict) — green.
- [x] `npm test` — 30/30 (incl. i18n parity test).
- [x] Landing copy rephrase verified; no remaining MCP claims.
- [x] AGENT_STATUS + docs updated.
