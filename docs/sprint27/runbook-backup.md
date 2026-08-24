# DevFlow Database Backup & Restore Runbook

## Overview

DevFlow uses automated daily Postgres backups via GitHub Actions. Backups are stored as `.dump` files (Postgres custom format with gzip compression).

**Backup schedule:** Daily at 03:17 UTC via `.github/workflows/backup.yml`
**Retention:** 30 days as GitHub Actions artifacts; locally, last 14 backups kept by `scripts/backup-db.sh`

---

## Downloading a Backup

### From GitHub Actions
1. Go to **Actions → Database Backup** in the repo
2. Click the most recent successful workflow run
3. Scroll to **Artifacts** and download `db-backup-<run_id>.zip`
4. Extract the `.dump` file

### From Local Machine
Backups are stored in `./backups/` (or the path set in `BACKUP_DIR`).

```bash
ls -lt backups/backup-*.dump
```

---

## Restoring a Backup

### Option A: Custom Format (`.dump` file) — Recommended

```bash
# Drop and recreate the database, then restore
dropdb -h HOST -U USER -W DBNAME
createdb -h HOST -U USER -W DBNAME
pg_restore --clean --if-exists -h HOST -U USER -d DBNAME backup-YYYYMMDD-HHMMSS.dump
```

**Flags:**
- `--clean` — drops objects before recreating (idempotent)
- `--if-exists` — no errors if objects don't exist yet

**Example:**
```bash
PGPASSWORD=secret pg_restore \
  --clean --if-exists \
  -h localhost -p 5432 -U devflow -d devflow \
  backups/backup-20260824-031700.dump
```

### Option B: Plain SQL (if you exported as `.sql`)

```bash
psql -h HOST -U USER -d DBNAME < backup.sql
```

### Option C: Into a Different Database

```bash
createdb -h HOST -U USER -W devflow_restore
pg_restore --clean --if-exists -h HOST -U USER -d devflow_restore backup.dump
```

---

## Running the Backup Script Locally

```bash
# Using DATABASE_URL
DATABASE_URL="postgres://devflow:secret@localhost:5432/devflow" ./scripts/backup-db.sh

# Or using individual PG* vars
PGHOST=localhost PGPORT=5432 PGDATABASE=devflow PGUSER=devflow PGPASSWORD=secret \
  ./scripts/backup-db.sh
```

The script will:
1. Dump the database to `./backups/backup-YYYYMMDD-HHMMSS.dump`
2. Prune backups older than the last 14 (configurable via `KEEP_COUNT`)

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `pg_dump: command not found` | Install postgresql-client: `apt install postgresql-client` (Debian/Ubuntu) or `brew install postgresql` (macOS) |
| `ERROR: connection refused` | Ensure Postgres is running and accepting connections on the specified host/port |
| `ERROR: permission denied` | Check PGUSER has sufficient privileges (superuser recommended for full backup) |
| `pg_restore: error: could not open input file` | Verify the file path is correct and the file isn't compressed (`.dump` is already compressed) |

---

## Architecture Notes

- Backups use Postgres `--format=custom` (compressed, parallelizable restore)
- The GitHub Actions workflow spins up a Postgres 17 service container, runs `pg_dump`, and uploads the result as a workflow artifact
- No data leaves GitHub infrastructure during the backup process
- The `BACKUP_DB_PASSWORD` secret should be set in repo settings; falls back to `devflow_backup` for local dev only

---

*Last updated: Sprint 27 (2026-08-24)*
