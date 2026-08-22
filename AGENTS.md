# DevFlow — Multi-Agent Guidelines

> This file defines how parallel AI agents (Codebuff, OpenCode, etc.) coordinate
> on this codebase. Every agent MUST read this before starting work.

## Architecture Overview

```
src/
├── DevFlow.Domain/          → Entities, Enums, Common base
├── DevFlow.Application/     → Features (CQRS), Behaviors, Interfaces
├── DevFlow.Infrastructure/  → EF Core, Redis, JWT, BCrypt
└── DevFlow.Api/             → Controllers, SignalR, Middleware

frontend/
└── src/
    ├── pages/               → Route-level components
    ├── components/          → Reusable UI
    ├── hooks/               → Custom React hooks
    ├── auth/                → Auth context, RequireAuth
    └── lib/                 → API client, utilities
```

## Agent Assignment

| Agent       | Scope                          | Branch Prefix     |
|-------------|--------------------------------|--------------------|
| Codebuff    | `src/` (Backend)               | `feat/backend-*`   |
| OpenCode    | `frontend/src/` (Frontend)     | `feat/frontend-*`  |

**Rule:** Each agent MUST stay within its scope unless explicitly asked otherwise.

## Workflow Rules

### 1. Branch Strategy
```
main
├── feat/backend-rate-limiting     ← Codebuff
├── feat/frontend-dark-mode        ← OpenCode
└── feat/backend-sprint-tests      ← Codebuff
```

### 2. Before Starting Work
```bash
git checkout main
git pull
git checkout -b feat/<scope>-<task-name>
```

### 3. Commit Convention
```
feat: add rate limiting to AuthController
fix: resolve JWT key validation in production
test: add unit tests for SprintService
docs: update README roadmap
```

### 4. Shared Files (Conflict Hotspots)
These files are frequently modified by both sides. **One agent at a time.**

| File | Who Touches | Notes |
|------|-------------|-------|
| `src/DevFlow.Api/Program.cs` | Backend only | Service registration |
| `src/DevFlow.Api/appsettings.json` | Backend only | Config |
| `frontend/package.json` | Frontend only | Dependencies |
| `AGENTS.md` | Either (with review) | Guidelines |
| `README.md` | Backend | Docs |

### 5. After Completing Work
```bash
git add .
git commit -m "feat: <description>"
git push origin feat/<scope>-<task-name>
```

Then create a PR:
```bash
gh pr create --base main --head feat/<scope>-<task-name> \
  --title "feat: <description>" \
  --body "Changes by <agent-name>"
```

## Communication Protocol

When giving instructions to another agent, use clear format:

```
/ask Stop current task.
/ask Work on frontend/src/pages/BoardPage.tsx - add drag-and-drop reordering
/ask Commit with message "feat: add drag-drop reordering"
```

## Conflict Resolution

If a merge conflict occurs:
1. Both agents STOP working
2. Human reviews the conflict
3. Resolve manually or ask one agent to fix it
4. Resume work

## Code Standards

- **Backend:** C# 12, .NET 8, Clean Architecture, CQRS + MediatR
- **Frontend:** TypeScript, React 19, Tailwind CSS v4, Vite
- **Commits:** Conventional commits (feat/fix/test/docs/chore)
- **No force pushes** to main without human approval
