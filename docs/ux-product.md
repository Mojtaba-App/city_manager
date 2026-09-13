# UX/UI محصول — City Manager

**نسخه:** 1.0 · پیکربندی مرکزی: `packages/shared/src/ux-config.ts`

---

## ۱) Persona و landing

`resolveUxPersona(roles, permissions)` نقش UX را تعیین می‌کند (ممکن است با `SystemRole` متفاوت باشد، مثلاً `field:access` → field_worker).

| Persona | Landing پیش‌فرض |
|---------|------------------|
| social_worker | `/dashboard/today` |
| field_worker | `/dashboard/field` |
| gis_analyst | `/dashboard/map` |
| manager / admin | `/dashboard` |
| analyst | `/dashboard/analytics` |

پس از login: `resolvePostLoginRoute()` در `apps/web/src/app/login/page.tsx`.

---

## ۲) فازهای UX/UI

### گام ۰ — UX سبک
- **امروز من** (`/dashboard/today`): widgetهای نقش‌محور
- **Summary bar** روی جزئیات پرونده
- تب‌های role-based + `?tab=` در URL
- Deep link: `buildMapUrl`, `buildHouseholdUrl`, `buildHouseholdSplitUrl`

### فاز ۱ — پایه UI
- `QueryState` + `Skeleton` / `SkeletonList`
- Sidebar موبایل (hamburger + backdrop RTL)
- Toast RTL · focus-visible · skip link
- Redirect login نقش‌محور

### فاز ۲ — Split + Drawer
- **فهرست خانوار**: split view دسکتاپ + drawer موبایل (`SplitView`)
- **نقشه**: پنل پرونده کنار map (wide) یا `Drawer` (narrow)
- URL: `/dashboard/households?case=ID&tab=operations&q=...&status=active`
- URL map: `/dashboard/map?dwelling=D&case=ID&tab=info`

### فاز ۳ — بهره‌وری
- **Command Palette** — `Ctrl+K` / `⌘K` (`CommandPalette.tsx`)
  - ناوبری · میانبر persona · پرونده اخیر · جستجوی API · **عملیات** (مثلاً toggle theme)
- **فیلتر ذخیره‌شده** — `SavedFiltersBar` روی households و **analytics**
- **Onboarding** — بنر ۳ مرحله‌ای روی `/dashboard/today` (نقش‌محور)

### فاز ۳+ — گسترش
- **Analytics presets** — ذخیره فیلتر محله/درآمد/بازه با `normalizeAnalyticsFilter`
- **Palette actions** — `getCommandPaletteActions(theme)` در shared؛ اجرا با `onSelect` در web

---

## ۳) Keyboard shortcuts

| میانبر | عمل |
|--------|-----|
| `Ctrl+K` | باز/بستن Command Palette |
| `Ctrl+K` → «تم» | toggle theme (روشن/تاریک) |
| `↑` / `↓` | حرکت در palette / global search |
| `Enter` | انتخاب |
| `Esc` | بستن dialog / drawer / palette |

---

## ۴) localStorage

| کلید | schema |
|------|--------|
| `cm-theme` | `light` \| `dark` |
| `cm:recent-households` | `RecentHouseholdItem[]` (max 8) |
| `cm:saved-filters:households:{userId}` | `SavedFilterPreset<HouseholdListFilter>[]` |
| `cm:saved-filters:analytics:{userId}` | `SavedFilterPreset<AnalyticsFilter>[]` |
| `cm:onboarding:{userId}` | `{ version, completedStepIds, dismissed }` |

---

## ۵) فایل‌های کلیدی Web

| فایل | نقش |
|------|-----|
| `components/AppShell.tsx` | chrome، nav، CommandPalette |
| `components/CommandPalette.tsx` | palette |
| `components/ui/SplitView.tsx` | split responsive |
| `components/ui/Drawer.tsx` | کشوی RTL |
| `components/case/HouseholdDetailPanel.tsx` | پنل embed پرونده |
| `components/filters/SavedFiltersBar.tsx` | فیلتر ذخیره‌شده |
| `components/OnboardingBanner.tsx` | onboarding |
| `lib/use-ux-persona.ts` | hook persona |
| `lib/saved-filters.ts` | CRUD presets |
| `lib/onboarding.ts` | state onboarding |

---

## ۶) Shared types

- `packages/shared/src/ux-config.ts` — persona, widgets, CTAs, onboarding, quick actions
- `packages/shared/src/filter-types.ts` — `HouseholdListFilter`, `AnalyticsFilter` helpers, `SavedFilterPreset`
- `packages/shared/src/ux-config.ts` — `getCommandPaletteActions`, `COMMAND_PALETTE_ACTION_SECTION`

تست‌ها: `ux-config.spec.ts`, `filter-types.spec.ts`
