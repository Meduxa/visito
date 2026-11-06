---
name: tenant-security
description: Use for ANY database change in Visito — new table, column, migration, RLS policy, storage bucket, server action or API route that reads or writes tenant data. Enforces multi-tenant isolation with Supabase Row Level Security and proves it with tests.
---

# Tenant security (multi-tenant isolation)

Visito stores many salons and clinics in one database. A leak between tenants would end the business. Follow every step, every time.

## 1. Table checklist

Every table holding business data must have:

```sql
create table public.example (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  -- ...columns...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.example (tenant_id);
alter table public.example enable row level security;
alter table public.example force row level security;
```

Add the shared `updated_at` trigger.

## 2. Helper functions (create once in Phase 0)

```sql
-- tenants the current user belongs to
create or replace function public.user_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships
  where user_id = auth.uid() and status = 'active'
$$;

-- role check
create or replace function public.has_role(p_tenant uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and tenant_id = p_tenant
      and status = 'active' and role = any(p_roles)
  )
$$;
```

## 3. Policy patterns

Write **separate policies per command** (select / insert / update / delete). Never use one `for all` policy with `using (true)`.

```sql
-- read: any member of the tenant
create policy example_select on public.example for select
  using (tenant_id in (select public.user_tenant_ids()));

-- write: owner/admin only
create policy example_insert on public.example for insert
  with check (public.has_role(tenant_id, array['owner','admin']));

create policy example_update on public.example for update
  using (public.has_role(tenant_id, array['owner','admin']))
  with check (public.has_role(tenant_id, array['owner','admin']));

create policy example_delete on public.example for delete
  using (public.has_role(tenant_id, array['owner']));
```

Special cases:
- **Staff seeing only their own bookings** (when tenant setting `staff_sees_all_bookings = false`): add `staff_id = public.current_staff_id(tenant_id)` for role `staff`.
- **Revenue/payments**: hide from `staff` unless the setting allows it.
- **`dental_notes`**: select only for owner + staff with `position_type = 'doctor'`; every read is logged in `audit_log` through a security-definer function (`read_dental_notes(client_id)`); no direct table select for the client.
- **Public booking page**: never give `anon` access to tables. Use **security-definer RPC functions** that return only the public fields needed (`get_public_business(slug)`, `get_availability(...)`, `create_public_booking(...)`), validate inputs, and rate-limit.
- **`audit_log`**: insert through a function only; no update/delete for anyone.
- **Storage buckets**: path must start with `{tenant_id}/`; policies check that the first folder is in `user_tenant_ids()`.

## 4. Server code rules

- Never accept `tenant_id` from the client as truth. Resolve the active tenant on the server from the user's session + membership (active tenant stored in a cookie, re-validated on every request).
- Use the **user-scoped** Supabase client (RLS applies) for normal work. The **service-role** client is allowed only in: background jobs, webhooks, platform-admin actions — and must filter by `tenant_id` explicitly and write to `audit_log`.
- Validate every input with zod before touching the DB.
- Never return raw DB errors to the browser; log them, show a friendly message.

## 5. Required tests for every new table

Create/extend `supabase/tests/rls_<table>.sql` (pgTAP) or an equivalent Vitest integration test using two seeded tenants (A and B) and users with each role:

1. User of tenant A **can** read A's rows.
2. User of tenant A **cannot** read B's rows (returns 0 rows, not an error).
3. User of tenant A **cannot** insert a row with `tenant_id = B`.
4. User of tenant A **cannot** update/delete B's rows.
5. `staff` cannot do owner/admin-only writes.
6. `anon` cannot select anything directly.

The phase is not done until these pass.

## 6. Review question before finishing

Ask yourself and answer in the summary: *"If a logged-in user of salon A edited the request in their browser, what is the worst they could see or change?"* The correct answer is "nothing outside salon A".
