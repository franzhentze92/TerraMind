# Phase 7 — Responsive, Performance, TypeScript & Final Hardening

**Estado:** implementado  
**Auditoría:** `npm run final-product:audit`

## Resumen de hallazgos iniciales

| Área | Clasificación | Resolución |
|------|---------------|------------|
| TypeScript (~183 errores) | **blocker** | **resolved** — `npm run build` en verde |
| Sidebar fijo en móvil | **high** | **resolved** — drawer overlay + hamburger |
| Sin ErrorBoundary | **high** | **resolved** — app shell + providers |
| Flaky population benchmark | **high** | **resolved** — warm-up + mediana + sequential |
| Bundle monolítico | **medium** | **resolved** — lazy routes |
| Tablas no responsive | **medium** | **resolved** — `ResponsiveTable` |
| Mapas sin min-height/resize | **medium** | **resolved** — `ResponsiveMapFrame` |
| Fechas duplicadas | **low** | **resolved** — `format-datetime-gt.ts` |
| Quetzal GIF sin reduced-motion | **low** | **resolved** — CSS `prefers-reduced-motion` |
| Playwright screenshots | **accepted limitation** | No usados salvo `runtime-auth-smoke` opcional |

## TypeScript

- Errores iniciales: ~183 en ~95 archivos
- Estrategia: tipos compartidos (Badge `danger`, OfflineFormSchema, IncidentRow), fixes locales por módulo, harness e2e alineados
- Criterio: `npm run build` (`tsc && vite build`) sin errores

## Responsive

- Breakpoints Tailwind: `md` (768), `lg` (1024)
- Sidebar: desktop colapsable; tablet colapsado por defecto; móvil drawer con backdrop, Escape, cierre al navegar
- AppShell: header móvil, `overflow-x-hidden`, `100dvh`
- Campo: conserva `FieldCampoLayout` con nav inferior en móvil

## Performance

- React Query: `refetchOnWindowFocus: false`, `staleTime: 60s`
- Lazy loading en router para módulos pesados (Situación Nacional, Field, informes, biodiversidad, etc.)
- Suspense + skeleton en AppShell

## Tests

- `src/shared/final-hardening.test.ts` — layout, lazy, population benchmark
- `population.integration.test.ts` — determinismo funcional (sin timing en suite paralela)
- `population.benchmark.test.ts` — mediana post warm-up, excluido de vitest default; `npm run population:benchmark`

## Auth

- `runtime-auth-smoke` existente (Playwright + credenciales env)
- ProtectedRoute + PermissionRoute sin cambios de reglas

## Limitaciones aceptadas

- Chunk principal >500 kB (warning Vite informativo)
- Mapas Leaflet sin refactor completo — frame común con ResizeObserver
- `runtime-auth-smoke` requiere credenciales en `.env` (no en repo)
