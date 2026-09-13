# راهنمای شروع سریع (گام‌به‌گام)

این سند راه‌اندازی **لوکال** City Manager را از صفر تا ورود ادمین پوشش می‌دهد.

---

## ۰) پیش‌نیازها

| ابزار | حداقل |
|--------|--------|
| Node.js | 20 LTS (فایل `.nvmrc`) |
| pnpm | 9.15 (`packageManager` در `package.json`) |
| PostgreSQL | 16 + **PostGIS** |
| Git | 2.x |
| (اختیاری) Redis | برای OTP / lockout / presence در چند instance |
| (اختیاری) MinIO | object storage؛ بدون آن fallback محلی |

روی Windows می‌توانید از `npx pnpm@9.15.0` به‌جای نصب سراسری pnpm استفاده کنید.

---

## ۱) کلون و نصب وابستگی‌ها

```bash
git clone <URL-مخزن-GitHub> city_manager
cd city_manager
cp .env.example .env
pnpm install
# یا:
# npx pnpm@9.15.0 install
```

`.env` را باز کنید و حداقل این‌ها را تنظیم کنید:

- `POSTGRES_*` مطابق دیتابیس محلی
- `JWT_SECRET`, `PII_ENC_KEY`, `SECRETS_MASTER_KEY` (هر کدام ≥ ۳۲ کاراکتر تصادفی)
- `CORS_ORIGIN=http://localhost:3000`
- `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`

**هرگز** فایل `.env` واقعی را commit نکنید.

---

## ۲) دیتابیس

```bash
# ساخت نقش و دیتابیس (نمونه؛ مطابق نصب Postgres خودتان)
# CREATE USER city_manager WITH PASSWORD '…';
# CREATE DATABASE city_manager OWNER city_manager;

psql -U city_manager -d city_manager -f scripts/database/01-postgis.sql
pnpm db:migrate
pnpm --filter @city-manager/api seed
# اختیاری — داده نمونه GIS:
# pnpm --filter @city-manager/api seed:gis
```

Migrationهای اخیر شامل تکمیل محصول (فاز ۲) و مقیاس (فاز ۳: MV KPI، `must_change_password`، `last_seen_at`) هستند.

---

## ۳) اجرای توسعه

```bash
pnpm --filter @city-manager/shared build
pnpm dev
```

| سرویس | آدرس |
|--------|------|
| وب | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Swagger (dev) | http://localhost:3001/api/v1/docs |
| Health | http://localhost:3001/api/v1/health/ready |

### ورود پیش‌فرض (فقط بعد از seed)

| فیلد | مقدار |
|------|--------|
| نام کاربری / ایمیل | `admin` یا `admin@city.local` |
| رمز | `Admin@1234` |

بلافاصله پس از اولین ورود در محیط واقعی، رمز را عوض کنید.

---

## ۴) Windows (PowerShell) — ترتیب پیشنهادی

```powershell
cd path\to\city_manager
Copy-Item .env.example .env
npx pnpm@9.15.0 install
# Postgres + PostGIS از قبل باید بالا باشد
psql -U city_manager -d city_manager -f scripts/database/01-postgis.sql
npx pnpm@9.15.0 --filter @city-manager/shared build
npx pnpm@9.15.0 db:migrate
npx pnpm@9.15.0 --filter @city-manager/api seed
npx pnpm@9.15.0 dev
```

---

## ۵) Workerهای اختیاری

| حالت | env | دستور |
|------|-----|--------|
| Sync صف یکپارچه‌سازی جدا | `DISABLE_IN_PROCESS_SYNC=true` | `pnpm --filter @city-manager/api start:sync-worker` |
| زمان‌بندی گزارش جدا | `DISABLE_IN_PROCESS_REPORT_SCHEDULES=true` | `pnpm --filter @city-manager/api start:report-worker` |
| پیام‌رسانی فقط worker | `DISABLE_IN_PROCESS_MESSAGING=true` | از طریق همان پردازه case / تنظیمات messaging |

در توسعه معمولاً workerهای in-process کافی‌اند.

---

## ۶) تست قبل از push به GitHub

```bash
pnpm --filter @city-manager/shared build
pnpm --filter @city-manager/shared test
pnpm --filter @city-manager/api test
pnpm build
```

CI روی `main` / `develop`: lint · build · test · migrate · seed · Trivy.

---

## ۷) اولین push به GitHub (انسانی)

مخزن هنوز ممکن است remote نداشته باشد. روی ماشین خودتان:

```bash
git init
git add .
git status   # مطمئن شوید .env و node_modules نیستند
git commit -m "chore: initial import of City Manager"
git branch -M main
git remote add origin git@github.com:<ORG>/<REPO>.git
git push -u origin main
```

Secrets را فقط در GitHub Actions Secrets / محیط سرور بگذارید — نه در commit.

ادامه استقرار: [`infrastructure-deployment.md`](infrastructure-deployment.md)  
امنیت: [`../SECURITY.md`](../SECURITY.md)
