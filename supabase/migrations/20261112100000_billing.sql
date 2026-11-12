-- Self-service billing through Flitt (decision 031): the owner pays Visito's
-- plan by card (monthly, automatic) and buys SMS packs. Money goes to Visito's
-- own Flitt account; card data never reaches Visito (Flitt's hosted page).
--
-- A payment row is created by the owner (billing_start: the price is read here,
-- never from the browser), and changed only by Flitt's signed callback through
-- billing_apply (service role). The plan / SMS are granted once, on the first
-- "approved" — repeated callbacks change nothing.

alter table public.tenants
  add column paid_until timestamptz,                 -- card-paid plans: paid up to this moment
  add column autopay boolean not null default false; -- the monthly card charge is on

create table public.sms_packs (
  code         text primary key check (code ~ '^[a-z0-9_-]{2,30}$'),
  segments     integer not null check (segments between 1 and 1000000),
  price_minor  integer not null check (price_minor between 1 and 100000000),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now()
);
alter table public.sms_packs enable row level security;
alter table public.sms_packs force row level security;
revoke all on public.sms_packs from anon;
revoke truncate, references, trigger on public.sms_packs from authenticated;
create policy sms_packs_select on public.sms_packs for select to authenticated using (true);
create policy sms_packs_insert on public.sms_packs for insert to authenticated with check (public.is_platform_admin());
create policy sms_packs_update on public.sms_packs for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy sms_packs_delete on public.sms_packs for delete to authenticated using (public.is_platform_admin());
-- placeholder prices until Levan sets them in /admin/plans
insert into public.sms_packs (code, segments, price_minor, sort_order) values
  ('sms500', 500, 2000, 1), ('sms1000', 1000, 3500, 2), ('sms3000', 3000, 9000, 3);

create table public.billing_payments (
  id                   uuid primary key default gen_random_uuid(),  -- Flitt order_id
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  kind                 text not null check (kind in ('plan', 'sms_pack')),
  plan_code            text references public.plans (code) on update cascade,
  pack_code            text references public.sms_packs (code) on update cascade,
  segments             integer,
  amount_minor         integer not null check (amount_minor > 0),
  currency             text not null default 'GEL' check (currency = 'GEL'),
  status               text not null default 'created'
                       check (status in ('created', 'processing', 'approved', 'declined', 'expired', 'reversed', 'mismatch')),
  parent_id            uuid references public.billing_payments (id) on delete set null, -- a monthly charge of a subscription
  provider_payment_id  text,
  masked_card          text check (char_length(masked_card) <= 30),
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  paid_at              timestamptz,
  check ((kind = 'plan') = (plan_code is not null)),
  check ((kind = 'sms_pack') = (pack_code is not null and segments is not null))
);
create index billing_payments_tenant on public.billing_payments (tenant_id, created_at desc);
alter table public.billing_payments enable row level security;
alter table public.billing_payments force row level security;
revoke all on public.billing_payments from anon, authenticated;
grant select on public.billing_payments to authenticated;
create policy billing_payments_select on public.billing_payments for select to authenticated
  using (public.has_role(tenant_id, array['owner']) or public.is_platform_admin());

-- The owner starts a payment; the amount comes from the plan / pack here.
create or replace function public.billing_start(p_tenant uuid, p_kind text, p_code text)
returns table (id uuid, amount_minor integer, segments integer, name text)
language plpgsql security definer set search_path = '' as $$
declare
  v_amount integer;
  v_segments integer;
  v_name text;
  v_id uuid;
begin
  if not public.has_role(p_tenant, array['owner']) or public.support_view(p_tenant) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants t where t.id = p_tenant and t.status <> 'cancelled') then
    raise exception 'business not available' using errcode = '42501';
  end if;
  if p_kind = 'plan' then
    select p.price_minor, p.name into v_amount, v_name from public.plans p
    where p.code = p_code and p.active and p.code <> 'trial' and p.price_minor > 0;
  elsif p_kind = 'sms_pack' then
    select k.price_minor, k.segments, k.code into v_amount, v_segments, v_name from public.sms_packs k
    where k.code = p_code and k.active;
  end if;
  if v_amount is null then
    raise exception 'unknown plan or pack' using errcode = '22023';
  end if;
  insert into public.billing_payments (tenant_id, kind, plan_code, pack_code, segments, amount_minor, created_by)
  values (p_tenant, p_kind, case when p_kind = 'plan' then p_code end, case when p_kind = 'sms_pack' then p_code end,
          v_segments, v_amount, auth.uid())
  returning billing_payments.id into v_id;
  perform public.write_audit(p_tenant, 'billing.started', 'billing_payment', v_id::text,
    jsonb_build_object('kind', p_kind, 'code', p_code, 'amount_minor', v_amount));
  return query select v_id, v_amount, v_segments, v_name;
end;
$$;
revoke all on function public.billing_start(uuid, text, text) from public, anon;
grant execute on function public.billing_start(uuid, text, text) to authenticated;

-- Flitt's verified callback (service role only). p_order = Flitt order_id;
-- p_parent = parent_order_id for the monthly charges of a subscription.
create or replace function public.billing_apply(
  p_order text, p_status text, p_amount integer, p_payment_id text, p_card text, p_parent text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  m public.billing_payments;
  parent public.billing_payments;
  v_status text := case when p_status in ('created', 'processing', 'approved', 'declined', 'expired', 'reversed')
                        then p_status else null end;
begin
  if v_status is null then return 'ignored'; end if;
  if p_order ~ '^[0-9a-f-]{36}$' then
    select * into m from public.billing_payments where id = p_order::uuid for update;
  end if;

  -- a monthly charge of a subscription Visito started: a new row under its parent
  if m.id is null and p_parent ~ '^[0-9a-f-]{36}$' then
    select * into parent from public.billing_payments where id = p_parent::uuid and kind = 'plan';
    if parent.id is null then return 'unknown'; end if;
    if exists (select 1 from public.billing_payments b where b.parent_id = parent.id and b.provider_payment_id = p_payment_id) then
      return 'duplicate';
    end if;
    insert into public.billing_payments (tenant_id, kind, plan_code, amount_minor, status, parent_id, provider_payment_id, masked_card)
    values (parent.tenant_id, 'plan', parent.plan_code, greatest(coalesce(p_amount, parent.amount_minor), 1), 'created',
            parent.id, p_payment_id, left(p_card, 30))
    returning * into m;
  end if;
  if m.id is null then return 'unknown'; end if;

  if m.status = 'approved' and v_status <> 'reversed' then return 'already'; end if;

  -- the amount must be what Visito asked for
  if v_status = 'approved' and p_amount is distinct from m.amount_minor then
    update public.billing_payments set status = 'mismatch', provider_payment_id = coalesce(p_payment_id, provider_payment_id)
    where id = m.id;
    perform public.write_audit(m.tenant_id, 'billing.amount_mismatch', 'billing_payment', m.id::text,
      jsonb_build_object('expected', m.amount_minor, 'got', p_amount));
    return 'mismatch';
  end if;

  update public.billing_payments set
    status = v_status,
    provider_payment_id = coalesce(p_payment_id, provider_payment_id),
    masked_card = coalesce(left(p_card, 30), masked_card),
    paid_at = case when v_status = 'approved' then now() else paid_at end
  where id = m.id;

  if v_status = 'approved' then
    if m.kind = 'plan' then
      update public.tenants set
        plan = m.plan_code,
        status = 'active',
        paid_until = greatest(coalesce(paid_until, now()), now()) + interval '1 month',
        autopay = true
      where id = m.tenant_id;
    else
      insert into public.sms_credit_ledger (tenant_id, delta, reason, note)
      values (m.tenant_id, m.segments, 'topup', 'pack ' || m.pack_code || ' · ' || m.id);
    end if;
    perform public.write_audit(m.tenant_id, 'billing.paid', 'billing_payment', m.id::text,
      jsonb_build_object('kind', m.kind, 'amount_minor', m.amount_minor));
  end if;
  return v_status;
end;
$$;
revoke all on function public.billing_apply(text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.billing_apply(text, text, integer, text, text, text) to service_role;

-- The owner turned the monthly charge off (after Flitt confirmed): the plan runs to paid_until.
create or replace function public.billing_autopay_off(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.tenants set autopay = false where id = p_tenant;
  perform public.write_audit(p_tenant, 'billing.autopay_off', 'tenant', p_tenant::text);
end;
$$;
revoke all on function public.billing_autopay_off(uuid) from public, anon;
grant execute on function public.billing_autopay_off(uuid) to authenticated;

-- Daily: a card-paid plan 3 days past its paid period becomes "payment due".
create or replace function public.expire_paid_periods()
returns integer language sql security definer set search_path = '' as $$
  with x as (
    update public.tenants set status = 'past_due'
    where status = 'active' and paid_until is not null and paid_until < now() - interval '3 days'
    returning 1
  ) select count(*)::integer from x
$$;
revoke all on function public.expire_paid_periods() from public, anon, authenticated;
grant execute on function public.expire_paid_periods() to service_role;
