# 024 — Client list: visit numbers and automatic groups

**Context.** Visage and EasyWeek show visit numbers and client groups in the client list. Visito showed only name, phone, consent and the date added (plan: `docs/plans/clients-section.md`).

**Decision.**
- **The `client_list` view** (`security_invoker`) gives every client:
  - **visits:** completed visits
  - **last visit:** the last completed visit
  - **next visit:** the next pending or confirmed visit
  - **cancellations**
  - **spent:** the total of completed visits, after discount. Imported history counts.
  - **average:** spent ÷ visits
  - **first booking**
  - **an automatic group**
  - **birthday month**, used by the filter
- **Rights.** The view reads with the caller's own rights, so RLS works as everywhere else: staff see only their own clients and their own bookings. Spent and average are null unless `can_see_revenue(tenant)`, which is true for the owner, and for admins while "admins see revenue" is on.
- **Groups, in this order:**
  - last visit over 180 days ago → `lost`
  - last visit 60–180 days ago → `at_risk`
  - 0–1 visits → `new`
  - 5+ visits → `vip`
  - otherwise → `regular`

  The thresholds are fixed for now; a setting can come later.
- **The list's view lives in the address:** `?segment=…&tag=…&upcoming=1&birthday=1&noshow=1&sort=added|name|last_visit|visits|spent&q=…&page=…`. Unknown values fall back to the default. Sorting by spent is only for people who may see money.
- **Money format.** `formatMoney` now writes numbers by hand, with the same rules as Intl ka-GE / ru / en. The browser pane's Chromium has no Georgian number data and wrote "32.78" where the server wrote "32,78". The page then rebuilt itself after loading (a hydration error), and clicks in the meantime were lost.

**Consequences.**
- One query per page, plus 5 group counts. Each count works out the numbers for every client of the business. That is fine for salons of a few thousand clients (index `bookings_client`); a stored summary table can come later if needed.
- The demo seed now has a year of past visits, so every group shows.
- Tests: `supabase/tests/rls_client_list.test.ts`, `e2e/clients.spec.ts`.
