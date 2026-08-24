#!/usr/bin/env bash
#
# backup-db.sh — Dump a Postgres database to a timestamped .dump archive.
#
# Usage:
#   ./scripts/backup-db.sh              # uses DATABASE_URL or PG* env vars
#   DATABASE_URL="postgres://..." ./scripts/backup-db.sh
#
# Keeps the last KEEP_COUNT backups (default: 14). Older ones are deleted.

set -euo pipefail

KEEP_COUNT="${KEEP_COUNT:-14}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
OUT="${BACKUP_DIR}/backup-${TIMESTAMP}.dump"

# --- Resolve connection details ------------------------------------------------

if [[ -n "${DATABASE_URL:-}" ]]; then
  # Parse postgres://USER:PASS@HOST:PORT/DBNAME
  if [[ "$DATABASE_URL" =~ postgres(ql)?://([^:]+):([^@]+)@([^:/]+):([0-9]+)/([^?]+) ]]; then
    PGUSER="${BASH_REMATCH[2]}"
    PGPASSWORD="${BASH_REMATCH[3]}"
    PGHOST="${BASH_REMATCH[4]}"
    PGPORT="${BASH_REMATCH[5]}"
    PGDATABASE="${BASH_REMATCH[6]}"
  else
    echo "ERROR: Cannot parse DATABASE_URL" >&2
    exit 1
  fi
fi

# Validate required vars
for var in PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: ${var} is not set. Provide DATABASE_URL or set PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD." >&2
    exit 1
  fi
done

# Check pg_dump is available
if ! command -v pg_dump &>/dev/null; then
  echo "ERROR: pg_dump not found in PATH. Install postgresql-client." >&2
  exit 1
fi

# --- Dump -----------------------------------------------------------------------

mkdir -p "$BACKUP_DIR"

echo "Dumping ${PGDATABASE}@${PGHOST}:${PGPORT} → ${OUT}"

PGPASSWORD="$PGPASSWORD" pg_dump \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --format=custom \
  --compress=6 \
  --file="$OUT"

echo "Backup created: $(du -h "$OUT" | cut -f1) — $OUT"

# --- Prune old backups ----------------------------------------------------------

cd "$BACKUP_DIR"
ls -1t backup-*.dump 2>/dev/null | tail -n +$((KEEP_COUNT + 1)) | xargs -r rm -v
echo "Kept last ${KEEP_COUNT} backups."
