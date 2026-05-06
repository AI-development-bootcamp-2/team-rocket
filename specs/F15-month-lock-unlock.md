# F15: Month Lock/Unlock

| | |
|---|---|
| **Phase** | 6 |
| **Sprint** | Sprint 6 |
| **Assigned to** | Dev B (Backend) + Dev D (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F14 |

## Summary

Admin locks a month after approval. Locked months block all editing. Admin can reopen with mandatory reason. Timestamp and actor recorded.

## Tasks & Subtasks

### 1. Backend: Month locks module

- [ ] POST /admin/months/:year/:month/lock — lock month (Admin only). Records `locked_by`, `locked_at`. Sets `is_locked=true`. After locking: `await notificationsService.create({ type: 'LOCKED_MONTH', userId: null, monthYear: '${year}-${month}' })` — recipient scope = all active users (backend queries `SELECT id FROM users WHERE is_active=true` and creates one notification per user). This is a background fan-out, not blocking.
  > **Pre-lock check (confirmation dialog, not hard block)**: if there are unapproved weeks in the month, the lock endpoint still succeeds BUT the frontend must first call `GET /admin/months/:year/:month/status` to fetch `unapproved_week_count`. If > 0, show a confirmation dialog listing the unapproved weeks — admin can proceed anyway. The backend does NOT return 422 for unapproved weeks.
- [ ] POST /admin/months/:year/:month/unlock — unlock (Admin only). Records `unlocked_by`, `unlocked_at`. **Requires reason (non-empty). Stores reason in `month_locks.unlock_reason` AND in `audit_logs.reason`.** Sets `is_locked=false`.
- [ ] GET /admin/months/:year/:month/status — return lock status, `locked_by`, `locked_at`, `unapproved_week_count`
- [ ] GET /admin/months — list all months with their lock status
- [ ] All lock/unlock actions audit logged with reason for unlock
- [ ] All time entry/absence mutations check month lock status before allowing changes
- [ ] **Shared service**: extract lock/unlock logic into `monthLocksService.lock(year, month, adminId)` and `monthLocksService.unlock(year, month, adminId, reason)`. Both this endpoint and the payroll export in F18 call the same service — do NOT duplicate lock logic.

### 2. Frontend: Month lock page

- [ ] MonthLockPage.jsx — admin screen
- [ ] Month selector grid or dropdown
- [ ] Per-month: status (open/locked), lock date, locked by, approved weeks count, unapproved weeks count
- [ ] Lock button with confirmation dialog: 'Lock March 2026? All editing will be blocked for all users.'
- [ ] Unlock button with mandatory reason input
- [ ] Warning if unapproved weeks remain

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton month grid
- [ ] **Delete confirm**: lock dialog with unapproved weeks warning
- [ ] **Validation error**: unlock requires non-empty reason (inline error in dialog)
- [ ] **Save success**: toast 'החודש נעול' / 'החודש נפתח'
- [ ] **Disabled control**: lock button disabled for months with unapproved weeks (tooltip 'X weeks not yet approved')
- [ ] **Server error**: toast on 500

### 3. Frontend: User-side lock indicator

- [ ] Locked month banner on MonthlyViewPage: '[Month] is locked — read only'
- [ ] Disable all edit/delete/submit actions for locked month
- [ ] Grey out form fields with tooltip: 'Month is locked'

### 4. Tests

- [ ] Test: Lock prevents create/edit/delete of entries in that month
- [ ] Test: Unlock requires reason
- [ ] Test: Lock records timestamp + actor
- [ ] Test: User sees read-only state for locked month

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /admin/months/:year/:month/lock | Admin |
| POST | /admin/months/:year/:month/unlock | Admin |
| GET | /admin/months/:year/:month/status | User/Admin |
| GET | /admin/months | Admin |

## Database Tables

month_locks

## Screens / UI

MonthLockPage, LockConfirmDialog, UnlockReasonDialog

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin desktop exports. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### MonthLockPage

**Layout:** standard management portal layout (sidebar `#1B2450` + page bg `#F3F4F6`)

**Page header:**
- Title: "נעילת חודש" `22–24px weight 700 #111827`
- Subtitle: `13px #6B7280`

**Month selection grid or table:**
- Table/grid showing months × year
- Each month cell: shows lock status badge

| Status | Badge style |
|---|---|
| Unlocked (open) | `background: #DCFCE7, color: #16A34A` "פתוח" |
| Locked | `background: #FEE2E2, color: #EF4444` "נעול 🔒" |
| Partially locked | `background: #FEF3C7, color: #D97706` "חלקית" |

- Lock/Unlock action buttons per row/cell: "נעל" (`#EF4444`) / "פתח" (`#16A34A`)
  Button size: `height: 32px, border-radius: 6px, font: 13px weight 600, color: #FFFFFF`

### LockConfirmDialog

**Layout:** centered modal ~400px, `border-radius: 12px`, overlay `rgba(0,0,0,0.45)`

**Content:**
- Red lock icon, `48px`
- Title: "לנעול את חודש {month} {year}?" `20px weight 700`
- Body: warning about effect on submissions `14px #6B7280`
- Buttons: [ביטול `background: #6B7F9E`] + [נעל חודש `background: #EF4444`]
  Both: `height: 44px, border-radius: 8px`

### UnlockReasonDialog

**Layout:** same as LockConfirmDialog but with reason textarea

**Content:**
- Unlock icon (green padlock open)
- Title: "לפתוח את חודש {month}?"
- Free-text textarea: "סיבת הפתיחה" placeholder, required
- Buttons: [ביטול `#6B7F9E`] + [פתח חודש `#16A34A`]

### Locked Month Indicators (user-facing)

When a month is locked, all portals show:
- Banner (top of page): `background: #FEF3C7, color: #D97706, border-radius: 8px, padding: 12px 16px`
  Icon: 🔒 + text "החודש נעול — קריאה בלבד"
- All edit/delete buttons hidden or disabled
- Form fields read-only (gray background `#F3F4F6`)

## Files to Create/Modify

- `server/src/modules/month-locks/*`
- `client/src/features/admin/month-lock/*`

## Acceptance Criteria

- [ ] Lock blocks all editing
- [ ] Unlock requires reason and is audit logged
- [ ] User sees locked state clearly
- [ ] Unlock reason stored in both month_locks.unlock_reason and audit_logs.reason
- [ ] Payroll export (F18) uses the same monthLocksService.lock() — no duplicate lock logic

