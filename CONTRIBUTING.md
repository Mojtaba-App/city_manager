# مشارکت در City Manager

این سند برای **مشارکت انسانی** (توسعه‌دهنده / بازبین) است. قبل از ارسال تغییرات، راه‌اندازی را از [`docs/getting-started.md`](docs/getting-started.md) کامل کنید.

---

## پیش‌نیازها

- Node.js ≥ 20 (`.nvmrc`)
- pnpm ≥ 9.15
- PostgreSQL 16 + PostGIS

---

## Workflow

```bash
pnpm install
pnpm --filter @city-manager/shared build
pnpm db:migrate
pnpm dev
```

| پکیج | مسیر | نقش |
|------|------|-----|
| API | `apps/api` | NestJS REST |
| Web | `apps/web` | Next.js admin |
| Shared | `packages/shared` | types، permissions، validation |

---

## قرارداد commit

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): short summary
```

`feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `security`

Scope نمونه: `web`, `api`, `shared`, `docs`, `ci`

---

## Pull Request

1. از `main` (یا branch پایه) branch جدید بسازید.
2. تغییرات را کوچک و مرتبط نگه دارید.
3. قبل از باز کردن PR:

```bash
pnpm --filter @city-manager/shared build
pnpm --filter @city-manager/shared test
pnpm --filter @city-manager/api test
pnpm build
```

4. در توضیح PR بنویسید: خلاصه تغییر، دلیل، و برنامه تست.

### چک‌لیست

- [ ] تست‌های مربوطه سبز
- [ ] `.env` یا secret در diff نیست
- [ ] migration جدید در docs ذکر شده (در صورت وجود)
- [ ] مجوزها و UI با `PermissionGate` هم‌خوان
- [ ] برای UI فارسی، RTL و a11y پایه رعایت شده

---

## استانداردها

- Types و RBAC در `@city-manager/shared`
- بدون commit کردن خروجی build (`dist/`, `.next/`)
- بدون commit کردن ابزارهای محلی IDE/AI (پوشه `.cursor/` و مشابه در `.gitignore`)

گزارش آسیب‌پذیری: [`SECURITY.md`](SECURITY.md) — نه issue عمومی با جزئیات exploit.
