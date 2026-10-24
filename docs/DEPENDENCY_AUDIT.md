# Dependency audit — 2026-10-11

Latest snapshot: [2026-10-22 security audit](security/audit-2026-10-22.md).
Its refreshed scan reports 22 development package/advisory entries, including
two critical Storybook entries; production-only scan remains zero. Counts below
are historical.

The audit on main reported 21 production flags (1 critical, 11 high,
7 moderate, 2 low). Including development dependencies reported 50 flags
(2 critical, 27 high, 16 moderate, 5 low).

After these updates, `vp pm audit -- --prod --json` reports zero flags.
`vp pm audit -- --json` reports one high advisory, confined to development
tooling. Neither count demonstrates an exploitable application path.

## Pinned fixes

| Package | Patched version |
| --- | --- |
| seroval | 1.6.3 |
| brace-expansion | 1.1.21 / 2.1.7 / 5.0.12, preserving each major |
| browserslist | 4.28.7 |
| source-map-js | 1.2.2 |
| yaml | 1.10.3 for legacy v1 consumers |
| @babel/core | 7.29.6 for v7 consumers |
| esbuild | 0.28.1 |
| tmp | 0.2.7 |
| form-data | 4.0.6 for v4 consumers |
| undici | 6.28.1 for v6 consumers |
| @humanfs/node | 0.16.8 |
| fast-uri | 3.1.8 |
| baseline-browser-mapping | 2.11.0 |
| sharp | 0.35.5 for v0.35 consumers |
| shell-quote | 1.11.0 |
| ts-deepmerge | 8.0.0 for @anatine/zod-openapi |

`@anatine/zod-openapi` 1.14.2 uses the old default merge export. Its existing
pnpm patch now calls the named `merge` export so the security upgrade retains
OpenAPI generation. Compatibility tests cover nested constraints, defaults,
descriptions and intersection schemas. Security-related property filtering
in ts-deepmerge remains enabled.

## Zod 4

All packages import `zod` (v4); nothing imports `zod/v3`. The patched
dependencies still target Zod 3 upstream:

- `@ts-rest/core` types and runtime import `zod`, and contract header merges
  use Zod 4 object types.
- `@ts-rest/open-api` detects deepObject query parameters through `_zod.def`.
- `@anatine/zod-openapi` reads Zod 4 definitions (`_zod.def.type`) and keeps
  its Zod 3 output: `.transform()` pipes, `.required()` fields, guid/uuid
  formats, integer checks and catch-all fallbacks.
- `zod-urlsearchparams` treats pipes like Zod 3 effects and types results with
  `ZodSafeParseResult`.

Run `vpx ./scripts/openapi.ts <file>` in `backend/` and diff the output against
`main` after changing schemas or these patches. The Zod 4 migration kept the
generated document byte-identical.

`@oxytype/util/zod-messages` installs a global `customError` map with the Zod 3
message wording; schema helpers load it. Records keyed by enums use
`partialRecord` (optional keys, invalid keys reported per key), and enums with
integer-like members use multi-value literals to keep their declared order.

The esbuild override covers both the old Drizzle loader and the Vite toolchain;
the frontend production build and backend documentation/Worker dry run passed.
The lockfile remains frozen-installable. Major-specific overrides avoid upgrading
unrelated YAML, HTTP-client and glob consumers.

## Remaining development advisory

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects `braces` 3.0.3. Deeply nested brace patterns can exhaust recursive AST
walkers. The advisory and npm registry provide no patched release as of this audit.

Dependency paths:

- `madge → dependency-tree → precinct → detective-typescript → typescript-estree → globby → fast-glob → micromatch → braces`
  (also through detective-vue2).
- Root `stylelint → globby/fast-glob/micromatch → braces`.

These dependencies run repository analysis/style checks with checked-in source,
configuration and fixed script patterns. The production-only audit contains no
braces path. No network-facing application caller was found. This is a limited
exposure assessment, not a claim that the package is safe for untrusted patterns.

Keep the advisory visible; no audit ignore is added. Upgrade when a patched
release is available. Reassess before exposing developer glob inputs to untrusted
remote users.

## Recheck

```sh
vp install --frozen-lockfile
vp pm audit -- --prod --json
vp pm audit -- --json
vp test run backend/__tests__/openapi.spec.ts
vp run build
```

