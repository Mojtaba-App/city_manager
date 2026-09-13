# گزارش فایل‌های ریشه / جانبی — پیشنهاد حذف یا نگه‌داری

تاریخ بررسی: 2026-09-13  
هدف: آماده‌سازی مخزن برای GitHub بدون فایل اضافه یا خطرناک.

## ریشه پروژه (`/`)

| مسیر | وضعیت | پیشنهاد |
|------|--------|---------|
| `.env` | **محرمانه محلی** | commit نشود (در `.gitignore` است). قبل از push با `git status` چک کنید. |
| `.env.example` / `.env.stage.example` / `.env.prod.example` | لازم | نگه‌داری |
| `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `VERSION` | لازم | نگه‌داری |
| `.gitignore`, `.gitattributes`, `.editorconfig`, `.nvmrc` | لازم | نگه‌داری |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | لازم | نگه‌داری |
| `node_modules/` | وابستگی محلی | commit نشود |

**جمع‌بندی ریشه:** فایل زائد قابل‌حذف در خود ریشه دیده نشد؛ فقط `.env` واقعی نباید وارد git شود.

## اسکریپت‌های تشخیصی (احتمالاً یک‌بارمصرف)

| مسیر | توضیح | پیشنهاد |
|------|--------|---------|
| `scripts/check-big-layers.cjs` | تشخیص حجم لایه | حذف یا انتقال به `scripts/diagnostics/` در صورت نیاز تیم |
| `scripts/check-layer-stats.cjs` | آمار لایه |同上 |
| `scripts/check-layer-stats.mjs` | نسخه ESM تکراری آمار | **حذف کاندید** (تکرار `.cjs`) |
| `scripts/diagnose-layer-load.cjs` | عیب‌یابی بارگذاری | حذف یا diagnostics |

این‌ها برای runtime محصول لازم نیستند.

## Docker scaffold خالی / ناقص

| مسیر | وضعیت واقعی | پیشنهاد |
|------|-------------|---------|
| `docker/prometheus/prometheus.yml` + `rules/api-alerts.yml` | نمونه فاز ۳ | **نگه‌داری** |
| `docker/grafana/provisioning/...` | فقط پوشه‌های خالی | حذف کل `docker/grafana` یا پر کردن با datasource نمونه |
| `docker/loki/` | پوشه خالی | **حذف کاندید** |
| `docker/alloy/` | پوشه خالی | **حذف کاندید** |
| `docker/nginx/conf.d/` | بدون فایل conf | حذف یا افزودن reverse-proxy نمونه |
| `docker/init/` | پوشه خالی | **حذف کاندید** |

## Schema مرجع

| مسیر | توضیح | پیشنهاد |
|------|--------|---------|
| `database/schema/` | SQL دامنه؛ runtime از TypeORM migrations می‌آید | **حذف نکنید** بدون تصمیم معماری؛ ممکن است برای مستند/مقایسه مفید باشد. در docs به‌عنوان «مرجع غیرruntime» علامت‌گذاری شد. |

## نباید commit شوند (پوشش `.gitignore`)

- `.cursor/`, `AgentStores/`, `agent-transcripts/`, `AGENTS.md`, `.cursorrules`
- `dist/`, `.next/`, `coverage/`, `uploads/`, `*.dump`
- هر `docker-compose.override.yml` محلی

## اقدام پیشنهادی نگهدارنده (انسانی)

1. حذف اختیاری اسکریپت‌های تکراری تشخیص لایه اگر دیگر استفاده نمی‌شوند.
2. تصمیم برای دایرکتوری‌های خالی `docker/{grafana,loki,alloy}`.
3. `git init` + `git add` + بررسی `git status` که `.env` نباشد، سپس push.
