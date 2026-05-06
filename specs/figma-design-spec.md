# Figma Design Specification
## Time Reporting System — Pixel-Perfect UI Reference

> **Source**: 120 Figma export PNGs from `_previews/` + Figma MCP direct API extraction (File ID: `91bxDhniN8DFIWjo9dLuLR`, 10,657 elements)  
> **Scope**: Three portals — Management (Admin Desktop), Webapp (Employee Desktop), Mobile (React Native / Expo)  
> **Direction**: All portals are fully Hebrew RTL (`dir="rtl"` on root element)  
> **Font**: **Heebo** (primary, Hebrew support) with **Inter** as secondary (numbers/English). Both are Google Fonts. See section 2.  
> **Auth note**: All Figma screens show Azure SSO buttons. Per v3.2 FINAL spec, implementation uses email + password. Treat Azure button layouts as reference for card/button sizing only.  
> **Generated components**: `src/components/figma-generated/LoginCard.tsx` + `MobileFrame.tsx` are production-ready React components extracted directly from Figma via MCP.

---

## 1. Design Tokens — Color Palette

> **Figma MCP Note**: Values in the table below marked with ⭐ are extracted directly from the Figma source file via MCP API (authoritative). Other values come from image analysis of the PNG exports.

### 1.0 Figma Design System Colors (Authoritative — MCP Extracted)

These are the exact values from the Figma design file's component library and override any image-analysis estimates where they differ.

| Token | HEX | RGB | HSL | Usage |
|---|---|---|---|---|
| **Primary Purple** ⭐ | `#6B2FAA` | `107, 47, 170` | `267°, 56%, 43%` | Brand accent, input focus ring, hover highlight |
| **Primary Navy (Button)** ⭐ | `#142A3F` | `20, 42, 63` | `216°, 52%, 16%` | Login card CTA, mobile nav buttons |
| **Navy Hover** ⭐ | `#0F1E2E` | `15, 30, 46` | `216°, 51%, 12%` | Button hover/active state |
| **Surface White** ⭐ | `#FFFFFF` | `255, 255, 255` | — | Cards, modal backgrounds |
| **Background Light** ⭐ | `#F2F2F7` | `242, 242, 247` | `270°, 20%, 96%` | Page/mobile background |
| **Border Medium Gray** ⭐ | `#E0E0E0` | `224, 224, 224` | `0°, 0%, 88%` | Input borders, dividers |
| **Body Text** ⭐ | `#050804` | `5, 8, 4` | `110°, 43%, 3%` | Primary text (near-black) |
| **Secondary Text** ⭐ | `#666666` | `102, 102, 102` | `0°, 0%, 40%` | Captions, hints, secondary labels |
| **Error Background** ⭐ | `#FEE8E8` | — | — | Inline error message background |
| **Error Text** ⭐ | `#C33636` | `195, 54, 54` | — | Error text color |
| **Shadow Base** ⭐ | `#1F2687` | `31, 38, 135` | — | Card drop-shadow color |
| **Dark Mode BG** ⭐ | `#1C1C1E` | — | — | Mobile dark mode screen |
| **Dark Mode Surface** ⭐ | `#2C2C2E` | — | — | Mobile dark mode status bar |

### 1.1 Shared Tokens (across all portals)

| Token Name | Hex | Usage |
|---|---|---|
| `--color-primary` | `#2563EB` | Shared semantic blue (submitted badge text, weekend badge, info states) |
| `--color-nav-button` | `#142A3F` | **Primary CTA buttons, icon buttons, checkboxes, pagination active** |
| `--color-brand-purple` | `#6B2FAA` | **Active tabs, text links, focus rings, dropdown selection indicators** |
| `--color-primary-light` | `#EFF6FF` | Selected row highlight, pill tag background |
| `--color-primary-dark` | `#1D4ED8` | Date chip text (active/filled) |
| `--color-danger` | `#EF4444` | Error badges, delete buttons, required field markers |
| `--color-danger-bg` | `#FEE2E2` | Error badge background |
| `--color-success` | `#16A34A` | Complete-day badge text |
| `--color-success-bg` | `#DCFCE7` | Complete-day badge background |
| `--color-warning` | `#D97706` | Partial-day badge text |
| `--color-warning-bg` | `#FEF3C7` | Partial-day badge background |
| `--color-info` | `#2563EB` | Weekend/neutral badge text |
| `--color-info-bg` | `#DBEAFE` | Weekend/neutral badge background |
| `--color-disabled` | `#9CA3AF` | Disabled button background |
| `--color-border` | `#E5E7EB` | Card borders, dividers |
| `--color-border-input` | `#E0E0E0` | Input field borders (MCP authoritative) |
| `--color-text-primary` | `#111827` | Page headings, body text |
| `--color-text-body` | `#050804` | Near-black body text (MCP — login/mobile portals) |
| `--color-text-secondary` | `#666666` | Captions, hints, secondary text (MCP authoritative) |
| `--color-text-muted` | `#6B7280` | Subtitles (webapp nav bar) |
| `--color-text-placeholder` | `#666666` | Input placeholders (MCP authoritative) |
| `--color-overlay` | `rgba(0,0,0,0.45)` | Modal backdrop scrim |
| `--color-brand-orange` | `#F97316` | Logo flame icon, accent |
| `--color-brand-pink` | `#EC4899` | Timer/timer-related CTAs (webapp) |

### 1.2 Management Portal (Admin Desktop)

| Token | Hex | Usage |
|---|---|---|
| `--mgmt-sidebar-bg` | `#1B2450` | Sidebar background |
| `--mgmt-table-header` | `#1B2340` | Table header row background |
| `--mgmt-page-bg` | `#F3F4F6` | Page background |
| `--mgmt-card-bg` | `#FFFFFF` | Cards, modal, table rows |
| `--mgmt-cancel-btn` | `#6B7F9E` | Cancel button in confirmation dialogs |
| `--mgmt-hover-row` | `#EFF6FF` | Hovered/selected table row |
| `--mgmt-pill-bg` | `#F1F3F5` | Employee name pill tags |

### 1.3 Webapp Portal (Employee Desktop)

| Token | Hex | Usage |
|---|---|---|
| `--app-page-bg` | `#F2F3F7` | Page background |
| `--app-header-bg` | `#FFFFFF` | Top nav bar |
| `--app-card-bg` | `#FFFFFF` | KPI cards, row cards |
| `--app-input-bg` | `#F9FAFB` | Form input background |
| `--app-progress-fill` | `#F59E0B` | Progress bar fill (amber) |
| `--app-timer-btn` | `#EC4899` | "הפעלת שעון" button |
| `--app-manual-btn` | `#F97316` | "דיווח ידני" button |

### 1.4 Mobile App

| Token | Hex | Usage |
|---|---|---|
| `--mob-page-bg` | `#F2F2F7` / `#EEEEF3` | Screen background |
| `--mob-card-bg` | `#FFFFFF` | Cards, modal sheets |
| `--mob-brand-pink` | `#E8627A` | Timer button, spinner, accents |
| `--mob-brand-pink-light` | `#F2849A` | Timer button gradient end |
| `--mob-nav-btn` | `#1C2B5A` | Primary nav/CTA buttons (dark navy) |
| `--mob-link-blue` | `#3B82F6` | Links, checkmarks, active items |
| `--mob-orange-fab` | `#FFA500` | Manual report FAB |
| `--mob-badge-absent-bg` | `#D8D8E5` | Vacation/sick/weekend badge bg |
| `--mob-badge-absent-text` | `#555568` | Vacation/sick/weekend badge text |
| `--mob-badge-half-vac-bg` | `#F0D0F8` | Half-vacation+work combined badge bg |
| `--mob-badge-half-vac-text` | `#8830A8` | Half-vacation+work combined badge text |

---

## 2. Typography

### 2.0 Font Strategy (Authoritative)

The Figma design system uses **Inter** as its template font. The actual Hebrew application requires a Hebrew-supporting font. Use the following strategy:

```css
/* Hebrew app font stack */
font-family: 'Heebo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Heebo is Google's Hebrew font inspired by Inter — nearly identical metrics */
/* Inter renders numbers and Latin characters; Heebo handles Hebrew text */
/* Import both from Google Fonts */
```

**Google Fonts import:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 2.1 Type Scale (Figma MCP — Authoritative)

| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| **H1** | 32px | 700 | 1.2 | -0.5px | Page titles |
| **H2** | 28px | 700 | 1.2 | -0.3px | Section titles |
| **H3 / Card Title** | 24px | 600 | 1.2 | 0px | Modal headings, login title |
| **H4** | 20px | 600 | 1.3 | 0px | Card titles |
| **H5** | 18px | 600 | 1.3 | 0px | Form section headers |
| **Body Large** | 18px | 400 | 1.6 | +0.5px | Large text blocks |
| **Body Regular** | 16px | 400 | 1.5 | +0.5px | Standard body |
| **Body Small** | 14px | 400 | 1.5 | +0.25px | Secondary text, labels |
| **Caption / Overline** | 12px | 400 / 600 | 1.4 | 0 / +1.5px | Badges, hints, overlines |
| **Button** | 16px | 600 | 1.5 | 0px | All CTA buttons |

### 2.2 Management Portal Typography

| Style | Size | Weight | Color | Usage |
|---|---|---|---|---|
| Page title | 22–24px | 700 | `#111827` | Main page headings |
| Page subtitle | 13px | 400 | `#6B7280` | Description below title |
| Modal title | 22px | 700 | `#111827` | Modal/dialog headers |
| Table header | 14px | 600 | `#FFFFFF` | Dark header row cells |
| Table body | 14px | 400 | `#1F2937` | Table data cells |
| Form label | 14px | 500 | `#374151` | Input field labels |
| Button | 15–16px | 600 | `#FFFFFF` | Action buttons |
| Badge | 12px | 600 | varies | Status pills |
| Nav item | 14–16px | 600 | `#FFFFFF` | Sidebar navigation |
| Breadcrumb | 12px | 400 | `#374151` | Context breadcrumbs |

### 2.3 Webapp Portal Typography

| Style | Size | Weight | Color | Usage |
|---|---|---|---|---|
| Header title | 16–18px | 700 | `#374151` | Top bar title "דיווח שעות" |
| Month nav | 16px | 600 | `#111827` | Month name in navigator |
| KPI value | 32–36px | 800 | `#111827` | Large KPI numbers |
| KPI label | 11–13px | 500 | `#6B7280` | KPI card sub-labels |
| Section title | 18–20px | 700 | `#111827` | "פירוט יומי" etc. |
| Section subtitle | 13px | 400 | `#6B7280` | Under section title |
| Row date | 14px | 600 | `#374151` | Day row date |
| Status badge | 12px | 600 | varies | Status pills |
| Input label | 12px | 500 | `#6B7280` | Above form fields |
| Tab label | 14px | 600 | varies | Tab navigation |
| Button | 15–16px | 600 | `#FFFFFF` | Primary buttons |
| Progress label | 12–13px | 400 | `#9CA3AF` | Below progress bar |

### 2.4 Mobile Typography

| Style | Size | Weight | Color | Usage |
|---|---|---|---|---|
| Screen title | 18–20px | 700 | `#1A1A2E` | Navigation header title |
| Month name | 16px | 500 | `#1A1A2E` | Month navigator |
| Day date | 15px | 500 | `#1A1A2E` | Row date text |
| Badge text | 12px | 600 | varies | Status pill labels |
| Time range | 14–15px | 500 | `#3B82F6` | Time range in expanded row |
| Duration | 13px | 400 | `#6B7280` | Hours total (gray) |
| Tab label | 14–15px | 500 | varies | Segmented control tabs |
| CTA button | 16–17px | 700 | `#FFFFFF` | Primary action buttons |
| Field label | 15–16px | 500 | `#1A1A2E` | Form row labels |
| Section label | 12–13px | 400 | `#6B7280` | Small section hints |
| Hours abbreviation | any | any | any | Use `ש׳` abbreviation for hours (e.g. `5 ש׳`, `ש׳ 05:30`) |

---

## 3. Spacing & Layout

### 3.1 Management Portal Layout

| Property | Value |
|---|---|
| Sidebar width | 280px (fixed) |
| Page padding | 32px horizontal, 24px vertical |
| Table row height | 48–52px |
| Table header height | 48px |
| Button height | 48px |
| Input height | 44–48px |
| Modal width (create forms) | 600px |
| Modal width (assignment) | 900px |
| Modal border-radius | 12px |
| Card border-radius | 8px |
| Button border-radius | 8px |
| Pill tag border-radius | 9999px |
| Form field gap | 16px |
| Modal padding | 24px |

### 3.2 Webapp Portal Layout

| Property | Value |
|---|---|
| Header height | 60px |
| KPI card padding | 20px |
| KPI card border-radius | 12px (rounded-xl) |
| Row card height | 60–64px |
| Row card border-radius | 12px |
| Modal width | ~830px |
| Modal border-radius | 16px |
| Button height | 48px |
| Button border-radius | 12px (modals) / 9999px (header pills) |
| Tab indicator height | 2px underline |
| Progress bar height | 6px |
| KPI grid | 5 columns, equal width |
| Drawer width | ~460–480px |

### 3.3 Mobile Layout

| Property | Value |
|---|---|
| Status bar | 44px (iOS safe area) |
| Header height | 56–60px |
| Bottom sheet top radius | 20–24px |
| CTA button height | 52–56px |
| CTA button border-radius | 12–14px |
| CTA horizontal margin | 16px |
| Row height | 52–56px |
| Segmented control height | 44px |
| Bottom safe zone | ~80px (fixed bar + safe area) |
| Card border-radius | 12px |
| Modal border-radius | 16px |
| Date chip height | 28–32px |
| Calendar day cell | 44×44px |
| Calendar selected circle | 36px diameter |
| List item padding | 16px horizontal |
| Form field height | 48–52px |

---

## 4. Component Library

### 4.1 Navigation Sidebar (Management)

```
Width: 280px, fixed, full height
Background: #1B2450
Logo: top, "▲ abra" wordmark white + flame icon #F97316
Nav items: 32px height, white text, 14–16px semibold
  - Active item: text bold + orange dot indicator or blue highlight
Divider: thin #FFFFFF10 line between sections
User profile (bottom): avatar circle + name + role text #94A3B8
Sidebar z-index: above content
```

### 4.2 Primary Button

```
Background: #142A3F (active) / #9CA3AF (disabled)
Text: #FFFFFF, 15–16px, weight 600
Height: 48px
Border-radius: 8px (management) / 12px (webapp modal) / 12–14px (mobile)
Padding: 0 24px
Icon: optional ⊕ or arrow, inline with text
Hover (active): background #0F1E2E, box-shadow: 0 4px 12px rgba(20,42,63,0.3), translateY(-2px)
Transition: disabled ↔ active based on form validity
```

### 4.3 Destructive Button

```
Background: #EF4444
Text: #FFFFFF, same as primary
Same dimensions as primary button
Usage: Delete confirmation dialogs
```

### 4.4 Cancel / Secondary Button (management dialogs)

```
Background: #6B7F9E
Text: #FFFFFF
Same dimensions as primary
Usage: Only in confirmation dialogs alongside destructive button
```

### 4.5 Orange CTA Button (webapp header)

```
Background: #F97316
Text: #FFFFFF, 14px, weight 700
Height: 36px
Border-radius: 9999px (pill)
Width: ~130px
Icon: small clock/report icon right of text (RTL: icon on left visually)
Usage: "דיווח ידני" button
```

### 4.6 Pink Timer Button (webapp header)

```
Background: #EC4899 (solid) or gradient #EC4899 → #E879F9
Text: #FFFFFF, 14px, weight 700
Height: 36px
Border-radius: 9999px (pill)
Width: ~140px
Icon: ▶ play icon right of text
Usage: "הפעלת שעון" button
```

### 4.7 Text Input

```
Management:
  Background: #FFFFFF, border: 1px solid #E0E0E0, radius: 8px, height: 48px
  Placeholder: #666666, value: #111827
  RTL: label right-aligned, chevron on LEFT for dropdowns

Webapp:
  Background: #F9FAFB, border: 1px solid #E5E7EB, radius: 8px, height: 40–44px
  Label above field: 12px #6B7280

Mobile:
  Background: #FFFFFF, border: 1px solid #E5E7EB, radius: 8px, height: 48–52px
  Label right-aligned, value left side (RTL layout)
  Time fields use gray pill chip: bg #F3F4F6, radius 8px, tap to open picker
```

### 4.8 Dropdown / Select

```
Same base as text input
Left-side chevron ▼ (RTL: on logical "end" = physical left side)
Open state: floating white card below trigger, box-shadow, radius 10px
Option row height: 44px
Selected option: accent text `#6B2FAA` + filled circle checkmark `#6B2FAA`
Separator: #F3F4F6 between rows
```

### 4.9 Textarea

```
Same border/radius as text input
Min-height: 80px (management/webapp) / 72px (mobile)
RTL text-align: right
Resize: vertical only (or none on mobile)
Placeholder: #666666
```

### 4.10 Modal / Dialog

```
Background: #FFFFFF
Border-radius: 12px (management/mobile) / 16px (webapp)
Overlay: rgba(0,0,0,0.45), full viewport
Max-width: 600px (create forms) / 900px (assignment) / 830px (webapp) / 90vw (mobile)
Shadow: deep, multi-layer

Header layout (RTL):
  - Title: right-aligned
  - Icon button (⊕ or people icon): left end, 40×40px, `#142A3F`, radius 8–10px
  - Close × button: top-left (absolute), 32px circle, #E5E7EB border

Footer: full-width primary CTA, 48–52px height
```

### 4.11 Confirmation / Delete Dialog

```
Centered modal, ~400px wide
Content stack: icon → title → body text → [secondary text-link or cancel btn] → primary btn

Warning icon:
  - Management: red trash icon
  - Mobile: amber square #FEF3C7, triangle-exclamation #D97706, 40×40px, radius 10px
  - Webapp: uses same red/amber patterns

Button layout:
  - Management: Cancel (#6B7F9E) LEFT + Delete (#EF4444) RIGHT
  - Mobile: secondary as underlined text-link + primary CTA button below

Warning (non-destructive): amber icon, amber title, primary btn = navy (#1C2B4B)
Destructive (delete): red icon, buttons = Cancel + Delete
```

### 4.12 Status Badge Pills

All badges: pill shape, height 24–28px, padding 4px 10px, font 12px weight 600

| State | Background | Text color | Icon |
|---|---|---|---|
| חסר (Missing) | `#FEE2E2` / `#FDB5BC` | `#EF4444` / `#E8627A` | red ● dot / red ! circle |
| 9 שעות / 9 ש׳ (Complete) | `#DCFCE7` / `#C8F0D0` | `#16A34A` / `#2A8A4A` | green ✓ circle |
| 7 שעות / 7 ש׳ (Partial) | `#FEF3C7` / `#FFF0C0` | `#D97706` / `#B07000` | amber ● dot / orange ! icon |
| סוף"ש (Weekend) | `#DBEAFE` / `#D8D8E5` | `#2563EB` / `#555568` | blue ● dot / gray ✕ |
| מחלה (Sick) | `#E5E7EB` / `#D8D8E5` | `#374151` / `#555568` | gray ✕ icon |
| יום חופש (Vacation full) | `#D8D8E5` | `#555568` | gray ✕ icon |
| חצי יום חופש (Half vac) | `#D8D8E5` | `#555568` | gray ✕ icon |
| חצי יום חופש + עבודה | `#F0D0F8` | `#8830A8` | purple ? icon |
| מילואים (Military reserve) | `#E5E7EB` | `#374151` | — |

### 4.13 Data Table (Management)

```
Container: white bg, 8px radius, subtle shadow
Header row: bg #1B2340, text white 14px weight 600, height 48px, text-align center
Body rows: bg #FFFFFF, height 48–52px, border-bottom 1px solid #E5E7EB
Hover row: bg #EFF6FF
Selected row (checkbox): bg #EFF6FF, checkbox `#142A3F` filled with ✓
15 rows per page default

Column order (RTL): primary identifier on right, actions on left
Example: [פעולות] ... [שם לקוח] (left→right)

Checkbox: 16×16px, unchecked = white + `#E0E0E0` border + 3px radius
         checked = `#142A3F` filled + white ✓ + same radius

Employee pill tags in cells:
  height: 28px, bg: #F1F3F5, radius: 14px, font: 12px
  Overflow "+N" badge: `#142A3F`
  Overflow tooltip on hover: dark navy #1E2540 bg, white text

Action column "+": circular outline icon `#142A3F`, 24px, centered
```

### 4.14 Pagination

```
Position: centered below table
Style: [|< < [1] [2] [3] ... > >|]
Active page: `#142A3F` bg, white text, rounded
Inactive pages: white bg, `#050804` text
Arrow icons: #6B7280
Font: 14px
```

### 4.15 KPI Summary Cards (Webapp)

```
Layout: 5-column flex grid
Card: white bg, rounded-xl (12px), padding 20px, shadow
Each card contains:
  - Colored icon top-left, ~20px SVG
  - Large number: 32–36px, weight 800, #111827
  - Label above number: 13px, #6B7280
  - Sub-label below: 11px, `#666666`

KPI cards (5):
  1. שעות חודשיות — monthly hours (blue clock icon)
  2. ימי חופשה — vacation days (sun icon)
  3. ימי מחלה — sick days (building icon)
  4. דיווחים חסרים — missing reports (red circle-X icon)
  5. פרויקטים מדווחים — reported projects (briefcase/teal icon)
```

### 4.16 Month Navigator

```
Webapp header:
  Container: white pill, border #E5E7EB, width ~180px, height 36px, rounded-full
  Content: [‹ button] [month name 16px bold] [› button]
  Chevron buttons: 32×32px, gray outlined circles

Mobile header:
  Layout: inline within header bar, left-aligned
  [< button] [אוקטובר text] [> button]
  Arrow icons: #6B7280
```

### 4.17 Progress Bar

```
Height: 6px (webapp) / 4–6px (mobile)
Track bg: #E5E7EB
Fill: #F59E0B (amber/orange)
Fill direction: left-to-right (fills from left as hours are logged)
Dot indicator: 8px circle at fill endpoint, same color #F59E0B
Labels:
  - Right: "X מתוך Y שעות" (current/total)
  - Left: "חסרות Z שעות לדיווח" (remaining)
Font: 12–13px, #9CA3AF / #6B7280
```

### 4.18 Tab Navigation

```
Webapp modal (underline tabs):
  Container: borderless row
  Active tab: text `#6B2FAA`, 2px solid underline `#6B2FAA`, weight 600
  Inactive: text #6B7280, no underline
  Height: ~48px tab area

Webapp/Mobile segmented control (pill tabs):
  Container: #F3F4F6 bg, rounded-lg/full (~8px), height 40–44px
  Active tab: white bg, shadow, dark text #111827, weight 600–700
  Inactive: transparent bg, #6B7280 text, weight 500
  Full-width or content-fitted width

Mobile bottom sheet tabs:
  Same segmented control style
  Two tabs: "דיווח עבודה" | "דיווח היעדרות"
```

### 4.19 File Upload Drop Zone

```
Background: #EFF6FF
Border: 2px dashed #3B82F6
Border-radius: 12px
Padding: 24px
Content (centered):
  - Folder icon: #3B82F6, bg blue circle, ~48px
  - Link text: "לחץ כאן להעלאת הקובץ" blue #3B82F6, underlined
  - Format text: "סוגי הקבצים הנתמכים: JPG / PNG / PDF" smaller, #3B82F6

Uploaded file row (replaces drop zone):
  Height: 56px, bg #FFFFFF, border 1px solid #E5E7EB, radius 8px
  Right: PDF file icon (white paper + red "PDF" badge)
  Center: filename text #111827 14px
  Left: red trash icon #EF4444, tap to delete
```

### 4.20 Bottom Sheet (Mobile)

```
White card slides up from bottom
Top corners: border-radius 20–24px
Bottom corners: 0 (flush with screen edge)
Height: ~90% of screen, or dynamic up to full screen
Drag handle: (implied, not always visible)

Header: height 56–60px, close × top-left (circle #F3F4F6), title centered bold
Tab bar: segmented control below header
Footer: fixed at bottom, z-index above content
  - Progress bar (4px, amber)
  - Stats labels row
  - CTA button (full-width, 52px, navy #1C2B5A)
  - Safe area padding (iOS ~34px)

Status bar darkens when overlay is active (gray #3C3C3C–#6B7280 vs white)
```

### 4.21 Mobile Picker (Project / Task / Location Wizard)

```
Presentation: bottom sheet (partially overlays underlying screen — no full dim)
Sheet header: title centered, `>` close button on left (circular #FFFFFF, 36px)

Grouped list style:
  - Section header: 12px #8E8E93, right-aligned, above card group
  - White card group: radius 12px, full-width with 16px inset
  - Item row: 16px text #1C1C1E, height 48px, separator #E5E5EA
  - Selected item: text `#6B2FAA`, filled check circle 22px on left side
  - No row background change on selection

CTA button:
  - Disabled (no selection): gray #8C8C8C, full-width, 52px, radius 14px
  - Active: navy #1C2B4B, white text
  - Label progression:
    Step 1 (project): "המשך ובחר משימה"
    Step 2 (task): "המשך ובחר מיקום"
    Step 3 (location): "המשך"
```

### 4.22 Inline Calendar (Mobile)

```
Expands inline within the form (not a bottom sheet)
White bg, subtle border, radius 12px
Width: full form width

Header row:
  - `<` `>` month arrows (paired on left/right): `#142A3F`, 24×24px tap targets
  - Month name: right-aligned, 15px, #111827
  - `< YYYY` year link: right of month or same row, `#6B2FAA`

Day headers: 7 columns, abbreviated Hebrew, RTL order (Sunday=rightmost, Saturday=leftmost)
  Colors: `#666666`, 12px
  
Week starts: Sunday (Israeli convention)

Date grid: cells 44×44px
  Regular day: 16px #111827
  Selected: 36px circle `#142A3F` filled, white text
  Range start/end: filled blue circle
  Range in-between: #EFF6FF row highlight
  Other month days: #C7C7CC gray
  
Active field indicator: When calendar is open for start date → date chip turns red #EF4444 to signal "this is being edited"
```

### 4.23 Full Calendar Modal (Mobile — Date Range)

```
Presented as centered overlay modal (not inline)
Overlay: rgba(0,0,0,0.25)
Modal card: white, radius 16px, centered, ~340px wide

Same calendar content as inline (4.22) above
Below calendar: two buttons side by side
  - "נקה" (Clear): white bg, border #E0E0E0, ~25% width, radius 10px
  - "שמירה" (Save): dark navy #1A2B4A, ~72% width, radius 10px, white text
  Both: height 48px
```

### 4.24 Empty State

```
Management portal:
  Centered in table area
  Illustration: person + question marks + plants SVG
  Text: "אין מידע קיים עד כה" ~18px dark
  No button in basic empty state

Webapp modal (empty projects):
  Card: #F9FAFB bg, radius 12px, ~160px tall
  Centered: illustration (plant/succulent), heading, body text
  Heading: 16px weight 600 #050804
  Body: 13px #666666

Mobile (empty/future month):
  Full-screen illustration: woman on calendar, stopwatch (brand pink)
  Arch background panel: slightly darker than page bg, top radius 60px
  Heading: ~24px bold, emoji + Hebrew text
  Body: 14px #5A5A72, centered

Mobile (error/no-data empty):
  Illustration: broken robot (#E8627A pink)
  Heading: ~26px bold with 😅 emoji
  Body: 14px gray
  Link: "חזור למסך ראשי" #3B6FE8 underlined
```

### 4.25 Notification Banners (Mobile)

```
Full-width, pinned below status bar
Top portion flush with status bar; bottom has rounded corners 12px

Success banner:
  Background: #22C55E (vivid green)
  Left: × close icon (white, 20px)
  Right: circular checkmark icon (white, 36px)
  Title: 17–18px bold white, centered
  Body: 13–14px regular white, centered, line-height 1.4
  Dismiss: auto (3–5s) or manual via ×

Info banner (validation hint):
  Background: #3358D4 (medium-dark blue)
  Left: × close icon (white)
  Right: ⓘ circle outline icon (white, 36px, NOT filled)
  Title + body: same as success

Error banner (validation error):
  Background: #EF4444 / #E53935 (red)
  Left: × close icon (white)
  Right: triangle ⚠ outline icon (white, 36px, NOT filled)
  Title + body: same as success

Behavior: banner slides in from top; dismissible via ×; does not dim background
```

### 4.26 Context Menu (Management)

```
White card, 8px radius, box-shadow
Items: 16px, #050804, height 40px, padding 0 16px
Hover: background #EFF6FF
Appears on row right-click or "..." action icon
Contains: Edit (עריכה) + Delete (מחיקה/מחיקת X)
Delete item: #EF4444 text
```

### 4.27 Breadcrumb Trail (Management Modal)

```
Displayed inside assignment modal to show context: Client → Project → Task
Pills: #F3F4F6 bg, radius 6px, font 12px #050804, padding 4px 8px
Separator: `→` arrow, #666666
Example: "EL-AL → Cargo → עיצוב"
```

---

## 5. Screen-by-Screen Specifications

### 5.1 Login Screen

> **Figma MCP component**: `src/components/figma-generated/LoginCard.tsx` + `LoginCard.module.css`  
> **Auth note**: Figma shows Azure SSO. Implementation = email + password per v3.2 FINAL.

**LoginCard — Exact Figma MCP Values:**

```
Container:
  max-width: 400px | min-width: 320px | width: 100%
  padding: 32px 24px
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)
  border: 1px solid rgba(255,255,255,0.18)
  border-radius: 16px
  backdrop-filter: blur(4px)
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.15),
    0 4px 16px rgba(31, 38, 135, 0.10),
    0 2px  8px rgba(31, 38, 135, 0.08),
    0 1px  4px rgba(31, 38, 135, 0.05),
    0 0    2px rgba(31, 38, 135, 0.02)
  animation: slideIn 0.3s ease-out

Illustration slot:
  height: 200px | width: 100% | border-radius: 8px
  background: #F2F2F7 | margin-bottom: 24px

Form:
  flex-column | gap: 16px

Title (Hebrew: "כניסה למערכת"):
  font: Heebo/Inter | size: 24px | weight: 600 | color: #050804
  line-height: 1.2 | margin-bottom: 8px | text-align: right (RTL)

Labels ("דוא"ל", "סיסמה"):
  size: 14px | weight: 500 | color: #050804 | text-align: right

Inputs:
  height: 48px | padding: 12px 16px
  border: 1px solid #E0E0E0 | border-radius: 8px
  background: #FFFFFF | font: 16px regular | color: #050804
  placeholder: color #999999
  direction: rtl | text-align: right

  :focus  → border-color: #6B2FAA | box-shadow: 0 0 0 3px rgba(107,47,170,0.1)
  .error  → border-color: #C33636 | box-shadow: 0 0 0 3px rgba(195,54,54,0.1)
  transition: all 0.2s ease

Error message (animated):
  background: #FEE8E8 | color: #C33636 | border-radius: 8px | padding: 12px 16px
  font: 14px regular | text-align: right
  animation: shake 0.4s ease
    @keyframes shake { 0%,100%: translateX(0); 25%: translateX(-10px); 75%: translateX(10px) }

Submit button (Hebrew: "כניסה"):
  height: 48px | width: 100% | padding: 14px 24px | margin-top: 8px
  background: #142A3F | color: #FFFFFF | border: none | border-radius: 8px
  font: 16px weight 600 | cursor: pointer | transition: all 0.3s ease

  :hover:not(:disabled) → background: #0F1E2E | box-shadow: 0 4px 12px rgba(20,42,63,0.3) | transform: translateY(-2px)
  :active:not(:disabled) → transform: translateY(0)
  :disabled → opacity: 0.6 | cursor: not-allowed

  Loading text: "מתחבר..." | Default: "כניסה"

Entry animation:
  @keyframes slideIn { from: opacity(0) translateY(20px); to: opacity(1) translateY(0) }
  duration: 0.3s | timing: ease-out
```

**Page background** (Management + Webapp):
- Full-bleed city skyline illustration or dark split-photo
- Card centered in viewport: `position: fixed; inset: 0; display: flex; align-items: center; justify-content: center`

**Mobile login** (inside `MobileFrame` component):
- Background: `#1B3A8C` dark blue city skyline illustration
- Card: `background: #EEF2F8` (light blue-gray), `border-radius: 24px`, `width: 88%`
- Logo area + hero illustration (freepik digital illustration asset)
- Same form structure, same field/button specs
- CTA: `background: #1B2E6B` (slightly lighter navy), `border-radius: 12px`

### 5.2 Webapp — Main Monthly Report View

**Route**: `/` or `/reports`

**Header bar** (60px, white #FFFFFF, fixed):
- Right: abra logo + "דיווח שעות" label (16–18px weight 700)
- Center: month navigator pill (border #E5E7EB, rounded-full, ~180px)
- Left: two pill CTA buttons ("דיווח ידני" orange, "הפעלת שעון" pink)

**KPI cards row** (5 cards, flex, ~60px margin-top):
- Each: white, rounded-xl, padding 20px, icon + large number + labels
- When edit panel is open (narrow layout), 4 cards shown (5th "פרויקטים" hidden/collapsed)

**Section block**:
- Title "פירוט יומי" 18–20px bold + subtitle "רשימת הדיווחים לחודש {month} {year}" 13px muted
- Filter dropdown "כל הדיווחים" — small pill, border, dropdown caret

**Daily list**:
- Each row: white card, rounded-xl, height 60–64px
- RTL: right = date/day-name + calendar icon; center = status badge + location badge + project count; left = ‹ chevron
- Status badges per state (see section 4.12)
- Location badges: gray pill, #F3F4F6 bg, #374151 text ("מהמשרד", "מהבית", "מהלקוח")
- Project count chips: #F3F4F6 bg, gray text

**States:**
- Full-width: all 5 KPIs visible, no edit panel
- Edit panel open (wide screen): 2-column layout, main list ~65–70%, panel ~30–35%
- Edit panel open (narrow): full panel overlay or drawer

### 5.3 Webapp — Daily Report Edit (Modal/Drawer)

**Two entry points:**
1. Full modal (centered, ~830px wide)
2. Right side drawer (~460–480px wide, no page dim)

**Modal header row** (RTL):
- Right: calendar icon + date + day name (bold)
- Center: status badge + location chip + project count chip
- Left: trash icon + "מחיקת דיווח" red text + × close button

**Tab bar** (below header):
- "דיווח ידני" | "דיווח העדרות" — underline style in modal, pill style in drawer

**Work Hours section** (collapsible):
- Toggle chevron + "שעות עבודה" label + "תקן יומי X שע׳" green badge
- 3-column input grid: שעת כניסה | שעת יציאה | סה"כ שעות
- Total hours = auto-calculated, may be read-only

**Projects section:**
- Header: "פרויקטים" + pencil edit icon
- Empty state: illustrated card with "הוספת פרויקט" dashed button (dashed border #93C5FD, text #3B82F6)
- Each project entry card (white, rounded-xl, border #E5E7EB):
  - Header row: "פרויקט מס' 1" + collapse chevron + red trash + "מחיקת פרויקט 1"
  - 4-column inputs: פרויקט (dropdown) | משימה (dropdown) | מיקום (dropdown) | שעות (text)
  - Full-width textarea: "פירוט הדיווח" placeholder
- "הוספת פרויקט" dashed-border button at bottom of all project entries

**Summary footer** (sticky inside modal):
- Right: "✨ סיכום:" + total hours + project count pink pill
- Left: "X מתוך Y שעות" + progress bar + "חסרות Z שעות לדיווח"
- Save button: full-width, 48px, `#142A3F` (enabled) / #9CA3AF (disabled)

**Drawer Step 1 (hours only)**:
- "המשך לדיווות פרויקטים" blue CTA instead of project section
- Save button disabled (gray) until Step 2 complete
- Segmented control (pill) for tabs vs underline tabs in modal

### 5.4 Webapp — Absence Tab

**Same modal/drawer structure** as 5.3 but "דיווח העדרות" tab active

Content:
- Minimal: single "סה"כ שעות" field or absence type dropdown
- File upload zone (if applicable)

### 5.5 Management — Admin Tables

**All table pages share layout:**
- Fixed sidebar (left in RTL = visual left, semantic right)
- Top area: title right-aligned + subtitle + action row (search input + create button)
- Table below
- Pagination centered below table

**Create button**:
- "יצירה" + ▼ dropdown arrow (reveals create sub-items)
- Background: `#142A3F`, text white, 36px height, 8px radius

**Search input**:
- ~240px width, pill or rounded, magnifier icon on right (RTL end = left visually)
- Placeholder: "חיפוש לפי שם X"

**Column headers (RTL, right → left)**:
- Always: identifier columns on right, actions on left
- Consistent dark navy header (#1B2340) across all tables

### 5.6 Management — Create/Edit Modals

**Client modal** (יצירת לקוח):
- Title + subtitle + "שם הלקוח" text input + "תאור הלקוח" textarea
- Save button label: "שמירה"

**Project modal** (יצירת פרויקט):
- Fields: שם הפרויקט | שם הלקוח (dropdown) | שיוך מנהל ראשי (dropdown) | תאריך התחלה–סיום (date pair) | תאור הפרויקט
- Date pair: two date inputs side by side, separated by `—` em-dash, format DD/MM/YYYY
- Create button label: "צור פרויקט ⊕" (disabled gray) → "שמור" (active blue) or "שמירה" in edit mode

**Task modal** (יצירת משימה):
- Fields: שם המשימה | שיוך לפרויקט קיים (dropdown) | תאריך התחלה–סיום | תאור המשימה
- Same CTA behavior as project modal

**Assignment modal** (שיוך עובד חדש למשימה) — wider 900px:
- Header: blue avatar icon + title + breadcrumb (Client → Project → Task)
- Search input
- Section label "בחר עובד מהרשימה"
- Employee table: 7 columns (checkbox, מס׳ עובד, שם מלא, תפקיד, סוג, אחוז משרה, שיוך ארגוני)
- Checkbox multi-select pattern (see table section 4.13)
- CTA: "שייך עובד למשימה ⊕" — disabled until ≥1 selected

**Dual mode (create/edit):**
- "עריכה" badge appears next to modal title in edit mode
- CTA label: "צור X" → "שמור" when switching modes

### 5.7 Mobile — Main Time Report List

**Header** (fixed, white, ~56–60px):
- Right: "דיווח שעות" bold 20px
- Left: month navigator `< {month} >`

**Day rows** (accordion):
- Collapsed: height 52px, white card
- Right: day name + date (DD/MM/YY) + icon (briefcase=workday, calendar-X=absence/off)
- Left: status badge + collapse chevron ∨
- Tap: expands to show time entries

**Expanded row:**
- White card (no outer border), 16px padding
- Each time entry sub-row: right = edit link "עריכה" (pencil + blue text) + time range; left = duration + project name
- Horizontal dividers between entries (#E5E7EB, 1px)
- "הוספת דיווח" centered blue text link at bottom (enabled unless full vacation day)

**Day icons:**
- Workday: briefcase/suitcase icon #9CA3AF
- Non-workday/absence: calendar-X icon, dimmed color

**Bottom action bar** (fixed, white, ~80px):
- Right half: "דיווח ידני" label + orange FAB circle (+) ~44–48px
- Left half: timer display OR timer play button
- Active timer: pink-red monospace MM:SS `#E8627A` + stop button circle
- Inactive timer: pink gradient play button circle ~44px
- Vertical divider between halves
- Buttons enabled/disabled per month state:
  - Current month: both active
  - Future month: timer disabled (gray), manual FAB active

**Loading state:** centered pink spinner #E8627A (indeterminate arc), no skeleton list

**Empty states:**
- No reports yet (current month): woman-on-calendar illustration, encouraging copy, timer active
- Future month: same illustration, "לא הגענו לחודש הזה" copy, timer disabled

### 5.8 Mobile — Manual Report Entry (Work Tab)

**Presentation:** bottom sheet (slides up)

**Header:** 
- × close button (circle, #F3F4F6 bg, left-absolute)
- Title "דיווח ידני" centered bold
- Date label right-aligned, small, gray (e.g. "יום ה׳ 06/10/25")

**Segmented tab:** "דיווח עבודה" (right) | "דיווח היעדרות" (left)

**Form — Work Tab:**

Section 1 — Times:
- Daily quota badge: green pill "תקן יומי X שע׳" (#DCFCE7 bg, #16A34A text, clock icon)
- "כניסה" row: label right + time chip left (gray pill, tap → drum picker)
- "יציאה" row: same
- Drum picker (iOS wheel): 3 columns (hour / minute / AM-PM), inline between rows

Section 2 — Projects ("דיווח פרויקטים"):
- Section header: "דיווח פרויקטים" 17px semibold, no bg
- Each project card (white, radius 12px, shadow):
  - פרויקט row → chevron (tap = project wizard)
  - משימה row → chevron
  - מיקום row → ◇ icon
  - שעת התחלה row → time chip
  - שעת סיום row → time chip
  - Notes textarea row (placeholder "הוספת פירוט...")
  - "מחיקת פרויקט" red centered text at bottom of card
- Selected values as pill tags: bg #EFF6FF, text `#6B2FAA`, radius 6px
- Breadcrumb for project: `אל-על` tag → `←` arrow → `Cargo` tag
- "הוספת פרויקט" blue link + ⊕ icon below cards

**Validation states:**
- Required field marker: red `*` inline after label (e.g. "פרויקט*")
- Error banner: red, slides from top, triangle ⚠ icon, title + body
- Info banner: blue, ⓘ icon (validation hint)

**Progress footer (sticky):**
- Stats: "X מתוך Y שעות" (right) + "חסרות Z שעות לדיווח" (left)
- Progress bar: 4px, amber fill, orange dot
- Save button: navy #1C2B5A, 52px, full-width, 12px radius
  - Disabled: not gray; save in work tab specifically stays navy but semantically disabled until required fields filled (unclear — treat as enabled but server validates)

### 5.9 Mobile — Absence Report Entry

**Same bottom sheet + tabs as 5.8**

**Absence tab content:**
- Date label right-aligned
- Absence type dropdown: full-width, 48px, emoji + text, ▼ chevron, options:
  - חופשה - חצי יום 🏖️
  - חופשה - יום מלא 🏖️  
  - מחלה 😷
  - מילואים 🪖
- "צירוף קבצים רלוונטים" section label
- File upload drop zone (see 4.19) OR uploaded file row
- "או" divider + "לדווח על העדרות יותר מיום אחד" nav row → multi-day screen

**Multi-day absence screen:**
- Same bottom sheet, title "דיווח העדרות לפי טווח"
- Header has `>` forward nav button (right side, circle)
- Absence type dropdown
- "מלא את הזמנים" hint text
- "תאריך התחלה" row: label right + date chip left (blue border #3B82F6 when filled, turns red #EF4444 when picker open)
- "תאריך סיום" row: same
- "סה"כ ימי דיווח: X ימים" — auto-calculated, value in blue #3B82F6
- File upload zone
- Save CTA

**Absence dropdown open state:**
- Floating card ~220px, white, shadow, below trigger
- Item height 44px, emoji + text RTL, separator #F3F4F6
- Selected: text + filled circle checkmark both #3B82F6

### 5.10 Mobile — Confirmation / Warning Dialogs

**Delete project confirmation:**
- Modal centered, ~80% width, white, radius 16px
- Overlay: rgba(0,0,0,0.40)
- Icon: amber square 40×40px #FEF3C7, triangle-exclamation #D97706
- Title: ~17px semibold centered "למחוק את פרויקט זה מהדיווחים?"
- Body: ~13px #6C6C70 centered
- Secondary action: underlined text link "מעדיף שלא למחוק" (safe escape)
- Primary button: "מחק את הפרויקט" navy #1C2B4B, 52px, full-width

**Incomplete workday warning:**
- Same structure, amber icon
- Title: "יום העבודה שלך טרם הושלם."
- Body: "חסרות {X} שעות דיווח כדי לסגור את היום."
- Secondary text-link: "צא בכל זאת"
- Primary button: "תן לי להשלים את השעות"
- Triggered on close/navigate-away when required hours not met

### 5.11 Mobile — Empty / Error States

**No tasks available:**
- Full-screen
- Broken robot illustration (coral pink #E8627A)
- Title: "אופססס... 😅" ~26px bold #1A1A2E
- Body: ~14px #5A5A72
- Link: "חזור למסך ראשי" #3B6FE8
- CTA: disabled gray

**Special day states on report list:**
- Full vacation: "יום חופש" — gray badge, "הוספת דיווח" disabled/gray
- Half vacation: "חצי יום חופש" — gray badge, "הוספת דיווח" enabled (can add work hours)
- Half vacation + work hours: purple badge "חצי חופש/4.5 ש׳"
- Combined hours: time entry "חצי יום חופש" appears as a special entry type alongside project entries

---

## 6. Interaction Patterns

### 6.1 Form Validation

```
All portals:
- Submit button disabled (gray #9CA3AF) when required fields empty
- Submit button active (blue/navy) when all required fields filled
- Required field indicator: red * after label text (mobile) or standard browser behavior (desktop)

Mobile-specific:
- Validation error → red banner slides from top
- Validation hint → blue banner slides from top
- Banners dismissible via × and auto-dismiss after ~3–5s
```

### 6.2 Unsaved Changes Guard

```
When navigating away from a partially filled report form:
- Mobile: "יום העבודה שלך טרם הושלם" warning dialog
- Webapp: (toast or dialog — implement as browser onbeforeunload + custom modal)
- Management: standard browser confirm dialog or custom modal
```

### 6.3 Delete Confirmation

```
Two-button dialogs for all destructive actions:
- Management: Cancel (gray) + Delete (red) side by side
- Mobile: Text-link "cancel" + Primary button "delete"
Both: warn user about irreversibility in body text
```

### 6.4 RTL Rules

```
html[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

Key RTL-specific rules:
- Chevrons/arrows pointing LEFT (‹ <) = "forward/expand" in RTL
- Chevrons pointing RIGHT (> ›) = "back/close"
- Table columns: identifier on right, actions on left
- Breadcrumbs: right → left (Client → Project → Task reads right-to-left)
- Dropdown carets: on physical LEFT (logical end)
- Modals: close X top-left, blue icon button top-left
- Bottom sheets: close × on left, title centered
- Flex rows: use direction: rtl or flex-direction: row-reverse
- Form labels: right-aligned
- Status badges: right side of rows
- Action buttons/chevrons: left side of rows
- Date chips: right = label, left = chip value
- Wizard: breadcrumb arrows `→` point LEFT (source → destination reads right-to-left)
```

### 6.5 Accessibility

```
Touch targets: minimum 44×44px (all interactive elements)
Contrast: Primary text on white ≥ 4.5:1 (verified for #111827 on #FFFFFF)
Focus: visible focus ring (blue outline or blue shadow)
ARIA: dir="rtl" on root, lang="he"
Keyboard: modal focus trap, Escape to close
```

---

## 7. Screen Navigation Map

### 7.1 Webapp Flow

```
/ (Home = Monthly Report)
├── Day row tap → opens Edit Drawer/Modal (same route, overlay)
│   ├── Tab: "דיווח ידני" (Work Report)
│   │   ├── Step 1: Time entry
│   │   └── Step 2: Project entries
│   └── Tab: "דיווח העדרות" (Absence)
└── Month navigator → change month
```

### 7.2 Management Flow

```
/admin/users          ← F04
/admin/clients        ← F05 (with create/edit modal)
/admin/projects       ← F06 (with create/edit modal)
/admin/tasks          ← F07 (with create/edit modal)
/admin/assignments    ← F08 (שיוך עובד למשימה)
/admin/reports        ← F14 (Review & Approve)
/admin/month-lock     ← F15
/admin/dashboard      ← F16
/admin/audit          ← F17
/admin/export         ← F18
/admin/settings       ← F19 (includes time-report type settings: הגדרת דיווחי שעות)
```

### 7.3 Mobile Flow

```
Screen: Login (auth screen, bottom-sheet style or full screen)
Screen: Monthly Report List (main screen)
  ├── Tap day row → expand/collapse accordion
  │   └── Tap "עריכה" → Manual Report bottom sheet
  │       ├── Work tab → Project picker wizard
  │       │   ├── Step 1: Project (bottom sheet grouped list)
  │       │   ├── Step 2: Task (bottom sheet flat list)
  │       │   └── Step 3: Location (bottom sheet 3-item list)
  │       └── Absence tab → single/multi-day forms
  ├── Tap "דיווח ידני" FAB → Manual Report bottom sheet (same as above)
  └── Tap "הפעלת שעון" FAB → Start/stop timer
      └── Long running: 10h warning notification
```

---

## 8. Figma Annotation Reference

| Group/Layer | Content |
|---|---|
| `managment_Group_927` | Nav label: "מסך התחברות - LOG-IN" |
| `managment_Group_928` | Nav label: "שיוך עובד למשימה" |
| `managment_Group_929` | Nav label: "הגדרת דיווחי שעות" |
| `managment_Group_930` | Annotation: "אופציה א / ב / ג" (3 modal header style variants) |
| `managment_Group_931` | Label: "מודאל - יצירת לקוח - בלי ערכים" (Create Client empty) |
| `managment_Group_932` | Label: "מודאל - יצירת פרויקט - בלי ערכים" (Create Project empty) |
| `managment_Group_933` | Label: "מודאל - יצירת משימה - בלי ערכים" (Create Task empty) |
| `managment_Group_934` | Label: "מודאל - יצירת לקוח - עם ערכים" (Create Client filled) |
| `managment_Group_935` | Label: "מודאל - יצירת פרויקט - עם ערכים" (Create Project filled) |
| `managment_Group_936` | Label: "מודאל - יצירת משימה - עם ערכים" (Create Task filled) |
| `managment_Group_937` | Annotation: hover states + delete/edit dropdown states |
| `webapp_Group_1` | Figma section divider: "Mobile" |
| `webapp_Group_2` | Figma section divider: "Desktop" |
| `mobile_1.1-26` | Design annotation: "דוגמה לחצי יום חופשה +4.5 שעות" |

---

## 9. CSS Custom Properties Summary

> **Also available**: `PIXEL_PERFECT_CSS.css` in the workspace root contains the full production-ready CSS reference generated from the Figma MCP. Use it as the authoritative CSS token file.

```css
:root {
  /* ── Figma MCP Authoritative Colors ─────────────────────────── */
  --color-brand-purple: #6B2FAA;          /* focus ring, brand accent */
  --color-brand-purple-80: rgba(107, 47, 170, 0.8);
  --color-brand-purple-ring: rgba(107, 47, 170, 0.1); /* focus box-shadow */
  --color-nav-button: #142A3F;            /* primary CTA / nav buttons */
  --color-nav-button-hover: #0F1E2E;      /* button hover/active */
  --color-text-body: #050804;             /* near-black body text */
  --color-text-secondary: #666666;        /* captions, hints */
  --color-border-input: #E0E0E0;          /* input borders */
  --color-error-bg: #FEE8E8;             /* error message background */
  --color-error-text: #C33636;           /* error text */
  --color-shadow-base: #1F2687;          /* shadow color (blue-purple) */
  --color-dark-bg: #1C1C1E;             /* dark mode page bg */
  --color-dark-surface: #2C2C2E;        /* dark mode surface/status bar */

  /* ── Shared Semantic Colors ──────────────────────────────────── */
  --color-primary: #2563EB;
  --color-primary-light: #EFF6FF;
  --color-primary-dark: #1D4ED8;
  --color-danger: #EF4444;
  --color-danger-bg: #FEE2E2;
  --color-success: #16A34A;
  --color-success-bg: #DCFCE7;
  --color-warning: #D97706;
  --color-warning-bg: #FEF3C7;
  --color-disabled: #9CA3AF;
  --color-border: #E5E7EB;
  --color-text-primary: #111827;
  --color-text-muted: #6B7280;
  --color-text-placeholder: #9CA3AF;
  --color-overlay: rgba(0, 0, 0, 0.45);
  --color-brand-orange: #F97316;
  --color-brand-pink: #EC4899;
  --color-progress-fill: #F59E0B;

  /* ── Portal-Specific ─────────────────────────────────────────── */
  --mgmt-sidebar: #1B2450;
  --mgmt-table-header: #1B2340;
  --mgmt-page-bg: #F3F4F6;
  --mgmt-cancel-btn: #6B7F9E;
  --app-page-bg: #F2F3F7;
  --app-input-bg: #F9FAFB;
  --mob-page-bg: #F2F2F7;
  --mob-brand-pink: #E8627A;
  --mob-nav-btn: #1C2B5A;
  --mob-link-blue: #3B82F6;
  --mob-orange-fab: #FFA500;

  /* ── Typography ─────────────────────────────────────────────── */
  --font-base: 'Heebo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 24px;
  --font-size-h1: 32px;
  --font-size-kpi: 36px;

  /* ── Spacing (4px base scale) ────────────────────────────────── */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-3xl: 64px;

  /* ── Border Radius ───────────────────────────────────────────── */
  --radius-sm: 8px;    /* inputs, small cards */
  --radius-md: 16px;   /* login card, modal */
  --radius-lg: 40px;   /* mobile frame corners */
  --radius-pill: 9999px;

  /* ── Shadows (Figma MCP Authoritative) ──────────────────────── */
  --shadow-card:
    0 8px 32px rgba(31, 38, 135, 0.15),
    0 4px 16px rgba(31, 38, 135, 0.10),
    0 2px  8px rgba(31, 38, 135, 0.08),
    0 1px  4px rgba(31, 38, 135, 0.05),
    0 0    2px rgba(31, 38, 135, 0.02);
  --shadow-button-hover: 0 4px 12px rgba(20, 42, 63, 0.30);
  --shadow-phone: 0 20px 60px rgba(0, 0, 0, 0.15);

  /* ── Transitions ─────────────────────────────────────────────── */
  --transition-fast: all 0.2s ease;
  --transition-normal: all 0.3s ease;

  /* ── Component Heights ───────────────────────────────────────── */
  --height-btn: 48px;
  --height-input: 48px;   /* 44px content + 2×2px border */
  --height-row: 52px;
  --height-header: 60px;
  --height-mob-btn: 52px;
  --height-mob-header: 56px;
}
```

---

*Last updated: Based on full analysis of 120 Figma export PNGs from `_previews/`*  
*Covers: Management portal (33 images), Webapp portal (54 images), Mobile (33 images)*
