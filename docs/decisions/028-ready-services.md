# 028 — Ready services by business type

**Context.** Rezervo pre-fills services per business type at sign-up (2026-11-12 review). Visito only had an empty list, a manual form and a spreadsheet import.

**Decision.**
- **Templates** live in code: `src/features/services/templates.ts`.
  - 7 business types: hair salon, barbershop, nails, brows & lashes, cosmetology, massage & spa, dental.
  - Each has categories and services with names in ka/en/ru, a duration and a suggested Tbilisi price. Some are "from" prices.
- **The page** `/services/templates` is linked from the Services header and its empty state.
  - The owner picks a type, ticks services, edits the price and duration, and adds them.
  - The business's own type is preselected.
- **Adding** goes through `add_template_services`, owner/admin only. A category is matched by its Georgian name or created. A service whose Georgian name already exists is skipped, so adding twice changes nothing.

**Consequence.**
- Services are added after sign-up, not during it, so the sign-up stays short.
- The suggested prices are rough and are always shown as editable suggestions.

**Changed (Levan, 2026-11-12): hybrid instead of a separate page.** The `/services/templates` page is gone. Manual adding stays as it was ("New service"), and ready services show up in two places:
- **On the Services page:** a "Ready services" box under the list, open when there are no services and folded otherwise. You pick a business type and add any single service with one click (at the suggested price; change it afterwards). Services already there are marked "already added".
- **In the New service form:** "Start from a ready service" fills in the names (ka/en/ru), duration, price type and category; everything stays editable before saving.
