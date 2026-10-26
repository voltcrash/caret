# Oxytype AI coding instructions

Be extremely concise. Follow [AGENTS.md](../AGENTS.md) for repository conventions.

## Architecture

pnpm/Vite+ workspace: TanStack Start (SolidJS) application and Worker in
`frontend/`, server-only backend services with D1 in `backend/`, and
shared `@caret` packages. See
[architecture](../docs/ARCHITECTURE.md) and [development setup](../docs/CONTRIBUTING_ADVANCED.md).

Frontend UI uses `.tsx` components. Keep imperative DOM work inside
component-owned refs/lifecycles. Use Tailwind, `class`, `cn`, configured colors
and the `Fa` icon component.

## Checks

```sh
vp lint --type-aware --type-check --format agent
vp run build
vp run test-fe
vp run test-be
```

Run a single test from its package with `vp test run path/to/test.ts`.
`vp run dev` starts the Start app, API and local D1 on port 3000.

## Key files

- Root `package.json` scripts: `vp run` tasks. Shared packages export TS source; no build step.
- `frontend/src/ts/config/metadata.tsx`: config validation rules.
- `packages/contracts/src/index.ts`: API contracts.
- `packages/funbox/src/list.ts`: funbox definitions.
- `frontend/src/routes/`: Start routes; `frontend/src/functions/`: server functions.
- `backend/src/services/operations/registry.ts`: operation → service map.
