# Design notes

Source: Levan's references in `design/references/` (no Figma file yet). We take the *style*, never another product's name, logo, icons or illustrations.

## Direction
- Light by default, dark theme available (toggle). Soft grey page background, white rounded cards with a hairline border, very light shadows.
- Main colour **green** (Flup, SUB QC, ClubReady all use it). Blue is used only for "info" / confirmed status.
- Sidebar (desktop): white, product name at top, items grouped into small labelled sections, active item = pale green background + green text, user/business card at the bottom.
- Phone: top bar (business + language) and bottom navigation, max 5 items; tables become stacked cards; detail panels become bottom sheets.
- Lists: filter tabs with counts (Flup), search + filters row, coloured status pills, row click opens a details panel from the right (Flup), not a new page.
- Dashboard: number cards with a small tinted icon chip and an arrow button (SUB QC / PolicyPilot).
- Calendar (Phase 3): staff as columns with photo + position, coloured blocks per booking, red current-time line, small month calendar beside it, List/Day/Week/Month switcher (ClubReady).

## Fonts
FiraGO for everything (decision 022): one family with Georgian Mkhedruli + Mtavruli, Latin and Cyrillic, weights 400–700, self-hosted from `src/app/fonts` and trimmed to those alphabets. (Until 2026-11-08: Inter + Noto Sans Georgian.) Georgian text is longer — no fixed widths for text.

## Tokens
`design/tokens.json` → `src/app/globals.css` (`:root` + `.dark`) → Tailwind theme. Components use tokens only: `bg-primary`, `text-muted-foreground`, `bg-success-soft`, `bg-staff-teal`…
- Status tokens: `success`, `warning`, `info`, `destructive`, each with a `-soft` background for pills.
- Staff colours are stored in the DB as names (`green`, `teal`, …), never hex, so the palette can change in one place and works in both themes.

## Price lists (references 10, 11)
Real Georgian price lists have: category header rows, prices like `35`, `25-დან` (from 25), `250–300` (range), `150–200-დან`, and **no durations**. The importer accepts pasted tables and files, recognises these formats, and asks for a duration where it is missing.

## Components (shadcn, restyled via tokens)
Button, Input, Select, Checkbox, Switch, Textarea, Badge/StatusPill, Card, StatCard, Dialog, Sheet, Tabs (with counts), Table (→ cards on phone), Toast, Avatar (staff colour ring), EmptyState, Skeleton, PageHeader, Sidebar, BottomNav.
