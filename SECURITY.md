# Security Policy — City Manager

## Reporting a vulnerability

If you discover a security issue in this project:

1. **Do not** open a public GitHub issue with exploit details.
2. Contact the repository maintainers privately (organization security channel / admin email).
3. Include: affected component (`api` / `web` / `shared`), version/`git` commit, reproduction steps, and impact.

We aim to acknowledge reports within a reasonable time and coordinate a fix before any public disclosure.

---

## Secrets and configuration

| Do | Don't |
|----|--------|
| Keep real secrets only in server env / secret manager | Commit `.env`, `.env.prod`, keys, dumps |
| Use `.env.example` / `.env.*.example` as templates | Reuse seed password `Admin@1234` in production |
| Rotate `JWT_SECRET`, `PII_ENC_KEY`, `SECRETS_MASTER_KEY` | Share production keys in chat/tickets |
| Set `SHOW_LOGIN_OTP_IN_DEV=0` (or unset) in prod | Enable OTP echo / Swagger in public prod without need |

Minimum secret length in production: **32+ random characters** for JWT / PII / vault keys.

---

## Production hardening checklist

- [ ] TLS terminated at reverse proxy; `Secure` cookies when HTTPS
- [ ] `CORS_ORIGIN` locked to real front-end origin(s)
- [ ] `SWAGGER_ENABLED` off unless explicitly required
- [ ] Strong DB password; Postgres not exposed publicly
- [ ] Redis recommended for multi-instance (OTP, lockout, throttle, presence)
- [ ] Object storage credentials rotated; buckets not public-read for PII
- [ ] Seed admin password changed immediately after first login
- [ ] Backup encryption and retention configured (`infra/backup`)
- [ ] Rate limits reviewed (`THROTTLE_*`)
- [ ] Trivy / dependency scan green in CI

---

## Auth & data protection (summary)

- Admin session: HttpOnly cookies + CSRF double-submit (see `docs/security-design.md`)
- RBAC permissions on API routes; ABAC policies for contextual allow/deny
- PII encrypted at rest (`PII_ENC_KEY`); field masking / grants for exports
- Audit log for sensitive actions (login failures, settings, portal redeem, webhooks)
- Portal citizen token currently uses `localStorage` — treat portal as higher XSS risk; keep CSP/sanitizer in place

Full design: [`docs/security-design.md`](docs/security-design.md)
