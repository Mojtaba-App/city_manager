#!/usr/bin/env bash
# Restore PostgreSQL from pg_dump -Fc file (local path or after mc cp)
set -euo pipefail

DUMP="${1:?Usage: restore.sh <dump-file>}"
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=city_manager}"
: "${POSTGRES_USER:=city_manager}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"

if [[ ! -f "${DUMP}" ]]; then
  echo "File not found: ${DUMP}" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"
echo "[restore] terminating connections to ${POSTGRES_DB}"
psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" || true

echo "[restore] dropping & recreating database"
psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c \
  "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c \
  "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};"
psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c \
  "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

echo "[restore] pg_restore ${DUMP}"
pg_restore -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" --no-owner --no-acl "${DUMP}"

echo "[restore] OK — run migrations if schema lag: pnpm db:migrate"
echo "[restore] smoke: curl \$API/health/ready"
