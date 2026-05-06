# F10: Timer Feature

| | |
|---|---|
| **Phase** | 6 |
| **Sprint** | Sprint 5 |
| **Assigned to** | Dev E (Full-stack) |
| **Severity** | MAJOR |
| **Depends on** | F09 |

## Summary

Start/stop timer for real-time tracking. One timer at a time, auto-stop at 12h, server-side persistence, blocks weekly submission if running.

## Tasks & Subtasks

### 1. Backend: Timer module

- [ ] POST /timer/start — create active_timer record. Validate no existing active timer.
- [ ] POST /timer/stop — delete active_timer, return start/end times for entry creation
- [ ] GET /timer/status — return current timer state (running/not, start_time, elapsed)
- [ ] Cron job or scheduled check: auto-stop timers running > 12 hours. **On auto-stop: call `notificationsService.create({ type: 'TIMER_AUTO_STOPPED', userId })` AND write audit log: actor=SYSTEM, action=TIMER_AUTO_STOPPED, old_value={ start_time }, new_value={ end_time, duration_minutes }.**
- [ ] **10h warning cron**: `SELECT * FROM active_timers WHERE start_time < NOW() - INTERVAL '10 hours' AND warning_sent_at IS NULL`. For each result: call `notificationsService.create({ type: 'TIMER_LONG_RUNNING', userId, body: 'השעון שלך פעיל כבר 10 שעות' })`, then `UPDATE active_timers SET warning_sent_at = NOW() WHERE id = :id` — deduplication via `warning_sent_at` column (defined in F02 migration 014).
- [ ] Timer state persisted in active_timers table (survives browser close)

### 2. Frontend: Timer UI

- [ ] TimerButton.jsx — prominent start/stop button on daily report page
- [ ] Running state: show elapsed time counter, pulsing indicator
- [ ] On stop: open TimerCompletionDialog.jsx with location, client, project, task, description fields
- [ ] Start and end times pre-filled from timer data
- [ ] **TimerCompletionDialog submit calls the same overlap check as POST /time-entries before creating the entry. If overlap detected, return inline 409 error — do not auto-close dialog.**
- [ ] Warning at 10 hours continuous running (in-app notification from F19)
- [ ] useTimer.js hook: poll timer status, update display

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: spinner on Start/Stop button while API call is in flight
- [ ] **Disabled control**: Start button disabled if timer already running (tooltip 'Timer is running'); weekly submit button disabled while timer running
- [ ] **Validation error**: TimerCompletionDialog shows inline error on overlap or missing required fields
- [ ] **Conflict (409)**: overlap error in TimerCompletionDialog — do not dismiss dialog, show error inline
- [ ] **Server error**: toast on 500 for start/stop calls
- [ ] **Save success**: timer stop → entry saved → toast 'Entry saved from timer'

### 3. Tests

- [ ] Test: Only one active timer per user
- [ ] Test: Auto-stop at 12 hours
- [ ] Test: Timer persists across page refresh
- [ ] Test: Timer stop creates valid time entry

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /timer/start | User |
| POST | /timer/stop | User |
| GET | /timer/status | User |

## Database Tables

active_timers

## Screens / UI

TimerButton (component on DailyReportPage), TimerCompletionDialog

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma webapp desktop + mobile exports. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### TimerButton (Webapp — header pill)

**Inactive state:**
- Pill button: `background: #EC4899` (solid) or linear-gradient `#EC4899 → #E879F9`
- Text: "הפעלת שעון" `14px weight 700 #FFFFFF`
- Icon: ▶ play icon, left of text (RTL: icon on semantic-start = physical left)
- `height: 36px, border-radius: 9999px, width: ~140px`

**Active/Running state (webapp header):**
- Same pill but label changes to: "עצור שעון" (stop) or shows elapsed time
- Timer display: `MM:SS` or `HH:MM:SS` in monospace font
- Background may shift to slightly darker pink or remain same

### Timer FAB (Mobile — bottom action bar)

**Inactive (play) state:**
- Circle FAB: `width: 44–48px, height: 44–48px, border-radius: 50%`
- Background: pink-red gradient `#E8627A → #F2849A`
- Icon: ▶ play SVG, white, centered

**Active (running) state:**
- Elapsed time display: `font: 18px monospace, color: #E8627A` (pink-red)
- Format: `MM:SS` (e.g. "14:32")
- Stop button circle: same size as play FAB, `background: #E8627A`, ■ stop icon
- Timer text appears to the left of the stop button in the action bar

**Disabled state (future month):**
- FAB: `background: #D1D5DB` (gray), play icon still showing but taps do nothing
- No text label change

**Layout of mobile bottom action bar:**
```
┌─────────────────────────────────────────────┐
│  [דיווח ידני]  [+]  │  [00:00] / [▶ timer]  │
└─────────────────────────────────────────────┘
```
- Left half: "דיווח ידני" label `13px #6B7280` + orange FAB circle `background: #FFA500`
- Vertical divider: `1px solid #E5E7EB`, full height of bar
- Right half: timer display or timer play FAB
- Bar bg: `#FFFFFF`, `border-top: 1px solid #E5E7EB`, `height: ~80px`

### TimerCompletionDialog

**Layout:** centered modal ~400px, `border-radius: 12px`, overlay `rgba(0,0,0,0.45)`

**Content:**
- Clock/timer illustration or large ✓ icon
- Title: "השעון הופסק" `22px weight 700`
- Body: "דווחו {HH:MM} שעות. האם לשמור דיווח?" `14px #6B7280`
- Buttons: [ביטול `#6B7F9E`] + [שמור דיווח `#142A3F`]
  Both: `height: 48px, border-radius: 8px`

**10-hour warning notification:**
- In-app banner (webapp) or push notification (mobile): "השעון פעיל 10 שעות — שכחת לכבות?"

## Files to Create/Modify

- `server/src/modules/timer/*`
- `client/src/features/timer/*`

## Acceptance Criteria

- [ ] Timer starts and shows elapsed time
- [ ] Only one timer at a time
- [ ] Stop opens completion dialog
- [ ] Auto-stop at 12h
- [ ] Persists across refresh
- [ ] Auto-stop creates TIMER_AUTO_STOPPED audit log entry with actor=SYSTEM
- [ ] 10h running triggers in-app notification (deduplicated per session)
- [ ] Completion dialog validates for time overlaps before saving entry

