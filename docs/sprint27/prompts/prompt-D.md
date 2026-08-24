# Prompt — Agent D (Frontend + Infra): Prefs Settings UI + DB Backup Automation

> You are **Agent D** on the DevFlow sprint team. Full plan: `docs/sprint27/plan.md`. Read it first.
> **Branch:** `feat/frontend-sprint27-prefs-backup` (base `main`). Conventional commits. Target PR at `main`.
> **Quality gates:** frontend changes — `npm run build` (tsc strict) green + **i18n parity** (new keys in BOTH `en.json` and `vi.json`; a vitest test enforces leaf-key parity both directions). Infra changes — YAML lints, script is idempotent.
> **Scope lock:** You own `SettingsPage.tsx`. **Agent C owns `SearchPage.tsx` / `WorkspacePage.tsx` / project cards — don't touch them.** Keep your `api.ts`/`types/api.ts` edits additive and coordinate via the plan.

---

## Context

DevFlow = .NET 8 backend + React 19 + Vite + Tailwind v4 frontend, PostgreSQL via EF Core, GitHub Actions CI. Two gaps this sprint:

1. **Backend (Agent B, B27.1) is adding 4 new notification event types** — `StatusChanged`, `CommentAdded`, `RoleChanged`, `RemovedFromWorkspace` — each with an `EmailOn*` and `InAppOn*` preference (8 new booleans, default `true`) round-tripping through `GET/PUT /api/v1/users/me/notification-preferences`. The Settings page currently only renders the original 3 event groups.
2. **No DB backup automation** — Postgres database has zero backup/restore story. You'll add a dump script + scheduled CI workflow + restore runbook.

---

## Task D27.1 — Notification-preferences settings for the new toggles

### Files
`frontend/src/pages/SettingsPage.tsx` (**yours — sole editor**), `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, `frontend/src/i18n/en.json` + `vi.json`.

### Approach
- Extend the prefs section (current markup near `SettingsPage.tsx:206`, under the `settings.preferences` heading) with 4 new toggle groups mirroring the existing assignment/mention/sprint groups: each group = label + email toggle + in-app toggle.
- Extend the `NotificationPreferences` type in `types/api.ts` and the GET/PUT payloads in `api.ts` with the 8 new fields (`emailOnStatusChanged`, `inAppOnStatusChanged`, `emailOnCommentAdded`, `inAppOnCommentAdded`, `emailOnRoleChanged`, `inAppOnRoleChanged`, `emailOnRemovedFromWorkspace`, `inAppOnRemovedFromWorkspace`).
- Persist via the existing save path (whole-object PUT, like the current prefs save).
- i18n keys for the 4 new group labels/descriptions in **both** files.

### Acceptance criteria
- All 8 new toggles render + persist through the API.
- `npm run build` green; i18n parity green.

---

## Task D27.2 — DB backup automation

### Files (new — no `src/` changes)
- `scripts/backup-db.sh` — dump Postgres to a timestamped archive. Read `DATABASE_URL` (or `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`), run `pg_dump --format=custom -f "$OUT"` (or plain `pg_dump`), gzip + timestamp it (`backup-YYYYMMDD-HHMMSS.dump`), keep last N (default 14) via find+delete. Fail loudly on missing `pg_dump`/unset creds.
- `.github/workflows/backup.yml` — scheduled daily (use e.g. `cron: 17 3 * * *`), a Postgres **service container** (same env-var pattern as the existing CI integration job), checkout, run `scripts/backup-db.sh` (postgres service at `localhost`), upload the dump as an Actions artifact. Add `workflow_dispatch` for manual runs.
- `docs/sprint27/runbook-backup.md` — how to restore: `pg_restore --clean --if-exists -d <db> <backup.dump>` (custom format) or `psql < backup.sql` (plain), plus how to run the script locally.
- Optional: one-line note in `README.md`.

### Acceptance criteria
- `scripts/backup-db.sh` runs against a local Postgres and produces a `.dump` archive.
- `backup.yml` passes YAML lint (`actionlint` or `python -c yaml.safe_load`).
- Runbook documents restore for both custom and plain formats.
- No `src/` changes.

---

## Notes
- Don't touch `SearchPage.tsx`, `WorkspacePage.tsx`, or `components/projects/*` — Agent C owns those.
- If the B27.1 backend migration hasn't merged yet, type the frontend against the new field names anyway and note the dependency in your PR body.
- Open ONE PR containing both tasks when green; ping the team lead for review.
