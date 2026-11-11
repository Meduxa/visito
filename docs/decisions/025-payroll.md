# 025 — Payroll, only in plans that include it

**Context.** Levan (2026-11-11) asked for payroll, available only to businesses on a higher plan. EasyWeek sells salary schemes and payouts in its top plan; Visage has none. SPEC §7 had payroll out of scope for v1 — this decision brings it in (plan: `docs/plans/payroll.md`).

**Decision.**
- **Plans get paid features.** `plans.features text[]` (only `payroll` for now), switched per plan in `/admin/plans`. `tenant_has_feature(tenant, feature)` reads the business's plan. Payroll is on for `pro` (named "Standard" on dev), `clinic` and `trial`. Trial is included so new businesses can try everything.
- **Who.** `can_use_payroll(tenant)` = `can_see_revenue` (owner; admins while "admins see revenue" is on) **and** the plan includes payroll. Every pay table has one policy per command using it. Staff never read pay. After a downgrade the rows stay but are locked; upgrading shows them again.
- **What a specialist earns in a month** (pure `computePayroll`, unit-tested):
  - the fixed salary
  - plus % of completed services
  - plus tips from checkout
  - plus bonuses, minus deductions
- **Which % applies.** The service's own rate; else its category's rate; else the default %. The default % is the existing `staff.commission_pct`, so there is one source and reports keep matching.
- **Service value.** The service price minus its share of the booking discount. The discount is split by price and the shares add up exactly.
- **Timing.** A visit counts in the month it took place, in the business time zone. A tip counts in the month it was paid.
- **Monthly periods only.** Payouts record money paid for a month: amount, cash / transfer / card, date and note. Balance = earned − paid. An advance (paid more than earned) shows on that person and does not lower the total still owed.
- **Tables.** `staff_pay` (salary), `staff_pay_rates` (category or service %), `pay_adjustments` and `payouts`. Every change is written to `audit_log` by a trigger.
- **Locked view.** A business whose plan lacks payroll sees the menu item and an "upgrade" page. It lists what payroll does and the names of the plans that include it.

**Consequences.**
- Changing a plan's features in `/admin/plans` takes effect at once for every business on that plan, in the app and on the landing price cards.
- Not in v1:
  - pay periods other than calendar months
  - commission on product sales (no products yet)
  - staff seeing their own payslip
  - a locked, closed month: editing an old visit changes that month's numbers, and the balance shows it
- Tests:
  - `supabase/tests/rls_payroll.test.ts`
  - `src/features/payroll/compute.test.ts`
  - `e2e/payroll.spec.ts`
