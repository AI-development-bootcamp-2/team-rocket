# F03: Authentication

| | |
|---|---|
| **Phase** | 2 |
| **Sprint** | Sprint 1–2 |
| **Assigned to** | Dev E (Full-stack) |
| **Severity** | CRITICAL |
| **Depends on** | F01, F02 |

## Summary

Login, logout, JWT with refresh rotation, forced password change on first login, remember me, session management, account lockout.

## Tasks & Subtasks

### 1. Backend: Auth module

- [ ] Create auth.routes.js with POST /auth/login, /auth/logout, /auth/refresh, /auth/change-password
- [ ] Create auth.service.js with login logic (email lookup, bcrypt compare, JWT generation)
- [ ] Implement JWT access token (15 min) + refresh token (7 days) generation
- [ ] Implement refresh token rotation (new refresh on each use, invalidate old)
- [ ] Implement account lockout after 5 failed attempts (15 min cooldown)
- [ ] Store refresh tokens in DB or Redis for invalidation
- [ ] Implement forced password change detection (check must_change_password flag)

### 2. Backend: Auth middleware

- [ ] Create auth.middleware.js — verify JWT from Authorization header
- [ ] Extract user from token, attach to req.user
- [ ] Handle expired token (401), invalid token (401), missing token (401)
- [ ] Create rbac.middleware.js — check role and permission flags
- [ ] Add rate limiting on login endpoint (10/min per IP) — configured in F01; imported here
- [ ] Apply `helmet` middleware (configured in F01) — verify HSTS header present on all responses

### 3. Backend: Password management

- [ ] Implement password hashing with bcrypt (cost factor 12)
- [ ] Implement password validation (min 8 chars, 1 upper, 1 lower, 1 digit, 1 special)
- [ ] POST /auth/change-password: verify old password, validate new, update, clear must_change_password flag
- [ ] POST /users/:id/reset-password (Admin only): generate temp password, set must_change_password=true, audit log

### 4. Backend: Session kill

- [ ] When admin deactivates a user, invalidate all their refresh tokens immediately (DELETE from refresh_tokens WHERE user_id = :id)
- [ ] When user changes password, invalidate **all other** refresh tokens for that user (DELETE from refresh_tokens WHERE user_id = :id AND id != current_token_id)
- [ ] Logout endpoint invalidates current refresh token only

### 5. Frontend: Login page

- [ ] Create LoginPage.jsx with email, password fields, Remember Me checkbox, login button
- [ ] RTL layout, Hebrew labels
- [ ] Handle login API call, store tokens (access in memory, refresh in httpOnly cookie or localStorage based on Remember Me)
- [ ] Show error on invalid credentials
- [ ] Show lockout message after 5 failures
- [ ] Redirect to change-password page if must_change_password=true

### 5b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: spinner/skeleton while login request is in flight
- [ ] **Validation error**: inline field-level errors (empty email, password too short)
- [ ] **Server error**: toast for 500 responses
- [ ] **Locked account**: distinct message after 5 failures (not generic error)
- [ ] **Offline indicator**: disable submit button with 'No internet connection' message

### 6. Frontend: Change password page

- [ ] Create ChangePasswordPage.jsx
- [ ] Fields: current password, new password, confirm new password
- [ ] Client-side password strength validation with visual feedback
- [ ] On success: redirect to main app

### 7. Frontend: Auth context & routing

- [ ] Create AuthContext.jsx with login/logout/refresh functions
- [ ] Create ProtectedRoute.jsx component
- [ ] Implement auto-refresh: before access token expires, use refresh token to get new one
- [ ] Implement inactivity timeout (30 min): auto-logout with warning dialog
- [ ] Handle 401 responses globally in axios interceptor

### 8. Tests

- [ ] Test: successful login returns access + refresh tokens
- [ ] Test: wrong password returns 401
- [ ] Test: locked account returns 423 after 5 failures
- [ ] Test: expired access token returns 401
- [ ] Test: refresh token rotation works
- [ ] Test: forced password change flow
- [ ] Test: admin reset-password sets must_change_password
- [ ] Test: deactivated user's token is rejected

## API Endpoints


| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/login | Public | Returns access + refresh tokens |
| POST | /auth/logout | User | Invalidates refresh token |
| POST | /auth/refresh | Public (refresh token) | Returns new token pair |
| POST | /auth/change-password | User | Change own password |
| POST | /users/:id/reset-password | Admin | Reset user's password |

## Database Tables

users table (password_hash, must_change_password, is_active). Optional: refresh_tokens table.

## Screens / UI

LoginPage, ChangePasswordPage

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma MCP direct API extraction (File ID: `91bxDhniN8DFIWjo9dLuLR`) — authoritative.  
> Full token reference: `specs/figma-design-spec.md`. Generated components: `src/components/figma-generated/LoginCard.tsx` + `MobileFrame.tsx`

### Login Page (Management Portal + Webapp — Desktop)

**Layout:**
- Full-viewport: city skyline illustration or dark split-photo background
- Centered **glassmorphism card**: use `LoginCard` component (see below)
- Card centered with `display:flex; align-items:center; justify-content:center; min-height:100vh`

**LoginCard Component — Exact Values (Figma MCP Authoritative):**

```
Container:
  component: src/components/figma-generated/LoginCard.tsx
  max-width: 400px | min-width: 320px | padding: 32px 24px
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)
  border: 1px solid rgba(255,255,255,0.18)
  border-radius: 16px
  backdrop-filter: blur(4px)
  box-shadow: 5-layer rgba(31,38,135,...) — see figma-design-spec.md §9 --shadow-card
  animation: slideIn 0.3s ease-out (opacity 0→1, translateY 20px→0)
  direction: rtl | lang: he

Illustration slot (top):
  height: 200px | width: 100% | border-radius: 8px | background: #F2F2F7
  Asset: freepik__digital-illustration-of-a-sent-application-paper-p__3556

Title: "כניסה למערכת"
  font: Heebo/Inter | 24px | weight 600 | color: #050804 | text-align: right

Labels: "דוא\"ל" / "סיסמה"
  14px | weight 500 | color: #050804

Inputs:
  height: 48px | padding: 12px 16px | width: 100% | box-sizing: border-box
  border: 1px solid #E0E0E0 | border-radius: 8px
  background: #FFFFFF | font: Heebo 16px | color: #050804
  placeholder: color #999999
  direction: rtl (password) | direction: ltr (email field)
  transition: all 0.2s ease

  :focus  → border: 1px solid #6B2FAA | box-shadow: 0 0 0 3px rgba(107,47,170,0.1)
  .error  → border: 1px solid #C33636 | box-shadow: 0 0 0 3px rgba(195,54,54,0.1)

Error message:
  background: #FEE8E8 | color: #C33636 | border-radius: 8px | padding: 12px 16px
  font: 14px regular | role: "alert" | animation: shake 0.4s ease

Submit button: "כניסה" / loading: "מתחבר..."
  height: 48px | width: 100% | padding: 14px 24px | margin-top: 8px
  background: #142A3F | color: #FFFFFF | border: none | border-radius: 8px
  font: Heebo 16px weight 600 | transition: all 0.3s ease
  :hover:not(:disabled) → background: #0F1E2E | box-shadow: 0 4px 12px rgba(20,42,63,0.3) | translateY(-2px)
  :disabled → opacity: 0.6 | cursor: not-allowed
```

**Error messages (security-safe):**
- Invalid credentials → generic: `#C33636` text, "כתובת מייל או סיסמה שגויים" — never specify which field is wrong (OWASP A07)
- Account locked → amber banner `background: #FEF3C7; color: #D97706`: "החשבון ננעל זמנית. נסה שוב בעוד 15 דקות."

### Login Page (Mobile — inside MobileFrame)

**Background:** Full-bleed city skyline illustration — deep blue `#1B3A8C`

**Card:**
- Width: ~88% viewport width, centered
- `background: #EEF2F8` (light blue-gray), `border-radius: 24px`
- Wrap in `MobileFrame` component: `src/components/figma-generated/MobileFrame.tsx`

**Card content:**
```
┌────────────────────────────────┐
│   [▲ abra logo]                │  ← centered, 3-dot icons (orange, pink, teal)
│   [Hero illustration]          │  ← freepik illustration, ~280px
│   כניסה למערכת                │  ← 24px weight 600, color #050804, text-right
│   [email input]                │
│   [password input]             │
│   [Submit Button]              │  ← background: #1B2E6B, border-radius: 12px
└────────────────────────────────┘
```

### Change Password Page

**Layout:** Same centered card as login  
**Fields:** current password + new password + confirm new password  
**Password strength indicator:** horizontal bar below new-password input (green = strong)  
**Submit:** "שמור סיסמה חדשה" — button uses same style (`#142A3F`, 48px, radius 8px)  
**Validation:** inline error per field (same `#C33636` / `#FEE8E8` pattern), strength feedback live while typing

## Files to Create/Modify

- `server/src/modules/auth/*`
- `server/src/middleware/auth.middleware.js`
- `server/src/middleware/rbac.middleware.js`
- `client/src/features/auth/*`
- `client/src/api/client.js`

## Acceptance Criteria

- [ ] User can log in with email + password
- [ ] Remember Me extends session to 30 days
- [ ] First login forces password change
- [ ] Account locks after 5 failed attempts
- [ ] 30-minute inactivity auto-logout works
- [ ] Admin can reset user password
- [ ] Deactivated user is immediately logged out
- [ ] Login error always returns generic `401 { error: 'Invalid email or password' }` — never reveals which field is wrong (OWASP A07)
- [ ] Password change invalidates all other active sessions for that user
- [ ] Helmet HSTS header (`max-age=31536000; includeSubDomains`) present on every response

