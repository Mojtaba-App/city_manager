# طراحی امنیت، مجوزها، لاگ و ممیزی

**پلتفرم:** City Manager  
**نسخه:** 1.1 — امنیت + PII governance + audit (+ فاز ۲/۳: ABAC CRUD، vault، geo org-check)  
**پیاده‌سازی:** `apps/api/src/modules/security` + تقویت `auth` / `audit`

---

## ۱) مدل امنیتی (Defense in Depth)

```
┌─────────────┐   TLS + Helmet headers
│   Client    │
└──────┬──────┘
       │ JWT Bearer / OAuth2 Client Credentials
┌──────▼──────────────────────────────────────────┐
│  Edge: CORS allowlist + Rate Limit (Throttler)  │
├─────────────────────────────────────────────────┤
│  AuthN: JwtAuthGuard (@Public bypass)           │
│  AuthZ: PermissionsGuard (RBAC) → AbacService   │
│  Row:   orgScope + user_geo_scopes (RLS helper) │
│  Field: FieldMaskingService + PII AES-GCM       │
│  Audit: AuditInterceptor + AuditService         │
│  Secrets: SecretVault (AES-256-GCM, versioned)  │
└─────────────────────────────────────────────────┘
```

| لایه | سازوکار | هدف |
|------|---------|-----|
| Transport | HTTPS (prod) + Helmet | هدرهای امنیتی، کاهش XSS/clickjacking |
| Identity | JWT access (۱۵م) + refresh چرخشی | احراز هویت کاربر |
| M2M | OAuth2 `client_credentials` | یکپارچه‌سازی سامانه‌ها |
| RBAC | `Permission` در JWT از نقش‌های DB | کنترل endpoint |
| ABAC | سیاست‌های `security.abac_policies` | org / geo / purpose |
| Row | `organization_id` + geo scope | جداسازی داده |
| Field | mask/redact + مجوز `*:read_pii` | حداقل افشا |
| Data@Rest | AES-256-GCM (PII / vault / integration) | محرمانگی |
| Audit | append-only لاگ با sanitize | ممیزی و پاسخ‌گویی |
| Abuse | Throttle سراسری + سخت‌گیرانه روی login | ضد brute-force |

**اصل پیش‌فرض:** Deny by default برای کراس‌ارگ؛ Allow پس از عبور RBAC و عدم تطبیق deny در ABAC.

---

## ۲) مدل نقش و مجوز (RBAC + ABAC)

### RBAC
- نقش‌ها: `super_admin`, `org_admin`, `manager`, `social_worker`, `analyst`, `viewer`
- مجوزها: `resource:action` (مثلاً `members:read_pii`)
- منبع حقیقت JWT: **`core.roles.permissions` (JSON)** با fallback به `ROLE_PERMISSIONS`
- Guard سراسری: همه permissionهای `@Permissions(...)` باید موجود باشند (AND)

مجوزهای جدید این مرحله:
- `security:read` / `security:write`
- `secrets:manage`
- `oauth:manage`

### ABAC
صفات Subject: `userId`, `orgId`, `roles`, `permissions`, `neighborhoodIds`, `zoneIds`  
صفات Resource: `type`, `organizationId`, `neighborhoodId`, `ownerId`  
Context: `action`, `ip`, `purpose`

سیاست‌های پایه (seed):
1. `org_isolation` (deny) — تلاش دسترسی بین‌سازمانی
2. `geo_scope_household` (allow) — خانوار در محدوده جغرافیایی
3. `pii_purpose_limitation` (allow) — PII فقط با مجوز field-level

ارزیابی: اولویت عددی صعودی؛ اولین deny برنده؛ در غیر این صورت اولین allow؛ در نهایت default org isolation.

---

## ۳) طراحی Audit

جدول: `audit.audit_logs`

| فیلد | توضیح |
|------|--------|
| action / resource / resource_id | چه کاری روی چه چیزی |
| user_id / organization_id | فاعل |
| outcome | success \| failure \| denied |
| severity | info \| warning \| critical |
| request_id | همبستگی درخواست |
| payload | JSON سانیتایزشده (بدون secret/password/token) |
| ip / user_agent / created_at | زمینه |

**نوشتن:**
- دستی: `AuditService.log` (login، admin، …)
- خودکار: `@Audited({ action, resource })` + `AuditInterceptor`

**خواندن:** `GET /security/audit` با فیلتر صفحه/بازه/کاربر/نتیجه (نیاز `audit:read`)

---

## ۴) راهکار رمزنگاری

| داده | الگوریتم | کلید |
|------|----------|------|
| PII (کدملی، تلفن، بیمه‌نامه) | AES-256-GCM | `PII_ENC_KEY` → SHA-256 |
| Integration secrets | AES-256-GCM | `integration:${PII_ENC_KEY}` |
| Managed vault | AES-256-GCM + prefix `v1:` | `SECRETS_MASTER_KEY` |
| Refresh token | SHA-256 hash در DB | — |
| OAuth client secret | bcrypt(12) | — |
| جستجوی PII | SHA-256 hash جداگانه | — |
| Masking/anon export | HMAC-SHA256 / partial mask | salt ثابت |

چرخش: `key_version` + `rotated_at` در vault؛ ciphertext هرگز از API برنمی‌گردد.

---

## ۵) معماری احراز هویت

```
Password Login ──► bcrypt verify ──► Access JWT + Refresh (hashed)
Refresh ──────────► rotate (revoke old) ──► new pair
Logout ───────────► revoke refresh

OAuth2 Client Credentials:
  POST /oauth/token { grant_type, client_id, client_secret }
  ──► JWT با permissions = client.scopes ، orgId کلاینت
```

JWT claims: `sub`, `email`, `orgId`, `roles`, `permissions`  
آینده: Authorization Code + PKCE برای SSO سازمانی روی همان issuer.

---

## ۶) Secure API & Rate Limiting

- ValidationPipe: whitelist + forbidNonWhitelisted
- Helmet security headers
- CORS محدود به `CORS_ORIGIN`
- Throttler: پیش‌فرض ۱۲۰ req / ۶۰s ؛ login ۱۰ / ۶۰s ؛ oauth token ۲۰ / ۶۰s
- Swagger فقط با Bearer

---

## مسیرهای کلیدی API

| Method | Path | مجوز |
|--------|------|------|
| GET | `/security/overview` | security:read |
| GET | `/security/audit` | audit:read |
| GET | `/security/policies` | security:read |
| POST | `/security/evaluate` | security:read |
| CRUD | `/security/secrets` | secrets:manage |
| CRUD | `/security/oauth/clients` | oauth:manage |
| PATCH | `/security/users/:id/geo-scopes` | users:write |
| GET | `/security/pii/access-logs` | security:read |
| GET | `/security/pii/export-logs` | security:read |
| GET/POST | `/security/pii/grants` | security:read / security:write |
| POST | `/oauth/token` | Public |
| GET | `/admin/search` | org:read |
| GET | `/integrations/queue/metrics` | integration:read |

### PII Governance (اولویت ۴)

- **Access logs** — هر مشاهده/افشای PII ثبت می‌شود
- **Export logs** — خروجی‌های حاوی داده حساس
- **Field grants** — مجوز موقت فیلد-level
- **Global search** — masking کد ملی بدون `members:read_pii`

فایل‌های کد:  
`modules/security/*`, `modules/admin/services/global-search.service.ts`,  
`common/interceptors/audit.interceptor.ts`, `docs/security-design.md`
