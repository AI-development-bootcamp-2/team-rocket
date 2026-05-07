# Backend Test Matrix

Last updated: 2026-05-07

## Current Coverage

### Integration

| Area | Status | Notes |
|------|--------|-------|
| Auth login/logout/refresh/change-password | Covered | [server/tests/integration/auth.test.ts](C:/Users/yogev/abra/finale/server/tests/integration/auth.test.ts:1) |
| User self-profile (`GET/PUT /users/me`) | Covered | Included in auth integration suite |
| User admin CRUD (`GET/POST/PUT/DELETE /users`) | Covered | Includes validation and RBAC checks |
| Permission flags | Covered | Grant/list/revoke + scoped project validation |
| Admin reset-password | Covered | Force-change + session termination + RBAC |
| Admin projects list (`GET /projects`) | Covered | Admin success, filters, non-admin `403`, invalid filter `400` |

### Unit

| Area | Status | Notes |
|------|--------|-------|
| JWT utilities | Covered | [server/tests/unit/utils/jwt.test.ts](C:/Users/yogev/abra/finale/server/tests/unit/utils/jwt.test.ts:1) |
| Password utilities | Covered | [server/tests/unit/utils/password.test.ts](C:/Users/yogev/abra/finale/server/tests/unit/utils/password.test.ts:1) |
| User parsing/validation helpers | Covered | [server/tests/unit/services/users.service.test.ts](C:/Users/yogev/abra/finale/server/tests/unit/services/users.service.test.ts:1) |
| Permission-flag parsing helpers | Covered | [server/tests/unit/services/permission-flags.service.test.ts](C:/Users/yogev/abra/finale/server/tests/unit/services/permission-flags.service.test.ts:1) |

## Implemented Backend Surface

These are the server routes that currently exist and therefore should be in scope for tests:

- `/auth/login`
- `/auth/logout`
- `/auth/refresh`
- `/auth/change-password`
- `/users/me`
- `/users/me/sort-preference`
- `/users`
- `/users/:id`
- `/users/:id/permissions`
- `/users/:id/reset-password`
- `/projects`

## Known Gaps

These areas are not built yet or are not meaningfully covered yet:

- client CRUD backend
- project CRUD backend beyond admin list
- task CRUD backend
- assignment CRUD and scope enforcement
- migration smoke tests
- database constraint tests outside the currently used auth/user flows
- direct service tests for DB-backed auth/user/project/permission mutation behavior
- middleware unit tests for `authenticate`, `requireRole`, and `errorMiddleware`

## Recommended Next Test Order

1. Add focused integration tests as each new CRUD route is implemented.
2. Add migration/schema smoke tests once F05-F08 tables and flows start being exercised.
3. Add service-level tests only where the logic is branching enough to justify it.
4. Keep auth/user integration coverage as the main regression suite until the rest of Epic 2 exists.
