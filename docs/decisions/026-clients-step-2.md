# 026 — Clients step 2: own fields, group numbers, columns, quick note, export, booking from the card

**Context.** Levan (2026-11-11) asked for five items of Clients step 2 (plan `docs/plans/clients-section.md`): own fields (EasyWeek's custom attributes), group thresholds as a setting, choosing columns, a quick note in the list (Visage), and an export of the current view. He also asked for "new booking" from the card.

**Decision.**
- **Own fields.**
  - `client_fields` is per business: label, kind (`text` / `number` / `date` / `choice` / `yesno`), the choices, and the order. There are at most 20, enforced by a trigger.
  - Every member reads them; the owner or an admin writes them.
  - Values sit in `clients.custom jsonb` as `{field id: value}`, under the same rules as the rest of the card. `cleanCustom` keeps only known fields in the right type.
  - Removing a field erases its values from every card (trigger).
  - Erasing a client (`anonymize_client`) clears own fields. Merging keeps both cards' values, and the kept card wins.
  - A field's kind cannot change after it exists; only the name and choices can.
- **Group numbers** sit in `tenant_settings`: VIP from N visits (default 5), at risk after N days (60), lost after N days (180). The database checks that "lost" is more than "at risk".
  - `client_list` reads them; the view was dropped and created again because `c.*` gained `custom`.
  - "New" stays fixed at 0–1 visits.
- **Columns** are chosen per browser, in an httpOnly cookie `vc_client_cols` (no personal data). The name is always first. Money columns show only to people who may see revenue.
  - The choice applies to the desktop table. Phone cards stay the same.
- **Quick note.** A note button at the end of each row (owner/admin) edits `clients.notes` in place.
- **Excel download** (`/api/export/clients`) gives exactly the view on screen: search, group, filters and sorting, all pages, up to 10,000 rows.
  - The columns: name, phone and email, then the chosen columns and tags.
  - Owner/admin only. Each download is written to the audit log (number of rows and filters, no names).
- **"New booking" from the card** opens `/calendar?for=<client>`. The calendar loads that client under the normal rules and opens the booking form with them filled in.

**Consequences.**
- Columns don't follow a person to another device. If that's wanted later, store them per member.
- Own fields are not asked on the online booking page yet.
- Tests:
  - `supabase/tests/rls_clients_step2.test.ts`
  - `src/features/clients/fields.test.ts`
  - `e2e/clients-step2.spec.ts`
