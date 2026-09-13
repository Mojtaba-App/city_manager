# City Manager — پلتفرم مدیریت بازآفرینی شهری

**نسخه:** 1.0.0  
**Monorepo:** pnpm workspace · NestJS API · Next.js Web · PostgreSQL + PostGIS

سامانه سازمانی برای پرونده خانوار، نقشه GIS، عملیات میدانی، همکاری بین‌سازمانی، گزارش‌گیری و امنیت داده (RBAC / ABAC / PII).

---

## فهرست

- [شروع سریع](#شروع-سریع)
- [ویژگی‌ها](#ویژگی‌ها)
- [استک فنی](#استک-فنی)
- [ساختار مخزن](#ساختار-مخزن)
- [تست](#تست)
- [استقرار و GitHub](#استقرار-و-github)
- [امنیت](#امنیت)
- [مستندات](#مستندات)
- [ورود پیش‌فرض](#ورود-پیش‌فرض)

راهنمای گام‌به‌گام کامل: **[`docs/getting-started.md`](docs/getting-started.md)**

---

## شروع سریع

```bash
cp .env.example .env          # مقادیر و secretها را تنظیم کنید
pnpm install
psql -U city_manager -d city_manager -f scripts/database/01-postgis.sql
pnpm --filter @city-manager/shared build
pnpm db:migrate
pnpm --filter @city-manager/api seed
pnpm dev
```

| سرویس | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Swagger (dev) | http://localhost:3001/api/v1/docs |
| Health | http://localhost:3001/api/v1/health/ready |

پیش‌نیاز: **Node ≥ 20** (`.nvmrc`) · **pnpm ≥ 9.15** · **PostgreSQL 16 + PostGIS**

---

## ویژگی‌ها

### داده و پرونده
- خانوار، اعضا (حذف نرم + قوانین سرپرست)، بیمه، مدارک، خط سیر
- مرکز عملیات، بازدید میدانی، تاریخچه تغییر

### GIS و بازآفرینی
- MapLibre، محله / بافت / ملک / لایه شهری
- Ingest async، GeoJSON با سقف/صفحه، **MVT** (`/gis/tiles/...`)
- برنامه‌های بازآفرینی و داشبورد محلات

### همکاری
- کانال میدانی، ارجاع، رضایت‌نامه، پورتال شهروند
- اعلان SSE با fallback poll · presence (Redis اختیاری)

### مدیریت و امنیت
- RBAC + CRUD سیاست ABAC · vault · OAuth client
- PII masking / grants · audit · org password policy setting
- نقش سفارشی · geo-scopes با org-check

### گزارش و داشبورد
- کاتالوگ گزارش (builtin + DB) · CSV و **PDF باینری**
- آمار داشبورد یک‌query · deep-link کارت‌ها
- MV خلاصه KPI محله + refresh پس‌زمینه

### یکپارچه‌سازی
- Upsert دامنه (خانوار/عضو) · CSV · DLQ · صف retry
- Worker جدا برای sync / گزارش / messaging (env)

---

## استک فنی

| لایه | فناوری |
|------|--------|
| Frontend | Next.js 16 · React 19 · RTL · MapLibre |
| Backend | NestJS 10 · TypeORM · PostgreSQL + PostGIS |
| Storage | MinIO / S3-compatible (fallback محلی) |
| Shared | `@city-manager/shared` |
| Cache (اختیاری) | Redis |
| Observability | `/health/metrics` · Prometheus rules در `docker/prometheus/` |
| CI | GitHub Actions · Trivy |

---

## ساختار مخزن

```
city_manager/
├── apps/
│   ├── api/                 # NestJS (+ sync-worker / report-worker)
│   └── web/                 # Next.js admin + portal
├── packages/
│   ├── shared/              # types, permissions, validation, UX
│   └── api-client/          # OpenAPI artifact + client
├── scripts/database/        # bootstrap PostGIS
├── database/schema/         # مرجع schema (منبع حقیقت runtime = migrations)
├── docker/                  # nginx / prometheus (scaffold observability)
├── infra/                   # backup + migrate helpers
├── docs/                    # مستندات
├── .github/workflows/       # ci · cd-stage · cd-prod
├── .env.example
├── .env.stage.example
├── .env.prod.example
├── SECURITY.md
└── pnpm-workspace.yaml
```

---

## تست

```bash
pnpm test                     # shared + api + api-client
pnpm --filter @city-manager/shared test
pnpm --filter @city-manager/api test
pnpm build
```

CI روی `main` / `develop`: lint · build · test · migrate · seed · Trivy.

---

## استقرار و GitHub

1. Secretها فقط در env سرور / GitHub Secrets — نه در git.
2. `pnpm install --frozen-lockfile && pnpm build && pnpm db:migrate`
3. API: `pnpm --filter @city-manager/api start`
4. Web: `pnpm --filter @city-manager/web start`
5. Smoke: `GET /api/v1/health/ready`

جزئیات: [`docs/infrastructure-deployment.md`](docs/infrastructure-deployment.md)

### اولین انتشار روی GitHub (دستی توسط نگهدارنده)

```bash
git init
git add .
git status                    # .env و node_modules نباید باشند
git commit -m "chore: initial import"
git branch -M main
git remote add origin git@github.com:<ORG>/<REPO>.git
git push -u origin main
```

---

## امنیت

- چک‌لیست و گزارش آسیب‌پذیری: [`SECURITY.md`](SECURITY.md)
- طراحی RBAC/ABAC/PII: [`docs/security-design.md`](docs/security-design.md)
- در production: رمز seed را عوض کنید؛ `SHOW_LOGIN_OTP_IN_DEV` خاموش؛ Swagger فقط در صورت نیاز.

---

## مستندات

| سند | موضوع |
|-----|--------|
| [`docs/getting-started.md`](docs/getting-started.md) | راه‌اندازی گام‌به‌گام |
| [`docs/development.md`](docs/development.md) | توسعه روزانه، env، worker، عیب‌یابی |
| [`docs/infrastructure-deployment.md`](docs/infrastructure-deployment.md) | CI/CD، backup، prod |
| [`docs/security-design.md`](docs/security-design.md) | امنیت سامانه |
| [`docs/ux-product.md`](docs/ux-product.md) | UX / shortcuts |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | PR و استاندارد کد (مشارکت انسانی) |
| [`CHANGELOG.md`](CHANGELOG.md) | تاریخچه نسخه‌ها |
| [`docs/repo-cleanup-report.md`](docs/repo-cleanup-report.md) | کاندیدهای حذف قبل از push |
| [`apps/api/README.md`](apps/api/README.md) | API |
| [`apps/web/README.md`](apps/web/README.md) | Frontend |
| [`packages/shared/README.md`](packages/shared/README.md) | پکیج مشترک |

---

## ورود پیش‌فرض

پس از `seed`:

| فیلد | مقدار |
|------|--------|
| Username / Email | `admin` / `admin@city.local` |
| Password | `Admin@1234` |

---

## مجوز

Proprietary — استفاده داخلی سازمان. در صورت نیاز فایل `LICENSE` جدا اضافه شود.
