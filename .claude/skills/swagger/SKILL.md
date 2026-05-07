---
name: swagger
description: "Use when you need to set up, generate, or maintain Swagger / OpenAPI documentation for the Express backend. Detects the chosen toolchain, scans routes for missing docs, and flags drift between routes and the spec."
user-invocable: true
argument-hint: "[init | scan | sync | route <path>]"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# /swagger — OpenAPI / Swagger Docs for the Express Backend

Manage API documentation for `server/`. Per [docs/specs/project-spec.md:38](docs/specs/project-spec.md#L38), this project uses Swagger; the toolchain has not been picked yet.

**Target / mode:** $ARGUMENTS

## Modes

| Mode | What it does |
|---|---|
| `init` | Detect or pick a toolchain, install deps, scaffold `openapi.ts`, mount Swagger UI |
| `scan` | List Express routes that have no `@openapi` / `@swagger` doc block |
| `sync` | Cross-check routes ↔ spec; report drift (route added but undocumented, doc exists but route renamed/removed) |
| `route <path>` | Add or update the doc block for one specific route file |

If no mode is given, run `scan`.

## When to Use

- After defining a new Express route → `route <path>` to add the doc block
- Before merging a PR → `sync` to catch drift
- Onboarding the project for the first time → `init`
- Periodic audit → `scan`

## Step 1: Detect or Choose Toolchain

```bash
# Already installed?
grep -E '"(swagger-jsdoc|swagger-ui-express|@nestjs/swagger|tsoa|@asteasolutions/zod-to-openapi)":' server/package.json 2>/dev/null

# Existing spec file?
ls server/src/openapi.* server/openapi.* 2>/dev/null
```

If nothing is installed, present the options and ask the user to pick (do not silently install):

| Option | Best when | Trade-off |
|---|---|---|
| **`swagger-jsdoc` + `swagger-ui-express`** (recommended for this stack) | Plain Express, want JSDoc-style annotations next to each route | Manual schema authoring; drift risk if comments fall behind code |
| **`@asteasolutions/zod-to-openapi`** | Already using or planning Zod for request validation | Single source of truth (Zod schema → OpenAPI), but only useful if Zod is in |
| **`tsoa`** | Want decorator-based controllers and types-as-source-of-truth | Heavier rewrite — controllers must be classes with decorators |

Default recommendation if user is undecided: **`swagger-jsdoc` + `swagger-ui-express`** (lowest friction for an existing Express codebase, easiest for the team to read and edit).

## Step 2: Init (when no toolchain exists)

After the user picks, scaffold:

1. Install:
   ```bash
   cd server && npm install swagger-jsdoc swagger-ui-express
   npm install -D @types/swagger-jsdoc @types/swagger-ui-express
   ```

2. Create `server/src/openapi.ts`:

   ```ts
   /** OpenAPI definition + swagger-jsdoc loader for the time-reporting API. */

   import swaggerJSDoc from 'swagger-jsdoc';

   /** Builds the OpenAPI spec by scanning JSDoc blocks in route files. */
   export const openapiSpec = swaggerJSDoc({
     definition: {
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
       },
       security: [{ bearerAuth: [] }],
     },
     apis: ['./src/routes/**/*.ts', './src/schemas/**/*.ts'],
   });
   ```

3. Mount UI in `server/src/app.ts` **behind admin auth** (per project-spec roles):

   ```ts
   import swaggerUi from 'swagger-ui-express';
   import { openapiSpec } from './openapi';
   import { requireAdmin } from './middleware/auth';

   /** Swagger UI is admin-only — leaks route surface otherwise. */
   app.use('/api/docs', requireAdmin, swaggerUi.serve, swaggerUi.setup(openapiSpec));
   app.get('/api/openapi.json', requireAdmin, (_req, res) => res.json(openapiSpec));
   ```

   If `requireAdmin` middleware doesn't exist yet, flag it and stop — don't expose docs unauthenticated.

## Step 3: Scan for Undocumented Routes

```bash
# Find Express route definitions
grep -rEn "router\.(get|post|put|patch|delete)\(['\"]" server/src/routes/

# Find files that have any @openapi or @swagger JSDoc block
grep -rEln '@(openapi|swagger)' server/src/routes/
```

For each route definition, check whether the **20 lines above** it contain an `@openapi` / `@swagger` block. Report routes with no doc.

```
──── /swagger scan ────
Toolchain: swagger-jsdoc + swagger-ui-express
Spec: server/src/openapi.ts
UI: GET /api/docs (admin-only)

Documented:    23 routes
Undocumented:  5 routes
  - server/src/routes/timer.ts:14   POST /timer/start
  - server/src/routes/timer.ts:31   POST /timer/stop
  - server/src/routes/absence.ts:22 POST /absence
  - server/src/routes/exports.ts:9  GET  /exports/excel
  - server/src/routes/exports.ts:18 GET  /exports/pdf

Run /swagger route server/src/routes/timer.ts to fill these in.
```

## Step 4: Doc Block Template (swagger-jsdoc)

Insert directly above the route handler. Keep it tight; one block per route.

```ts
/**
 * @openapi
 * /time-entries:
 *   post:
 *     summary: Create a daily time entry
 *     tags: [TimeEntries]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TimeEntryCreate' }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/TimeEntry' } } } }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Month is locked }
 *       409: { description: Quota exceeded }
 */
router.post('/time-entries', requireAuth, async (req, res) => { ... });
```

Schemas live in `server/src/schemas/*.ts` as `@openapi components.schemas.*` blocks; reference by `$ref`. If the project later adds Zod, regenerate schemas via `zod-to-openapi` instead of hand-writing.

## Step 5: Sync — Detect Drift

Drift cases to flag:

1. **Route in code, no doc** — same as `scan`.
2. **Doc in code, no route** — `@openapi /foo` exists but no `router.X('/foo')` matches. Likely a renamed/removed endpoint with stale docs.
3. **Path mismatch** — doc says `POST /time-entries/:id` but route is `PATCH /time-entries/:id`.
4. **Auth mismatch** — doc says `security: []` but route uses `requireAuth`, or vice versa.
5. **Status code mismatch** — handler returns `res.status(409)` but doc only lists 200/400.

Report with file paths and line numbers; do not auto-fix path/method/auth mismatches (they could mean the doc OR the code is wrong — needs a human).

## Project-Specific Conventions

- **All routes are mounted under `/api`** — server prefix, do not include it in `@openapi` paths.
- **Auth**: most routes require `bearerAuth` (JWT access token). Public exceptions: `POST /auth/login`, `POST /auth/refresh`. Document `security: []` on those explicitly.
- **Admin-only routes** (F04–F08, F14–F19): tag with `[Admin]` and note `403` response for non-admins.
- **Locked months** (F15): any write to a time-entry, absence, or weekly-submission in a locked month returns `403` — document it.
- **File uploads** (F12 absence attachments, F18 exports): use `multipart/form-data` content type; size limit 10 MB; document allowed MIME types.
- **Hebrew error messages**: error response bodies may contain Hebrew strings; the schema should still be `{ message: string }` — don't try to localize the schema.
- **Tags**: group by feature (`Auth`, `Users`, `Clients`, `Projects`, `Tasks`, `TimeEntries`, `Timer`, `Absences`, `WeeklySubmissions`, `Reports`, `Exports`, `Audit`, `Settings`, `Admin`).

## What NOT to Do

- **Do not mount `/api/docs` without auth.** It exposes the entire admin route surface, including export and audit endpoints.
- **Do not invent endpoints.** Document only routes that actually exist in `server/src/routes/`.
- **Do not document internal/private functions.** OpenAPI is for HTTP routes only.
- **Do not auto-fix path/method/auth drift.** Flag it; let a human decide which side is correct.
- **Do not commit the rendered HTML** — Swagger UI is served live by `swagger-ui-express`, no static build needed.
- **Do not duplicate validation in two places** if you eventually add Zod — switch to `zod-to-openapi` and delete the hand-written component schemas.

## Rules

1. **Detect first** — read `server/package.json` and existing files before touching anything.
2. **Ask before installing** — toolchain choice is durable; don't pick silently.
3. **Admin-only docs UI** — non-negotiable for this project.
4. **One block per route** — no shared blocks; keep doc next to handler.
5. **`/api` prefix is implicit** — don't repeat it in paths.
6. **Tag every operation** — by feature group. Untagged ops sink to "default" in the UI.
7. **Document all common error codes** — at minimum: 400 (validation), 401 (auth), 403 (forbidden / month locked), 404, 409 (conflict), 500.
8. **Sync before merging** — running `/swagger sync` should be part of the PR checklist for any backend change.
