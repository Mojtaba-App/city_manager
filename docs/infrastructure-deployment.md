# طراحی زیرساخت، استقرار و مقیاس‌پذیری

**پلتفرم:** City Manager  
**نسخه سند:** 1.1  
**مسیرها:** `infra/` · `scripts/database/` · `docker/` · `.github/workflows/`

---

## ۱) معماری استقرار

```
                         ┌──────────── Internet / VPN ────────────┐
                         │                                        │
                    ┌────▼────┐                              WAF/CDN
                    │ Reverse │  TLS · rate limit · static
                    │  proxy  │
                    └────┬────┘
           ┌─────────────┼─────────────┐
           │             │             │
      ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
      │   web   │   │   api   │   │  MinIO  │
      │ Next.js │   │ NestJS  │   │  (S3)   │
      └─────────┘   └────┬────┘   └─────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼───┐     ┌─────▼────┐    ┌─────▼────┐
    │Postgres│     │  Redis   │    │  Workers │
    │+PostGIS│     │(optional)│    │sync/report│
    └────────┘     └──────────┘    └──────────┘
```

| محیط | هدف | یادداشت |
|------|-----|---------|
| **dev** | لوکال | 1×api + 1×web؛ Redis اختیاری |
| **stage** | UAT | replica · DB جدا · secretهای stage |
| **prod** | تولید | TLS · Redis اجباری برای multi-instance · backup |

---

## ۲) CI/CD (GitHub Actions)

| Workflow | Trigger | کار |
|----------|---------|-----|
| `ci.yml` | push/PR به `main`/`develop` | lint · build · test · migrate · seed · Trivy |
| `cd-stage.yml` | tag `v*-rc*` | build + deploy placeholder |
| `cd-prod.yml` | tag semver | build + deploy placeholder |

CI از service container **postgis/postgis:16-3.4** استفاده می‌کند.

Secretهای لازم در GitHub Environments (stage/prod) را جدا از کد نگه دارید.

---

## ۳) راه‌اندازی PostgreSQL

```bash
psql -U city_manager -d city_manager -f scripts/database/01-postgis.sql
pnpm db:migrate
pnpm --filter @city-manager/api seed
```

منبع حقیقت schema در runtime: **TypeORM migrations** در `apps/api/src/database/migrations/`.  
پوشه `database/schema/` مرجع دامنه است و ممکن است با migrationها اختلاف جزئی داشته باشد.

---

## ۴) استقرار stage/prod

1. `pnpm install --frozen-lockfile && pnpm build`
2. env از `.env.stage.example` / `.env.prod.example` (مقادیر واقعی روی سرور)
3. `pnpm db:migrate`
4. API: `pnpm --filter @city-manager/api start`
5. Web: `pnpm --filter @city-manager/web start`
6. اختیاری:
   - `DISABLE_IN_PROCESS_SYNC=true` → `start:sync-worker`
   - `DISABLE_IN_PROCESS_REPORT_SCHEDULES=true` → `start:report-worker`
7. Smoke: `GET /api/v1/health/ready` و `GET /api/v1/health/metrics`

Backup: `infra/backup/backup.sh` · `infra/backup/restore.sh`

---

## ۵) Observability

| قطعه | مسیر / endpoint |
|------|------------------|
| Liveness / readiness | `/api/v1/health/live` · `/ready` |
| Prometheus text | `/api/v1/health/metrics` |
| Scrape + alert نمونه | `docker/prometheus/prometheus.yml` · `docker/prometheus/rules/api-alerts.yml` |

دایرکتوری‌های `docker/grafana`، `docker/loki`، `docker/alloy` فعلاً scaffold خالی‌اند؛ در صورت نیاز provisioning اضافه کنید.

---

## ۶) امنیت استقرار

- Secret فقط در env / secret manager
- TLS روی reverse proxy؛ DB پورت عمومی نشود
- `JWT_SECRET` / `PII_ENC_KEY` / `SECRETS_MASTER_KEY` تصادفی ≥ ۳۲ کاراکتر
- `SHOW_LOGIN_OTP_IN_DEV` و Swagger در prod خاموش مگر نیاز صریح
- Redis برای چند replica تا OTP/lockout/presence یکپارچه بماند
- جزئیات: [`../SECURITY.md`](../SECURITY.md) · [`security-design.md`](security-design.md)

---

## ۷) مقیاس (فاز ۳)

- GeoJSON با `limit`/`offset` و سقف سخت
- MVT برای کاشی‌های برداری لایه‌ها
- Materialized view `analytics.mv_neighborhood_kpi` + refresh پس‌زمینه
- آمار داشبورد در یک round-trip SQL
