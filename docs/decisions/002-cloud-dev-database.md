# 002 — Development database in Supabase Cloud, not Docker

**Context.** Levan's work laptop has no administrator rights, so Docker Desktop (needed for `supabase start`) cannot be installed.

**Decision.** Development uses a separate Supabase Cloud project `visito-dev` in Frankfurt with demo data only. Migrations are pushed with `supabase db push`. RLS tests are Vitest integration tests (`supabase/tests/*.test.ts`) that create throwaway users and tenants through the real API and delete them afterwards, instead of pgTAP. Demo data is seeded by `scripts/seed.ts` (it needs the Auth admin API to create sign-in users), not `supabase/seed.sql`.

**Consequence.** Development and tests need internet; tests are slower (network). Free projects pause after ~7 days idle (click Restore). Production will be a second, separate project. If Docker becomes available later, `supabase start` works with the same migrations.
