# F17: Audit Log

| | |
|---|---|
| **Phase** | 6 |
| **Sprint** | Sprint 6 |
| **Assigned to** | Dev B (Backend) + Dev D (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F02 |

## Summary

Comprehensive audit log viewer. All business-critical actions logged. Admin-only access. Filterable by entity type, user, action, date.

## Tasks & Subtasks

### 1. Backend: Audit log middleware & module

- [ ] Create auditLog.middleware.js — auto-log all POST/PUT/DELETE mutations
- [ ] Log: actorUserId, targetEntityType, targetEntityId, action, oldValue, newValue, reason, timestamp, ipAddress
- [ ] **IP capture**: extract from `req.headers['x-forwarded-for']` (first value if comma-separated) falling back to `req.socket.remoteAddress`. Store raw string (max 45 chars for IPv6).
- [ ] GET /audit-logs — Admin only, with filters: entity_type, entity_id, actor_id, action, date_from, date_to
- [ ] Pagination support (audit logs can be large)
- [ ] Ensure all modules call audit log on mutations (login, CRUD, submit, approve, reject, lock, export, password reset, deactivate)

### 2. Frontend: Audit log viewer

- [ ] AuditLogPage.jsx — Admin only
- [ ] Table: timestamp, actor name, action, entity type, entity ID, reason
- [ ] Expandable row showing old/new value diff
- [ ] Filters: entity type dropdown, user dropdown, action dropdown, date range picker
- [ ] Pagination
- [ ] Admin edit indicator: when user views their entry, show 'Modified by Admin' badge if audit log shows admin edit
- [ ] **Cross-spec note: the 'Modified by Admin' badge is NOT only in the audit log viewer. It must also appear in F09 (TimeEntryCard), F11 (DayDetailSheet day expand), and F14 (AdminWeekDetail per-entry row). The source of truth is `time_entries.last_modified_by_role`. The audit log viewer is the full history; the badge is the inline indicator.**

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton table rows
- [ ] **Empty**: 'No audit events match your filters'
- [ ] **No-permission**: 403 for non-admin
- [ ] **Server error**: toast on 500
- [ ] **Offline indicator**: table greys out

### 3. Tests

- [ ] Test: Every CRUD action creates audit log entry
- [ ] Test: Login success/failure logged
- [ ] Test: Rejection reason captured in audit log
- [ ] Test: Filters work correctly

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /audit-logs | Admin |

## Database Tables

audit_logs

## Screens / UI

AuditLogPage

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin desktop exports. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### AuditLogPage

**Layout:** standard management portal layout (sidebar `#1B2450` + page bg `#F3F4F6`)

**Page header:**
- Title: "יומן ביקורת" `22px weight 700 #111827`

**Filter toolbar:**
- Date range picker (from–to): two date inputs with calendar icons
- User filter dropdown
- Action type filter dropdown
- "חיפוש" button: `background: #142A3F, height: 36px, border-radius: 8px`

**Audit log table:**
- Container: `background: #FFFFFF, border-radius: 8px, box-shadow`
- Header: `background: #1B2340, color: #FFFFFF, height: 48px, font: 14px weight 600`
- Column order (RTL): תאריך ושעה | משתמש | פעולה | ישות | ערכים ישנים | ערכים חדשים | [פרטים]
- Rows: `height: 48px, border-bottom: 1px solid #E5E7EB`

**Action type badges:**
- CREATE: `background: #DCFCE7, color: #16A34A`
- UPDATE: `background: #DBEAFE, color: #2563EB`
- DELETE: `background: #FEE2E2, color: #EF4444`
- LOGIN: `background: #F3F4F6, color: #374151`
- ADMIN_EDIT: `background: #FEF3C7, color: #D97706`

**Details expand:**
- "פרטים" button: small `#6B2FAA` text link or icon
- Expands inline row to show old/new values diff
- Diff display: old value ~~strikethrough red~~ → new value **green bold**

**Pagination:** centered, blue active page pill, 25 rows/page default

## Files to Create/Modify

- `server/src/middleware/auditLog.middleware.js`
- `server/src/modules/audit-logs/*`
- `client/src/features/admin/audit-log/*`

## Acceptance Criteria

- [ ] All business actions logged
- [ ] Filters work
- [ ] Old/new values visible
- [ ] Admin edits visible to affected user

