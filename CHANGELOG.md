# Changelog

All notable changes to **City Manager** are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added — Platform maturity (Phase 2–3)
- Integration: domain upsert (household/member), CSV connector, DLQ + requeue UI
- Messaging: async `message_outbox` worker with retry/backoff
- GIS: batch neighborhood/fabric ingest, async ingest status, GeoJSON cap/paging, **MVT** tiles
- Case: member soft-delete + head-of-household rules; ownership normalize
- Security: ABAC policy CRUD UI/API; custom role create; geo-scopes org-check
- Reports: DB-backed custom catalog (`analytics.report_definitions`); binary PDF export
- Dashboard: single-query aggregates; StatCard deep-links
- Settings: advanced JSON editor; sidebar reorder/hide
- Ops: `analytics.mv_neighborhood_kpi` + refresh; Prometheus sample rules
- Quality: PostGIS/OpenAPI contract tests; analytics/dashboard specs
- Auth/account: `must_change_password`, durable `last_seen_at`, org `password_policy` setting
- Docs: getting-started, SECURITY.md, hardened `.gitignore` for GitHub

### Changed
- OTP login dialog a11y (focus, Escape, inert background)
- Field channel: PermissionGate; removed legacy «اولویت ۳» copy
- Nav `aria-current`; Next `allowedDevOrigins`

### Security
- Webhook endpoints use ValidationPipe without stripping arbitrary JSON bodies
- ABAC update uses typed DTO; secrets remain gitignored

---

## [1.0.0] — 2026-08-13

### Added — Product core
- Household case management, members, trajectory, operations center
- GIS map (MapLibre), layers, spatial search, regeneration programs
- Field worker channel, referrals, notifications, citizen portal hooks
- RBAC/ABAC, PII governance, audit, integration sync queue
- Analytics dashboard with KPI config, heatmap, choropleth, exports

### Added — UX/UI phases
| Phase | Highlights |
|-------|------------|
| Step 0 | Today desk, persona widgets, role-based tabs, deep links |
| Phase 1 | QueryState/Skeleton, mobile sidebar, toast RTL, focus-visible, role login redirect |
| Phase 2 | Split view (households), map drawer/split, URL sync (`?case=&tab=`) |
| Phase 3 | Command Palette (`Ctrl+K`), saved filters (households), onboarding banner |

### Added — Documentation
- `README.md`, `docs/development.md`, `docs/ux-product.md`
- `docs/security-design.md`, `docs/infrastructure-deployment.md`
- App READMEs under `apps/api`, `apps/web`, `packages/shared`
- `.nvmrc`, `.editorconfig`, `.env*.example`

### Technical
- Monorepo: pnpm workspace · NestJS 10 · Next.js · PostGIS
- `@city-manager/shared` — permissions, UX config, analytics types
- GitHub Actions CI, observability scaffold

[Unreleased]: https://github.com/your-org/city_manager/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/city_manager/releases/tag/v1.0.0
