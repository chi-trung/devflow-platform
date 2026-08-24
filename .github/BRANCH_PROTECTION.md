# Branch Protection Rules

## Required Settings (configure in GitHub → Settings → Branches → main)

### 1. Require Pull Request Reviews
- **Required approving reviews:** 1
- **Dismiss stale pull request approvals when new commits are pushed:** ✅
- **Require review from Code Owners:** Optional

### 2. Require Status Checks
- **Require status checks before merging:** ✅
- **Required checks:**
  - `Backend Build & Test`
  - `Frontend Build & Test`
- **Require branches to be up to date before merging:** ✅

### 3. Require Conversation Resolution
- **Require conversation resolution before merging:** ✅

### 4. Require Signed Commits
- Optional — enable if team wants verified commits.

### 5. Do Not Allow Bypassing
- **Allow force pushes:** ❌
- **Allow deletions:** ❌

### 6. Auto-Merge Workflow
The `auto-merge.yml` workflow enables auto-merge **only after an approving review** is submitted. With the above branch-protection rules, auto-merge will:
1. Wait for a human review (PR Review → Approved)
2. Wait for all required CI checks to pass
3. Merge the PR automatically

Without an approving review, the workflow does not trigger, so PRs never merge without human approval.

---

## CI Jobs (must match required status checks)

| Job | Trigger | What it checks |
|---|---|---|
| `Backend Build & Test` | All PRs | `dotnet build` + unit tests + integration tests (real Postgres) |
| `Frontend Build & Test` | All PRs | `tsc --noEmit` + `npm run build` + `npm run test` (vitest) |

---

## Integration Test Postgres

CI runs a Postgres 17 service container. The `DevFlowWebApplicationFactory` picks up the connection string via the `DATABASE_URL` env var. When unavailable locally (no Docker), tests fall back to InMemory DB — but CI always uses real Postgres.

---

*Last updated: 2026-08-24 (Sprint 26)*
