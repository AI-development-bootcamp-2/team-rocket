---
name: swagger
description: "Use when you need to set up, generate, or maintain Swagger / OpenAPI documentation for the Express backend. All docs live in a single centralized openapi.ts — no annotations in route files."
user-invocable: true
argument-hint: "[init | scan | sync | route <path>]"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# /swagger — OpenAPI / Swagger Docs for the Express Backend

Manage API documentation for `server/`. All endpoint docs live in one centralized file: `server/src/openapi.ts`. Route files contain only Express handlers — no `@swagger` annotations.

**Target / mode:** $ARGUMENTS

## Modes

| Mode | What it does |
|---|---|
| `init` | Install deps, create `openapi.ts` with full spec, mount Swagger UI in `app.ts` |
| `scan` | Compare routes in `server/src/routes/` against paths in `openapi.ts`; list undocumented routes |
| `sync` | Cross-check `openapi.ts` paths ↔ actual routes; report drift in both directions |
| `route <path>` | Add or update the entry for one route file's endpoints in `openapi.ts` |

If no mode is given, run `scan`.

## When to Use

- After defining a new Express route → `route <path>` to add it to `openapi.ts`
- Before merging a PR → `sync` to catch drift
- Onboarding the project for the first time → `init`
- Periodic audit → `scan`

## Step 1: Detect Current State

```bash
# Check what's installed
grep -E '"(swagger-ui-express|swagger-jsdoc)":' server/package.json 2>/dev/null

# Check if openapi.ts already exists
ls server/src/openapi.ts 2>/dev/null

# Check for legacy swagger.js to clean up
ls server/src/swagger.js 2>/dev/null

# Check if UI is already mounted
grep -n "swagger\|api/docs\|api-docs" server/src/app.ts 2>/dev/null
```

## Step 2: Init

1. Install (only `swagger-ui-express` — no `swagger-jsdoc` needed):
   ```bash
   cd server && npm install swagger-ui-express
   npm install -D @types/swagger-ui-express
   ```

2. If `server/src/swagger.js` exists, delete it. If any route files have `@swagger` JSDoc blocks, remove those blocks from the route files.

3. Create `server/src/openapi.ts` as a plain TypeScript object — no scanner, no globs:

   ```ts
   import { OpenAPIV3 } from 'openapi-types';

   export const openapiSpec: OpenAPIV3.Document = {
     openapi: '3.0.3',
     info: {
       title: 'Time Reporting API',
       version: '1.0.0',
       description: 'Backend API for the time-reporting system (F01–F19).',
     },
     servers: [{ url: '/api' }],
     components: {
       securitySchemes: {
         bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
       },
       schemas: {},
     },
     security: [{ bearerAuth: [] }],
     paths: {
       // Add all endpoints here — grouped by tag/resource
     },
   };
   ```

   Install `openapi-types` for the TypeScript type:
   ```bash
   cd server && npm install -D openapi-types
   ```

4. Mount UI in `server/src/app.ts` **behind admin auth**. The middleware in this project is `authenticate` + `requireRole('admin')` from `./middleware/rbac.middleware`:

   ```ts
   import swaggerUi from 'swagger-ui-express';
   import { openapiSpec } from './openapi';
   import { authenticate } from './middleware/auth.middleware';
   import { requireRole } from './middleware/rbac.middleware';

   app.use('/api/docs', authenticate, requireRole('admin'), swaggerUi.serve, swaggerUi.setup(openapiSpec));
   app.get('/api/openapi.json', authenticate, requireRole('admin'), (_req, res) => res.json(openapiSpec));
   ```

   Do NOT expose docs without auth — it leaks the full admin route surface.

## Step 3: Scan for Undocumented Routes

```bash
# All Express route definitions in route files
grep -rEn "router\.(get|post|put|patch|delete)\(['\"]" server/src/routes/

# All paths currently defined in openapi.ts
grep -n "^\s*'/" server/src/openapi.ts
```

For each route definition found in `server/src/routes/`, check whether its method + path combination appears in `openapi.ts` under `paths:`. Report any that are missing.

```
──── /swagger scan ────
Spec: server/src/openapi.ts
UI:   GET /api/docs (admin-only)

Documented:    5 / 54 routes
Undocumented: 49 routes
  - server/src/routes/auth.routes.ts:27        POST /auth/login
  - server/src/routes/auth.routes.ts:31        POST /auth/refresh
  - server/src/routes/users.routes.ts:23       GET  /users/me
  ...

Run /swagger route server/src/routes/auth.routes.ts to document these.
```

## Step 4: Endpoint Entry Template

All docs go in `openapi.ts` under `paths:`. One key per URL path, one key per HTTP method under it.

```ts
paths: {
  '/time-entries': {
    get: {
      summary: 'List time entries for the authenticated user',
      tags: ['TimeEntries'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'week', in: 'query', schema: { type: 'string' }, description: 'ISO week string (YYYY-Www)' },
      ],
      responses: {
        200: { description: 'List of time entries', content: { 'application/json': { schema: { $ref: '#/components/schemas/TimeEntryList' } } } },
        401: { description: 'Not authenticated' },
      },
    },
    post: {
      summary: 'Create a time entry',
      tags: ['TimeEntries'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/TimeEntryCreate' } } },
      },
      responses: {
        201: { description: 'Created' },
        400: { description: 'Validation error' },
        401: { description: 'Not authenticated' },
        403: { description: 'Month is locked' },
        409: { description: 'Quota exceeded' },
      },
    },
  },
},
```

Reusable schemas go under `components.schemas` in the same file and are referenced via `$ref: '#/components/schemas/Foo'`.

## Step 5: Sync — Detect Drift

Drift cases to flag:

1. **Route in code, not in spec** — a `router.X('/foo')` exists but `paths['/foo'][method]` is absent from `openapi.ts`.
2. **Path in spec, no matching route** — `paths['/foo']` exists in `openapi.ts` but no `router.X('/foo')` is found. Likely a renamed or removed endpoint with stale docs.
3. **Method mismatch** — spec says `post` but route uses `put` (or vice versa).
4. **Auth mismatch** — spec says `security: []` but route uses `authenticate`, or vice versa.
5. **Status code mismatch** — handler calls `res.status(409)` but spec only lists 200/400.

Report with file path and line number. Do **not** auto-fix method/auth/path mismatches — the spec or the code could be wrong; needs a human decision.

## Project-Specific Conventions

- **All routes are mounted under `/api`** — do not include `/api` in `paths` keys (the server in `openapi.ts` already has `url: '/api'`).
- **Auth middleware**: `authenticate` (from `auth.middleware.ts`) + `requireRole('admin')` (from `rbac.middleware.ts`). Map to `security: [{ bearerAuth: [] }]` in the spec.
- **Public routes** (no auth): `POST /auth/login`, `POST /auth/refresh`. Set `security: []` on these explicitly.
- **Admin-only routes** (F04–F08, F14–F19): tag with `[Admin]` and document `403` for non-admins.
- **Locked months** (F15): any write to a time-entry, absence, or weekly-submission in a locked month returns `403` — document it.
- **File uploads** (F12 absence attachments): `multipart/form-data`, size limit 10 MB, document allowed MIME types.
- **Hebrew error messages**: error bodies may contain Hebrew strings; schema stays `{ message: string }` — don't localize the schema.
- **Tags**: group by feature — `Auth`, `Users`, `Clients`, `Projects`, `Tasks`, `TimeEntries`, `Timer`, `Absences`, `WeeklySubmissions`, `MonthLocks`, `MonthlySummary`, `Assignments`, `AuditLogs`, `Admin`.

## What NOT to Do

- **Do not add `@swagger` annotations to route files.** All docs live in `openapi.ts` only.
- **Do not mount `/api/docs` without auth.** It exposes the full route surface.
- **Do not invent endpoints.** Document only routes that actually exist in `server/src/routes/`.
- **Do not document internal functions.** OpenAPI is for HTTP routes only.
- **Do not auto-fix drift.** Flag it; let a human decide which side is correct.
- **Do not commit rendered HTML** — Swagger UI is served live, no static build needed.

## Rules

1. **Detect first** — read `server/package.json` and existing files before touching anything.
2. **Ask before installing** — toolchain choice is durable; don't pick silently.
3. **Admin-only docs UI** — non-negotiable for this project.
4. **All docs in `openapi.ts`** — never add swagger annotations to route files.
5. **`/api` prefix is implicit** — don't repeat it in `paths` keys.
6. **Tag every operation** — by feature group. Untagged ops sink to "default" in the UI.
7. **Document all common error codes** — at minimum: 400 (validation), 401 (auth), 403 (forbidden / month locked), 404, 409 (conflict), 500.
8. **Sync before merging** — `/swagger sync` should be part of the PR checklist for any backend change.
