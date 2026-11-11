-- Payroll (decision 025, plan docs/plans/payroll.md).
--
-- 1. Plans get a list of paid features. Payroll is the first one: on for Pro,
--    Clinic and the free trial (so new businesses can try it); Levan changes
--    this per plan in /admin/plans.
-- 2. Pay scheme per specialist: fixed monthly salary + % of services. The
--    default % is the existing staff.commission_pct; a % per category or per
--    service overrides it.
-- 3. Per month: bonuses and deductions, and payouts (what was paid, when, how).
--
-- Who: owner, and admins while "admins see revenue" is on (can_see_revenue),
-- and only while the business's plan includes payroll. Staff never read pay
-- tables. After a downgrade the rows stay but cannot be read or changed until
-- the plan includes payroll again.

-- ---------------------------------------------------------------------------
-- Plan features
-- ---------------------------------------------------------------------------
alter table public.plans
  add column features text[] not null default '{}'
  check (features <@ array['payroll']::text[]);

update public.plans set features = array['payroll'] where code in ('trial', 'pro', 'clinic');

create or replace function public.tenant_has_feature(p_tenant uuid, p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenants t
    join public.plans p on p.code = t.plan
    where t.id = p_tenant and p_feature = any (p.features)
  )
$$;

create or replace function public.can_use_payroll(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_see_revenue(p_tenant) and public.tenant_has_feature(p_tenant, 'payroll')
$$;

revoke execute on function public.tenant_has_feature(uuid, text) from public, anon;
revoke execute on function public.can_use_payroll(uuid) from public, anon;
grant execute on function public.tenant_has_feature(uuid, text) to authenticated, service_role;
grant execute on function public.can_use_payroll(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.staff_pay (
  staff_id      uuid primary key,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  salary_minor  integer not null default 0 check (salary_minor between 0 and 100000000), -- per month
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade
);
create index staff_pay_tenant on public.staff_pay (tenant_id);

create table public.staff_pay_rates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  staff_id     uuid not null,
  category_id  uuid,
  service_id   uuid,
  pct          numeric(5, 2) not null check (pct between 0 and 100),
  created_at   timestamptz not null default now(),
  check ((category_id is null) <> (service_id is null)),
  unique (staff_id, category_id),
  unique (staff_id, service_id),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade,
  foreign key (category_id, tenant_id) references public.service_categories (id, tenant_id) on delete cascade,
  foreign key (service_id, tenant_id) references public.services (id, tenant_id) on delete cascade
);
create index staff_pay_rates_tenant on public.staff_pay_rates (tenant_id, staff_id);

create table public.pay_adjustments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  staff_id      uuid not null,
  month         date not null check (extract(day from month) = 1),
  kind          text not null check (kind in ('bonus', 'deduction')),
  amount_minor  integer not null check (amount_minor between 1 and 100000000),
  note          text check (char_length(note) <= 200),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade
);
create index pay_adjustments_month on public.pay_adjustments (tenant_id, month);

create table public.payouts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  staff_id      uuid not null,
  month         date not null check (extract(day from month) = 1),
  amount_minor  integer not null check (amount_minor between 1 and 100000000),
  method        text not null check (method in ('cash', 'transfer', 'card')),
  paid_on       date not null,
  note          text check (char_length(note) <= 200),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade
);
create index payouts_month on public.payouts (tenant_id, month);

create trigger staff_pay_updated_at before update on public.staff_pay
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: one rule for every command
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['staff_pay', 'staff_pay_rates', 'pay_adjustments', 'payouts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.prevent_tenant_change()', t || '_tenant_fixed', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_use_payroll(tenant_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_use_payroll(tenant_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_use_payroll(tenant_id)) with check (public.can_use_payroll(tenant_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_use_payroll(tenant_id))', t || '_delete', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit: every change to pay is logged (who, what, when)
-- ---------------------------------------------------------------------------
create or replace function public.audit_payroll()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  -- the business itself is being deleted (cascade): nothing to log into
  if not exists (select 1 from public.tenants t where t.id = (r ->> 'tenant_id')::uuid) then
    return coalesce(new, old);
  end if;
  perform public.write_audit(
    (r ->> 'tenant_id')::uuid,
    'payroll.' || tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'staff_id'),
    (r - 'tenant_id' - 'created_at' - 'updated_at')
      || case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old) - 'tenant_id' - 'created_at' - 'updated_at') else '{}'::jsonb end
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_payroll() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['staff_pay', 'staff_pay_rates', 'pay_adjustments', 'payouts'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_payroll()', t || '_audit', t);
  end loop;
end;
$$;
