# Custom Subagents & Skills

Project-specific Claude Code agents and skills, tailored to this repo (Vite + React, Express + Node, PostgreSQL, Hebrew RTL, Figma-driven design).

## Quick reference

| Name | Type | How to invoke | Use when |
|---|---|---|---|
| [test-writer](agents/test-writer.md) | Subagent | "use the test-writer subagent" / proactive | Adding tests, TDD a new feature |
| [code-reviewer](agents/code-reviewer.md) | Subagent | "use the code-reviewer subagent" | Reviewing a PR or branch diff |
| [frontend-design](skills/frontend-design/SKILL.md) | Skill (auto) | Triggered by description | Building UI for any of the 3 portals |
| [comment](skills/comment/SKILL.md) | Skill (slash) | `/comment [path]` | Adding short inline docs to a file/dir |
| [swagger](skills/swagger/SKILL.md) | Skill (slash) | `/swagger [init\|scan\|sync\|route <path>]` | Setting up or auditing OpenAPI docs |

> **Subagents** are spawned by the main Claude agent (you can ask Claude to use one explicitly). They run in their own context.
> **Skills** marked "slash" are user-invocable via `/<name>`. "Auto" skills trigger when the model decides their description matches the task.

---

## Subagents

### test-writer
[.claude/agents/test-writer.md](agents/test-writer.md)

TDD specialist. Writes a **failing test first**, then runs it to confirm it fails for the right reason, before any implementation exists.

Tailored to:
- Jest **or** Vitest (auto-detected from `client/package.json` / `server/package.json`)
- `supertest` for Express HTTP routes
- React Testing Library for components — query by role/name (RTL-safe)
- Real Postgres test DB (no DB mocking — catches migration drift)
- Auth route pattern: tests both 401 unauth path and authorized happy path; admin-only routes also tested for 403 on `User` role
- Cron idempotency tests (run job twice, assert no duplication)
- `Asia/Jerusalem` clock for date-boundary tests

### code-reviewer
[.claude/agents/code-reviewer.md](agents/code-reviewer.md)

Reviews a PR or branch diff and reports findings with `file:line` + suggested fix, classified CRITICAL / HIGH / MEDIUM / LOW.

Catches:
- **Security**: missing `requireAuth`/`requireAdmin`, locked-month bypass (F15), SQL via template literals, JWT leaks, multer MIME-by-extension, unauth `/api/docs`
- **Correctness**: naive `new Date()` for TZ boundaries, week-start ≠ Sunday, non-idempotent cron, swallowed errors
- **Frontend**: `margin-left`/`text-align: left` breaking RTL, hardcoded hex (instead of tokens from [figma/PIXEL_PERFECT_CSS.css](../figma/PIXEL_PERFECT_CSS.css)), missing required UI states (loading/error/offline/locked-month/unsaved-changes), edits to `src/components/figma-generated/`
- **Backend**: missing transactions on multi-step writes, missing audit-log entries on admin writes, missing Swagger doc, inconsistent response shape
- **Tests**: <60% coverage on new code, mocked DB, empty assertions

Refuses to approve when any CRITICAL is open. Doesn't restate `/lint` output.

---

## Skills

### frontend-design (auto-triggered)
[.claude/skills/frontend-design/SKILL.md](skills/frontend-design/SKILL.md)

Triggers when the user asks to build a screen, component, modal, form, or any UI for **Management** (admin desktop), **Webapp** (employee desktop), or **Mobile** portal.

Grounded in:
- [specs/figma-design-spec.md](../specs/figma-design-spec.md) — pixel-perfect tokens, type scale, components, screens
- [figma/PIXEL_PERFECT_CSS.css](../figma/PIXEL_PERFECT_CSS.css) — production CSS variables (do not redefine)
- [src/components/figma-generated/](../src/components/figma-generated/) — pre-extracted components (`LoginCard`, `MobileFrame`, `BigButton`)
- Hebrew RTL, Heebo + Inter fonts, mobile-first
- Per-portal token sets (mobile pink ≠ webapp pink, mobile page bg ≠ webapp page bg)

Refuses to invent an aesthetic. Refuses to substitute fonts. Flags missing UI states.

### /comment
[.claude/skills/comment/SKILL.md](skills/comment/SKILL.md)

```
/comment              # comments files changed in working tree (git diff)
/comment src/foo.ts   # comments a single file
/comment server/src/  # comments all source files in a directory
```

Adds:
- One-line file header (what the module does)
- One-line comment above **every** function (even one-liners)
- Inline comments **only inside complex functions** (>~25 lines, regex, magic numbers, async/retry, RTL/timezone, multi-branch)

Skips: `figma-generated/`, `*.test.*`, `*.d.ts`, `dist/`, `node_modules/`, generated migrations.

### /swagger
[.claude/skills/swagger/SKILL.md](skills/swagger/SKILL.md)

```
/swagger              # default: scan
/swagger init         # detect/pick toolchain, scaffold openapi.ts, mount UI behind admin auth
/swagger scan         # list Express routes missing @openapi blocks
/swagger sync         # detect drift between routes and spec
/swagger route <path> # add/update doc block for one route file
```

On first run, asks the user to pick a toolchain — `swagger-jsdoc` + `swagger-ui-express` (recommended), `@asteasolutions/zod-to-openapi` (if Zod is in), or `tsoa`. Refuses to mount `/api/docs` without `requireAdmin` middleware.

---

## File layout

```
.claude/
├── README.md                          ← this file
├── agents/
│   ├── test-writer.md
│   └── code-reviewer.md
└── skills/
    ├── comment/SKILL.md
    ├── swagger/SKILL.md
    ├── lint/SKILL.md                  ← pre-existing, JS/TS lint + format
    └── frontend-design/
        ├── SKILL.md                   ← Figma-grounded UI skill
        └── LICENSE.txt                ← Apache 2.0 (originally from anthropics/skills)
```

Pre-existing skills not documented here (lint, openspec-*, opsx:*, init, review, security-review, etc.) are listed when the harness loads.
