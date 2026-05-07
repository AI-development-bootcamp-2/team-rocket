---
name: comment
description: "Use when you need to add inline documentation. Adds a clear file-header explanation, a one-line comment above every function, and inline comments inside complex functions only."
user-invocable: true
argument-hint: "[path or file]"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# /comment — Add Inline Documentation

Add comments to source files:

1. **File header** — a clear general explanation of what the module is for. Typically **1–3 sentences** — enough that a teammate landing cold knows the purpose plus any one non-obvious gotcha. Not a one-word tagline; not an essay. Skip what imports or the spec already say.
2. **Function comment** — one short line above **every** function (and class/exported component).
3. **Inline comments** — only **inside complex functions**, briefly noting WHY a non-trivial step exists. Simple functions get only the header comment; no inline noise.

**Target:** $ARGUMENTS

## When to Use

- After writing a new module that lacks documentation
- Before handing code to a teammate or reviewer
- When onboarding existing code that is correct but unexplained

## Scope Rules

| Touch | Skip |
|---|---|
| `src/`, `server/src/`, `client/src/` source files | `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/` |
| `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.css` | `*.test.*`, `*.spec.*`, `*.d.ts` |
| Hand-written modules | `src/components/figma-generated/` (MCP-generated, do not edit) |
| Public utilities, services, hooks, components | Auto-generated migrations, lockfiles, bundler output |

If no `$ARGUMENTS` is given, default to files changed in the working tree:

```bash
git diff --name-only HEAD
```

## Workflow

### Step 1: Detect Target Files

```bash
# Explicit path
[ -n "$TARGET" ] && find "$TARGET" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/figma-generated/*' -not -name '*.test.*' -not -name '*.spec.*'

# Default: changed files
git diff --name-only HEAD | grep -E '\.(ts|tsx|js|jsx|py|css)$'
```

### Step 2: For Each File

For every file, add what's missing:

1. **File header** — a clear general explanation. Typically 1–3 sentences. Aim for: purpose of the module + one non-obvious gotcha if there is one (which `F##` it implements, RTL/timezone trick, idempotency, which portal). Skip what the imports already show and what the F## spec already covers — don't paraphrase the spec into the header. If a clear header already exists, leave it; if the existing header is a meaningless tagline ("auth stuff"), replace it.
2. **Function comment** — one line above each function declaration, arrow-function export, class, and named React component. Skip if already present.
3. **Inline comments inside the function** — add only if the function is **complex**. Use this checklist to decide:
   - More than ~25 lines of logic, OR
   - Contains a non-obvious regex, magic number, or business-rule constant, OR
   - Has multi-step state machine, async race, retry/backoff, or intentional silent catch, OR
   - Contains an RTL-specific layout flip, timezone handling, or locale logic, OR
   - Multiple early returns / nested branches with non-obvious priority

   If none of those apply, the function is simple — leave its body uncommented.

### Step 3: Apply by Language

**TypeScript / JavaScript** — `/** ... */` for the file header and function comments; `//` for inline notes inside complex functions.

```ts
/**
 * Authentication service for the time-reporting API (F03).
 * Issues 15m access JWTs and 7d refresh tokens; refresh lives in an httpOnly cookie.
 */

/** Validates the daily quota and returns the deficit in hours, or 0 if met. */
export function calculateQuotaDeficit(entries: TimeEntry[]): number {
  // standard hours fall back to 9 when env var is missing
  const standard = Number(process.env.DAILY_STANDARD_HOURS) || 9;
  const total = entries.reduce((sum, e) => sum + e.hours, 0);
  return Math.max(0, standard - total);
}

/** Returns the user's display name. */
export const getDisplayName = (u: User) => u.fullName ?? u.email;
```

**React components** — short file header + one line above the component. Skip inline comments unless the component has real logic.

```tsx
/**
 * KPI summary row for the Webapp monthly report (F11).
 * Renders 5 cards; collapses to 4 (hides "פרויקטים") when the edit drawer is open via `compact`.
 */

/** Renders the 5 KPI cards from the monthly summary. */
export function KpiRow({ summary, compact }: Props) { ... }
```

**Python** — module docstring at top, single-line `"""..."""` docstring on every function.

```python
"""Cron jobs for weekly submission auto-flagging (F13).

Runs Sundays 23:59 Asia/Jerusalem. Idempotent — safe to re-run for the same week.
"""

def check_missing_submissions():
    """Flag users with zero submitted entries for the just-ended week. Idempotent."""
    ...
```

**CSS / CSS Modules** — `/* ... */` header noting which component/screen it styles. Inline `/* ... */` only for non-obvious values.

```css
/*
 * LoginCard styles — Webapp + Management portal login.
 * Pixel-perfect to specs/figma-design-spec.md §5.1; uses tokens from figma/PIXEL_PERFECT_CSS.css.
 */

.card {
  /* five-layer shadow composes the soft-glow effect from Figma */
  box-shadow: var(--shadow-card);
}
```

### Step 4: Write Edits

Use `Edit` to insert comments. Never reformat unrelated code. Never rename identifiers. Never change logic.

### Step 5: Report

```
──── /comment ────
Target: server/src/services/

Added:
  - 4 file headers
  - 17 function comments
  - 6 inline comments inside 3 complex functions

Skipped:
  - 3 files (already documented)
  - 1 file (auto-generated, figma-generated/)
  - 2 test files

Summary: 27 comments added across 7 files
```

## What a Good Comment Looks Like

Function comment — say what it does and any non-obvious return or side effect.

| ✅ Good | ❌ Bad |
|---|---|
| `/** Returns absence days summed across half-day + full-day entries. */` | `/** Calculates absence. */` |
| `/** Issues access + refresh JWTs; refresh is httpOnly cookie. */` | `/** Login function. */` |
| `/** Stops the active timer if older than 12h — runs every minute. */` | `/** Check timer. */` |

Inline comment (only inside complex functions) — explain WHY, not WHAT.

| ✅ Good | ❌ Bad |
|---|---|
| `// Sunday is week-start in Israel — offset by one day` | `// calculate offset` |
| `// retry once: WSL filesystem occasionally returns ENOENT under load` | `// retry on error` |
| `// 9h fallback when DAILY_STANDARD_HOURS env is missing` | `// set standard to 9` |

The rule: a comment must add information the reader cannot get from the code itself.

## Anti-Rationalization

| Excuse | Reality |
|---|---|
| "I'll explain what the loop does" | The reader can read the loop. Inline comments only justify WHY in complex functions. |
| "More inline comments = more documented" | More inline comments = more noise. Inline-only-when-complex is the point. |
| "This function is one line, but I'll add a doc comment for completeness" | Yes — every function gets a one-line header, even one-liners. That's the rule. |
| "This function is complex but the inline step is obvious to me" | If a teammate would pause and re-read the line, comment it. If they'd read it once and move on, don't. |
| "The file is small, no header needed" | Even small files get a header — one or two sentences is fine. Without it, a teammate has to read the code to learn the intent. |
| "I'll write a long header to be thorough" | A long header that paraphrases the F## spec or restates imports is noise that hides the real signal. 1–3 sentences. |
| "I'll just describe the file in the README" | The header lives next to the code. READMEs go stale and contributors don't grep them. |

## Rules

1. **Detect first** — default to `git diff --name-only HEAD` when no target given.
2. **File headers are clear general explanations, not taglines or essays.** Typically 1–3 sentences — purpose plus one non-obvious gotcha. Skip what imports show or what the F## spec already covers.
3. **Every function gets a one-line header.** No exceptions for size — even one-liners. One line, not a paragraph.
4. **Inline comments only inside complex functions.** Simple functions stay clean.
5. **Skip generated code** — `figma-generated/`, `dist/`, migrations, `*.d.ts`.
6. **WHY over WHAT for inline notes** — describe intent, constraints, edge cases, business rules.
7. **English by default** — UI is Hebrew, but code comments stay in English. Override only if the file already uses Hebrew.
8. **No task/PR references** — don't write "added for ticket X" or "fixes bug Y". The header should describe steady-state purpose, not history.
9. **Never reformat or rename** — comment-only edits.
