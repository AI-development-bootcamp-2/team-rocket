# F19: Notifications & Holiday Settings

| | |
|---|---|
| **Phase** | 6 |
| **Sprint** | Sprint 6–7 |
| **Assigned to** | Dev E (Full-stack) |
| **Severity** | MAJOR |
| **Depends on** | F13, F14, **F02 migration 017 (notifications table)** |

## Summary

In-app notifications + 2 email triggers. Holiday calendar for admin to configure working days. System settings.

## Tasks & Subtasks

### 1. Backend: Notifications module

- [ ] Create notifications table — **defined in F02 migration 017**. Do not re-define here; import schema from F02.
- [ ] POST /notifications — internal, created by system events (rejection, missing report, admin edit, timer 10h, quota warning)
- [ ] GET /notifications — User's unread notifications
- [ ] PUT /notifications/:id/read — mark as read
- [ ] Email sending (using nodemailer or similar):
- [ ]   - Trigger 1: Thursday email if week not submitted
- [ ]   - Trigger 2: Email on admin rejection
- [ ] Cron job: Thursday check for unsubmitted weeks, send email reminders
- [ ] **Notification types** (full enum, matches F02 migration 017 ENUM):
  - `WEEK_REJECTED` — week rejected by admin (with reason). Created in F14.
  - `MISSING_REPORT` — week auto-flagged missing after Sunday deadline. Created by F13 cron.
  - `ADMIN_EDIT` — admin directly edited user's time entry. Created in F14 admin edit path.
  - `LOCKED_MONTH` — a month the user has entries in was locked. Created in F15 on lock.
  - `TIMER_LONG_RUNNING` — timer has been running for 10+ hours. Created by F10 cron. Deduplicated per timer session.
  - `QUOTA_WARNING` — user has reported ≥90% of monthly quota. Created on every time_entry save; deduplicated: max 1 per user per month.

### 2. Backend: Settings & holiday calendar

- [ ] GET /settings/holidays?year= — list holidays for a year
- [ ] POST /settings/holidays — create holiday (Admin only): date, name, type
- [ ] DELETE /settings/holidays/:id — remove holiday (Admin only)
- [ ] GET /settings — system settings (daily standard hours, etc.)
- [ ] PUT /settings — update system settings (Admin only)
- [ ] **System settings keys** (all stored in system_settings table, key/value):
  - `DAILY_STANDARD_HOURS` — default: `9`
  - `WEEKLY_SUBMISSION_DEADLINE_DAY` — default: `0` (Sunday, JS day index)
  - `MONTHLY_QUOTA_HOURS` — default: `182`
  - `TIMER_AUTO_STOP_HOURS` — default: `12`
  - `TIMER_WARNING_HOURS` — default: `10`
  - `QUOTA_WARNING_THRESHOLD` — default: `0.9` (90%)
- [ ] Holiday calendar feeds into quota calculation

### 3. Frontend: Notifications

- [ ] NotificationBell.jsx — header icon with unread count badge
- [ ] NotificationList.jsx — dropdown/panel showing notifications
- [ ] Types: rejection notice (with reason), missing report alert, admin edit notice, locked month notice, **timer 10h running warning**, **quota warning (approaching limit)**
- [ ] Click notification → navigate to relevant entry

### 3b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: spinner in notification panel while fetching
- [ ] **Empty**: 'No notifications' message in panel
- [ ] **Rejection notice**: notification shows rejection reason prominently with link to week
- [ ] **Quota warning**: orange notification with hours breakdown
- [ ] **Timer long-running**: orange notification with elapsed time and 'Stop Timer' shortcut button
- [ ] **Server error**: notification bell shows error state (not just no badge)

### 4. Frontend: Holiday & settings pages

- [ ] HolidayCalendarPage.jsx — Admin screen, calendar view with holiday markers
- [ ] Add/remove holidays with date picker and name input
- [ ] SystemSettingsPage.jsx — configure daily standard hours

### 5. Tests

- [ ] Test: Notification created on rejection
- [ ] Test: Holiday reduces monthly quota
- [ ] Test: Email sent for missing weekly report

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /notifications | User |
| PUT | /notifications/:id/read | User |
| GET | /settings/holidays | User/Admin |
| POST | /settings/holidays | Admin |
| DELETE | /settings/holidays/:id | Admin |
| GET | /settings | Admin |
| PUT | /settings | Admin |

## Database Tables

notifications (new), holiday_calendar, system_settings

## Screens / UI

NotificationBell, NotificationList, HolidayCalendarPage, SystemSettingsPage

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin exports `managment_Group_929` (settings). Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### NotificationBell (webapp header)

- Bell icon button: `24–28px SVG, color: #050804`
- Unread badge: red circle `#EF4444`, `14×14px`, white number `10px`, top-right of bell
- Click: opens NotificationList dropdown panel

### NotificationList Dropdown Panel

- `background: #FFFFFF, border-radius: 12px, box-shadow, width: ~360px`
- Header: "התראות" `16px weight 700` + "סמן הכל כנקרא" blue link `13px`
- Each notification row: `height: 64px, padding: 12px 16px, border-bottom: 1px solid #F3F4F6`
  - Icon left (RTL end): colored icon per notification type
  - Title: `13px weight 600 #111827`
  - Subtitle: `12px #6B7280`
  - Timestamp: `11px #666666` right-aligned
  - Unread row: `background: #EFF6FF` (blue tint)
- "ראה הכל" link at bottom: `14px #6B2FAA`

**Mobile push notification banners** (see figma-design-spec.md section 4.25):
- Success: green `#22C55E` banner, ✓ circle icon (not filled), × dismiss
- Info: blue `#3358D4` banner, ⓘ circle outline icon, × dismiss
- Error: red `#EF4444` banner, ⚠ triangle outline icon, × dismiss
- All banners: full-width, pinned below status bar, rounded bottom corners `12px`

### HolidayCalendarPage (management)

**Layout:** standard management layout

**Calendar display:**
- Year/month grid showing all national holidays for Israel
- Holiday rows: name + date, `height: 48px`
- Add holiday button: `background: #142A3F, border-radius: 8px`
- Edit/delete per row: same as other management tables

### SystemSettingsPage (הגדרת דיווחי שעות — `managment_Group_929`)

**Layout:** standard management layout, tab navigation within page

**Tabs** (underline style):
- "הגדרות כלליות" | "הגדרת דיווחי שעות" | "שעות עבודה" | "התראות"
- Active tab: `color: #6B2FAA, border-bottom: 2px solid #6B2FAA`

**Time report settings section:**
- Standard daily hours: number input `width: 80px, height: 48px`
- Standard monthly hours: calculated/derived, displayed read-only
- Permitted locations: multi-select tags input (מהמשרד / מהבית / מהלקוח)
- Report submission deadline: day-of-week dropdown + time picker

**Settings save button:**
- "שמור הגדרות" `background: #142A3F, height: 48px, border-radius: 8px, width: 140px`

## Files to Create/Modify

- `server/src/modules/notifications/*`
- `server/src/modules/settings/*`
- `client/src/features/notifications/*`
- `client/src/features/admin/settings/*`

## Acceptance Criteria

- [ ] Notifications appear on rejection
- [ ] Unread count badge works
- [ ] Holidays reduce quota
- [ ] Email sent on Thursday for missing reports
- [ ] All 6 notification types (WEEK_REJECTED, MISSING_REPORT, ADMIN_EDIT, LOCKED_MONTH, TIMER_LONG_RUNNING, QUOTA_WARNING) created by their respective trigger modules
- [ ] TIMER_LONG_RUNNING and QUOTA_WARNING are deduplicated (max 1 per session/month)
- [ ] System settings keys all seeded with defaults in F02 seed data

