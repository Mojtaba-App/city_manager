#!/usr/bin/env bash
# Logical backup of PostgreSQL → local file and optional MinIO (mc)
set -euo pipefail

: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=city_manager}"
: "${POSTGRES_USER:=city_manager}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"
: "${BACKUP_DIR:=./backups}"
: "${RETENTION_DAYS:=30}"
: "${S3_ENDPOINT:=}"
: "${S3_BUCKET:=city-manager-backups}"
: "${S3_ACCESS_KEY:=}"
: "${S3_SECRET_KEY:=}"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="${BACKUP_DIR}/${POSTGRES_DB}_${STAMP}.dump"
mkdir -p "${BACKUP_DIR}"

echo "[backup] dumping ${POSTGRES_DB}@${POSTGRES_HOST} → ${FILE}"
export PGPASSWORD="${POSTGRES_PASSWORD}"
pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" \
  -Fc --no-owner --no-acl "${POSTGRES_DB}" > "${FILE}"

# retention local
find "${BACKUP_DIR}" -name "${POSTGRES_DB}_*.dump" -mtime +"${RETENTION_DAYS}" -delete || true

if [[ -n "${S3_ENDPOINT}" && -n "${S3_ACCESS_KEY}" ]]; then
  echo "[backup] uploading to MinIO/S3 ${S3_BUCKET}"
  mc alias set cm "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" --api S3v4 >/dev/null
  mc mb -p "cm/${S3_BUCKET}/pg" || true
  mc cp "${FILE}" "cm/${S3_BUCKET}/pg/"
  # marker for BackupTooOld alert (Prometheus textfile collector optional)
  echo "city_manager_backup_last_success_unixtime $(date +%s)" > "${BACKUP_DIR}/backup.prom"
fi

echo "[backup] OK ${FILE} ($(du -h "${FILE}" | cut -f1))"
