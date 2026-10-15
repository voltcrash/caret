# Stage 3: services, policies and authentication

Base: Stage 2 `94edbf0a3`, PR #137. Stage 2 handoff/prerequisites verified.
Initial changes: three untracked context/auth/operation files from the interrupted
run; reviewed and completed. No unrelated changes. Production rollback retained.

## 3.1 Services and policies — complete

- All controller business operations moved to `backend/src/services/operations`.
  Services accept `ServiceContext` (server actor, config, trusted client) plus
  validated domain inputs. No Hono, MonkeyRequest, HttpRequest or raw headers.
- Legacy controllers contain only service adapters/re-exports; transactions,
  DAL/ranking/anticheat, deduplication and job implementations remain shared.
- Auth, permission, configuration and rate rules extracted into `policies`.
  Operation IDs derive from contract keys; named rate buckets preserve shared
  limits across transports without module/instance-order identities.
- Public typing stats and authenticated account stats proved first in built
  workerd, before expanding extraction. Start calls services directly.
- Stage 1's separate public-stat service and ad-hoc Start rate implementation
  removed. Audit IP now uses resolved trusted IP rather than trusting raw headers.
- Validation: existing auth 25, permission/config 29, public/user/app/misc 188
  tests pass; full backend unit suite 44 files / 801 tests passes. Service
  boundary tests pass. D1 fixtures updated to call services with typed contexts
  instead of incomplete cast legacy requests; signup/privacy checks pass.

## 3.2 Start policy adapters — in progress

Shared operation runner installed; remaining work: malformed/body/error policy
coverage, request logging and complete workerd access/failure matrix.

## 3.3 Start authentication flows — pending

## Remaining adapters

- Hono controller adapters serve rollback/external HTTP until Stage 6 transport
  retirement. They contain no business implementation.
- Browser Ape reads/writes remain Stage 6 work, except authentication flows.
- Legacy page/navigation runtime remains Stages 4–5 work.

## Decisions

- Contract input/response DTOs retained during extraction; contracts move to
  external-only ownership as callers migrate in Stage 6.
- Rate keys change once from `limiter:<sequence>` / `start:*` to `rate:<name>`.
  Existing shared limit groups (e.g. userGet) retained. No schema migration.

## Exit validation

Pending; Stage 3 is not complete.
