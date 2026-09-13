# راهنمای توسعه — City Manager

**نسخه سند:** 1.1 · هم‌راستا با monorepo v1.0.0

راه‌اندازی اول‌بار: [`getting-started.md`](getting-started.md)

---

## ۱) پیش‌نیازها

| ابزار | نسخه |
|--------|------|
| Node.js | ≥ 20 (`.nvmrc`) |
| pnpm | ≥ 9.15 |
| PostgreSQL | 16 + PostGIS |
| Git | 2.x |
| Redis (اختیاری) | برای OTP، lockout، throttle، presence |
| MinIO (اختیاری) | S3؛ بدون آن `STORAGE_LOCAL_PATH` |

روی Windows برای build محلی Next، `output: 'standalone'` پیش‌فرض غیرفعال است. روی Linux/CI با `DOCKER_BUILD=1` فعال می‌شود.

---

## ۲) متغیرهای محیطی

مرجع: [`.env.example`](../.env.example) · stage/prod: `.env.stage.example` · `.env.prod.example`

| گروه | متغیرهای مهم |
|------|----------------|
| Database | `POSTGRES_*`, `DB_POOL_*`, `DB_STATEMENT_TIMEOUT_MS` |
| Auth | `JWT_SECRET`, `JWT_*_EXPIRES_IN`, `CORS_ORIGIN` |
| Encryption | `PII_ENC_KEY`, `SECRETS_MASTER_KEY`, `INTEGRATION_ENC_KEY` |
| Redis | `REDIS_URL` |
| Messaging | `DISABLE_IN_PROCESS_MESSAGING`, `MESSAGING_SYNC_DISPATCH` |
| Swagger | `SWAGGER_ENABLED` |
| Storage | `S3_*`, `STORAGE_LOCAL_PATH` |
| Web | `NEXT_PUBLIC_API_URL`, `ALLOWED_DEV_ORIGINS` (web) |
| Sync / reports | `DISABLE_IN_PROCESS_SYNC`, `DISABLE_IN_PROCESS_REPORT_SCHEDULES`, `REPORT_SCHEDULE_INTERVAL_MS` |
| KPI MV | `DISABLE_KPI_SUMMARY_REFRESH`, `KPI_SUMMARY_REFRESH_MS` |
| Dev OTP | `SHOW_LOGIN_OTP_IN_DEV` (**فقط توسعه**) |

**هرگز** `.env` واقعی را commit نکنید.

---

## ۳) Workflow روزانه

```bash
pnpm install
cp .env.example .env
psql -U city_manager -d city_manager -f scripts/database/01-postgis.sql
pnpm --filter @city-manager/shared build
pnpm db:migrate
pnpm --filter @city-manager/api seed
pnpm dev
```

### Migration

```bash
pnpm db:migrate
pnpm --filter @city-manager/api migration:revert
pnpm --filter @city-manager/api migration:generate src/database/migrations/Name
```

Migrationهای مهم اخیر:

| Timestamp | موضوع |
|-----------|--------|
| `1737100000000` | فاز ۲ — outbox retry، DLQ، نقش سفارشی |
| `1737200000000` | فاز ۳ — MV KPI، `must_change_password`، `last_seen_at` |

### Seed

```bash
pnpm --filter @city-manager/api seed
pnpm --filter @city-manager/api seed:gis
```

---

## ۴) Workerها

| Worker | env | دستور |
|--------|-----|--------|
| Sync queue | `DISABLE_IN_PROCESS_SYNC=true` | `pnpm --filter @city-manager/api start:sync-worker` |
| Report schedules | `DISABLE_IN_PROCESS_REPORT_SCHEDULES=true` | `pnpm --filter @city-manager/api start:report-worker` |
| Messaging outbox | `DISABLE_IN_PROCESS_MESSAGING=true` | جدا از API در صورت استقرار چند replica |

Metrics صف: `GET /api/v1/integrations/queue/metrics`  
MVT: `GET /api/v1/gis/tiles/:layer/:z/:x/:y` (`neighborhoods` \| `fabrics` \| `urban`)

---

## ۵) تست

```bash
pnpm --filter @city-manager/shared test
pnpm --filter @city-manager/api test
pnpm --filter @city-manager/api test:cov
pnpm build
```

Shared را **قبل از** api/web بسازید (`pnpm build` ترتیب را رعایت می‌کند).

---

## ۶) ساختار Frontend

```
apps/web/src/
├── app/                 # App Router (dashboard, login, portal)
├── components/          # AppShell, GIS, case, settings, ui
├── lib/                 # api clients, auth, nav-config
└── app/globals.css
```

---

## ۷) ساختار API

```
apps/api/src/
├── modules/
├── database/migrations/
├── database/seeds/
├── sync-worker.main.ts
├── report-worker.main.ts   # در صورت وجود در dist
└── main.ts
```

Health: `/api/v1/health/live` · `/health/ready` · `/health/metrics`

---

## ۸) عیب‌یابی رایج

| مشکل | راه‌حل |
|------|--------|
| `@city-manager/shared` not found | `pnpm --filter @city-manager/shared build` |
| Migration failed | Postgres/PostGIS؟ credentials؟ |
| CORS | `CORS_ORIGIN` شامل origin فرانت |
| OTP در UI نیست | messaging SMS یا `SHOW_LOGIN_OTP_IN_DEV=1` فقط در dev |
| pnpm not found | `corepack enable` یا `npx pnpm@9.15.0` |

---

## ۹) قبل از PR

- CI سبز: lint, build, test, migrate
- Secret در diff ممنوع
- Migration breaking توضیح داده شود
- تست shared برای تغییر types/validation به‌روز شود

مشارکت: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
