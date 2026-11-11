# Payroll — plan (2026-11-11)

Levan's choices:
- Payroll unlocks on **Pro (Standard) and Clinic**, plus the free trial.
- Version 1 has **pay schemes**, **tips, bonuses and deductions**, and **monthly payslips with payouts**.
- Businesses without it see the menu item with an **"upgrade" page**.

## What is built (step 1)
1. **Plan features:** a Payroll switch per plan in `/admin/plans`. The app and the landing price cards follow it.
2. **Pay settings** (`/payroll/settings`), set per specialist:
   - fixed salary per month
   - default % of services
   - a different % for a category or a service
3. **Payroll** (`/payroll`):
   - month by month, with three totals: earned this month, paid, still to pay
   - a row per specialist with:
     - services and commission
     - salary
     - tips and bonuses
     - the total and what is still to pay
4. **Payslip panel** for one specialist:
   - every line: salary, one line per %, tips, each bonus and deduction
   - the total
   - payments made (each can be removed after a confirmation)
   - what is still to pay, or "paid more than earned"
   - forms to **record a payment** and to **add a bonus or deduction**
5. **Excel** for the accountant: a summary sheet and a detail sheet.
6. **Safety:**
   - database rules on every table: owner, or admins with revenue rights, and only when the plan includes payroll
   - staff are always kept out
   - every change is written to the audit log

## Later (step 2, not built)
- Staff see their own payslip ("My pay").
- Pay periods other than a calendar month (two weeks, custom).
- Close a month, so later edits to visits don't change it.
- Commission on product sales (needs inventory first).
- Salary for part of a month (someone starting mid-month).
