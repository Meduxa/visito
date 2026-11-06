---
name: figma-to-ui
description: Use when turning Levan's screenshots or Figma designs into Visito's design system or screens — extracting colours, fonts, spacing and components from Figma, restyling components, or building a new screen that has a Figma frame or reference screenshot. Keeps the UI consistent through design tokens.
---

# Figma → Visito UI

The visual style comes from Levan's **reference screenshots** (`design/references/`) and his **Figma file**. Do not invent a different style. Take the *style* of references — never copy another product's logo, name, icons, illustrations or brand.

## 0. Make sure Figma is reachable

- Check whether Figma MCP tools are available in this Claude Code session.
- If not, tell Levan to run this in PowerShell inside the project folder, then restart Claude Code and log in to Figma when asked:
  ```
  claude mcp add --transport http figma https://mcp.figma.com/mcp
  ```
- If Figma still can't be reached, work from the screenshots in `design/references/` (read them as images) and say so.

## 1. Order of work

1. **Read** `design/references/README.md` (what Levan likes about each screenshot) and view every screenshot.
2. **Tokens first.** From Figma variables/styles (or screenshots if no variables exist), extract:
   - colours: background, surface, surface-muted, border, text, text-muted, primary, primary-foreground, accent, success, warning, danger, info, plus **calendar status colours** (pending, confirmed, arrived, in progress, completed, cancelled, no-show) and **8–12 staff colours** that work on both light and dark backgrounds
   - typography: font family (must fully support **Georgian Mkhedruli** — check every weight; good candidates: Noto Sans Georgian, FiraGO, BPG fonts, Inter for Latin + a Georgian pairing), sizes, weights, line heights
   - spacing scale, radius scale, shadows, breakpoints
3. Write them to `design/tokens.json`, then generate CSS variables in `src/app/globals.css` (`:root` + `.dark` if a dark theme is designed) and map them in the Tailwind theme / shadcn variables. **Components only use tokens** — no hex values, no arbitrary pixel values in components.
4. **Components** next (restyle shadcn primitives, then app components): Button (variants + sizes + loading), Input, Textarea, Select/Combobox, Checkbox, Switch, Radio, Date picker, Time picker, Phone input (+995), Money input (₾), Badge/StatusPill, Card, Dialog, Sheet (mobile bottom sheet), Tabs, Table (sortable, mobile → cards), Toast, Avatar (with staff colour ring), EmptyState, Skeleton, PageHeader, Sidebar, BottomNav (mobile), BookingCard (calendar block), ClientRow.
5. **Screens last**, one at a time, matching their Figma frame.

## 2. Implementing a screen from Figma

1. Get the frame (node) from the Figma link Levan gives; fetch its design context and a screenshot.
2. Treat generated code as a **reference, not final code**: re-express it with our components, tokens, Tailwind classes, `next-intl` messages and real data.
3. Layout: use flex/grid like Figma Auto Layout; never absolute positioning for layout.
4. **Responsive**: if Figma has only desktop, design the mobile version by these rules and show Levan:
   - sidebar → bottom navigation (max 5 items: Calendar, Clients, + New booking, Services, More)
   - tables → stacked cards
   - dialogs → bottom sheets
   - calendar day view → agenda list with day switcher
   - touch targets ≥ 44px
5. **Georgian text is longer** than English: never fix widths for text; test every screen with Georgian strings; allow wrapping in buttons and table headers.
6. States: hover, focus-visible, active, disabled, loading, empty, error — even if Figma doesn't show them; derive from tokens.

## 3. Visual check before saying "done"

- Compare our page with the Figma screenshot at **1440px** and **375px** (Playwright screenshot or browser). List the differences you see and fix the important ones (spacing, sizes, colours, alignment).
- Check contrast (text vs background ≥ 4.5:1; large text ≥ 3:1).
- Check both themes if dark mode exists.
- Show Levan the result (how to open it) and ask for feedback before moving to the next screen.

## 4. Changing the design later

- A colour/font/spacing change = change the token in Figma → update `design/tokens.json` → regenerate CSS variables. Never patch individual components.
- Keep a short `design/DESIGN_NOTES.md`: chosen fonts, why, token names, component list, decisions.
