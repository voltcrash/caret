# Root scripts

Start owns root build/dev/start and browser checks. The backend is a
server-only package: it has lint, tests and D1 schema commands but no build or
dev server. Production/staging build, artifact checks and deployment commands
live in @oxytype/frontend.

Other workspace aggregates remain unchanged. Package aliases stay when CI, contributor
docs, hooks, `vp staged`, or AGENTS.md use them. All filtered root scripts were
searched across tracked files before removing unused aliases.

Removed aliases:

| Removed alias | Replacement |
| --- | --- |
| `start-be`, `build-be`, `dev-be`, `build:legacy` | None: the rollback Hono Worker and legacy build were deleted in Stage 8 |
| `start-fe` | `vp run start` |
| `audit-fe` | `vp run --filter @oxytype/frontend audit` |

Use `vp run --filter <package> <command>` for other package commands.
