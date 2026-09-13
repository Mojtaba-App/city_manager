# @city-manager/api

NestJS REST API for City Manager.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Watch mode (`nest start --watch`) |
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Production HTTP server |
| `pnpm start:sync-worker` | Integration sync queue worker |
| `pnpm start:report-worker` | Report schedule worker |
| `pnpm test` | Jest unit tests |
| `pnpm migration:run` | Apply TypeORM migrations |
| `pnpm seed` | Core seed data |
| `pnpm seed:gis` | Sample GIS data |
| `pnpm openapi:export` | Export OpenAPI document |

## Entry points

- `src/main.ts` — HTTP API (`API_PORT`, default 3001)
- `src/sync-worker.main.ts` — sync queue (`DISABLE_IN_PROCESS_SYNC=true`)
- `src/report-worker.main.ts` — report schedules (when disabled in-process)

## Notable routes

| Path | Notes |
|------|--------|
| `/api/v1/docs` | Swagger (env-gated in prod) |
| `/api/v1/health/ready` | Readiness |
| `/api/v1/health/metrics` | Prometheus text |
| `/api/v1/gis/tiles/:layer/:z/:x/:y` | MVT (`neighborhoods`\|`fabrics`\|`urban`) |
| `/api/v1/admin/reports/run/:code/pdf` | Binary PDF |

## Docs

- Getting started: [`../../docs/getting-started.md`](../../docs/getting-started.md)
- Security: [`../../docs/security-design.md`](../../docs/security-design.md) · [`../../SECURITY.md`](../../SECURITY.md)
- Development: [`../../docs/development.md`](../../docs/development.md)
