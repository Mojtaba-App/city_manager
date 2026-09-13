# @city-manager/web

Next.js 16 admin panel (RTL) + citizen portal.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server on :3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | Next.js ESLint |

## Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Proxy to API is configured in `next.config.js` (`/api/v1/*`). Large GIS uploads use extended proxy body/timeout.

## Notable routes

| Path | Description |
|------|-------------|
| `/login` | Admin login (+ OTP / forgot-password) |
| `/dashboard` | Admin stats (deep-linked cards) |
| `/dashboard/today` | Persona desk + onboarding |
| `/dashboard/households` | Cases + split view |
| `/dashboard/map` | GIS workspace |
| `/dashboard/reports` | Report catalog · CSV/PDF |
| `/dashboard/integrations` | Connectors · queue · DLQ |
| `/dashboard/security` | ABAC · secrets · OAuth |
| `/dashboard/settings` | Branding · nav · messaging · JSON |
| `/portal` | Citizen portal |

## Auth note

Staff session uses **HttpOnly cookies** + CSRF. Portal redeem token may still use `localStorage` (`portalAccessToken`) — see `SECURITY.md`.

## Docs

- UX: [`../../docs/ux-product.md`](../../docs/ux-product.md)
- Getting started: [`../../docs/getting-started.md`](../../docs/getting-started.md)

Build note: on Windows, standalone output is skipped locally; CI/Docker can set `DOCKER_BUILD=1`.
