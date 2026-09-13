# @city-manager/shared

Shared TypeScript package — types, enums, permissions, UX config, filter types.

## Build

```bash
pnpm build    # tsc → dist/
pnpm test     # jest
pnpm lint     # tsc --noEmit
```

**Must be built before** `@city-manager/api` and `@city-manager/web`.

## Main exports

| Module | Contents |
|--------|----------|
| `permissions` | RBAC permissions, role defaults |
| `ux-config` | Persona, today widgets, landing routes, onboarding, quick actions |
| `filter-types` | Saved filter presets, household list filter |
| `*-types` | Domain enums/labels (case, gis, collaboration, operations, …) |
| `constants` | `APP_NAME`, `APP_VERSION`, pagination |

## Tests

- `ux-config.spec.ts` — persona, URLs, presentation mode, onboarding
- `filter-types.spec.ts` — filter helpers
- `permissions.spec.ts`, domain type specs
