# Root scripts

Start owns root build/dev/start and browser checks. build:legacy and the backend
build remain rollback validation targets until Stage 8. Production/staging build,
artifact checks and deployment commands live in @oxytype/frontend.

Other workspace aggregates remain unchanged. Package aliases stay when CI, contributor
docs, hooks, lint-staged, or AGENTS.md use them. All filtered root scripts were
searched across tracked files before removing unused aliases.

The three removed aliases had no references outside their definitions:

| Removed alias | Equivalent commands |
| --- | --- |
| `start-be` | `vp run build-be && vp run --filter @oxytype/backend start` |
| `start-fe` | `vp run build-fe && vp run --filter @oxytype/frontend start` |
| `audit-fe` | `vp run --filter @oxytype/frontend audit` |

Use `vp run --filter <package> <command>` for other package commands. The root
script tests check CI and documented commands and preserve aggregate forwarding.
