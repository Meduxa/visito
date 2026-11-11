-- Clients step 2 (decision 026, plan docs/plans/clients-section.md):
-- 1. Own fields: the business defines up to 20 extra fields for the client card
--    (text, number, date, choice, yes/no); values live in clients.custom.
-- 2. Group thresholds as a setting: VIP from N visits, "at risk" after N days,
--    "lost" after N days (were fixed at 5 / 60 / 180).
-- 3. client_list recomputes groups from those settings.

-- ---------------------------------------------------------------------------
-- Group thresholds
-- ---------------------------------------------------------------------------
alter table public.tenant_settings
  add column segment_vip_visits integer not null default 5 check (segment_vip_visits between 2 and 100),
  add column segment_at_risk_days integer not null default 60 check (segment_at_risk_days between 14 and 365),
  add column segment_lost_days integer not null default 180 check (segment_lost_days between 30 and 1095),
  add constraint segment_lost_after_at_risk check (segment_lost_days > segment_at_risk_days);

-- ---------------------------------------------------------------------------
-- Own fields
-- ---------------------------------------------------------------------------
create table public.client_fields (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  label       text not null check (char_length(btrim(label)) between 1 and 60),
  kind        text not null check (kind in ('text', 'number', 'date', 'choice', 'yesno')),
  options     text[] not null default '{}' check (cardinality(options) <= 20),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (kind <> 'choice' or cardinality(options) >= 1)
);
create index client_fields_tenant on public.client_fields (tenant_id, sort_order);
alter table public.client_fields enable row level security;
alter table public.client_fields force row level security;
revoke all on public.client_fields from anon;
revoke truncate, references, trigger on public.client_fields from authenticated;
create trigger client_fields_tenant_fixed before update on public.client_fields
  for each row execute function public.prevent_tenant_change();
create trigger client_fields_updated_at before update on public.client_fields
  for each row execute function public.set_updated_at();

-- every member reads (the card shows them); owner/admin define them
create policy client_fields_select on public.client_fields for select to authenticated
  using (tenant_id in (select public.user_tenant_ids()));
create policy client_fields_insert on public.client_fields for insert to authenticated
  with check (public.has_role(tenant_id, array['owner', 'admin']));
create policy client_fields_update on public.client_fields for update to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']))
  with check (public.has_role(tenant_id, array['owner', 'admin']));
create policy client_fields_delete on public.client_fields for delete to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']));

-- at most 20 fields per business
create or replace function public.client_fields_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.client_fields where tenant_id = new.tenant_id) >= 20 then
    raise exception 'too many client fields' using errcode = 'P0006';
  end if;
  return new;
end;
$$;
revoke execute on function public.client_fields_limit() from public, anon, authenticated;
create trigger client_fields_limit before insert on public.client_fields
  for each row execute function public.client_fields_limit();

-- values: {"<field id>": "text" | number | "2026-11-11" | true}
alter table public.clients
  add column custom jsonb not null default '{}'::jsonb
  check (jsonb_typeof(custom) = 'object' and pg_column_size(custom) <= 8000);

-- a removed field takes its values with it
create or replace function public.client_fields_cleanup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.clients set custom = custom - old.id::text
  where tenant_id = old.tenant_id and custom ? old.id::text;
  return old;
end;
$$;
revoke execute on function public.client_fields_cleanup() from public, anon, authenticated;
create trigger client_fields_cleanup after delete on public.client_fields
  for each row execute function public.client_fields_cleanup();

-- ---------------------------------------------------------------------------
-- Erase and merge also handle own fields
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_client(p_client uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.clients where id = p_client and anonymized_at is null;
  if v_tenant is null or not public.has_role(v_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.clients set
    first_name = '—', last_name = null, phone_e164 = null, email = null, birthday = null,
    gender = null, tags = '{}', notes = null, important_note = null, preferred_staff_id = null,
    blocked_online = false, custom = '{}'::jsonb, anonymized_at = now()
  where id = p_client;
  delete from public.client_consents where client_id = p_client;
  perform public.write_audit(v_tenant, 'client.anonymized', 'client', p_client::text);
end;
$$;

create or replace function public.merge_clients(p_keep uuid, p_remove uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  k public.clients;
  r public.clients;
begin
  select * into k from public.clients where id = p_keep for update;
  select * into r from public.clients where id = p_remove for update;
  if k.id is null or r.id is null or k.id = r.id or k.tenant_id <> r.tenant_id
     or k.anonymized_at is not null or r.anonymized_at is not null
     or not public.has_role(k.tenant_id, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.clients set phone_e164 = null where id = r.id;
  update public.clients set
    last_name = coalesce(k.last_name, r.last_name),
    phone_e164 = coalesce(k.phone_e164, r.phone_e164),
    email = coalesce(k.email, r.email),
    birthday = coalesce(k.birthday, r.birthday),
    gender = coalesce(k.gender, r.gender),
    tags = (select coalesce(array_agg(distinct x), '{}') from unnest(k.tags || r.tags) x),
    notes = nullif(concat_ws(E'\n\n', k.notes, r.notes), ''),
    important_note = nullif(concat_ws(' · ', k.important_note, r.important_note), ''),
    preferred_staff_id = coalesce(k.preferred_staff_id, r.preferred_staff_id),
    no_show_count = k.no_show_count + r.no_show_count,
    blocked_online = k.blocked_online or r.blocked_online,
    custom = r.custom || k.custom -- the kept card's values win
  where id = k.id;

  update public.client_consents set client_id = k.id where client_id = r.id;
  update public.bookings set client_id = k.id where client_id = r.id;
  update public.dental_notes set client_id = k.id where client_id = r.id;
  delete from public.clients where id = r.id;
  perform public.write_audit(k.tenant_id, 'client.merged', 'client', k.id::text, jsonb_build_object('removed', r.id));
end;
$$;

-- ---------------------------------------------------------------------------
-- client_list with the business's own group thresholds. Dropped and created
-- again: c.* now has one more column (custom).
-- ---------------------------------------------------------------------------
drop view public.client_list;
create view public.client_list with (security_invoker = true) as
select
  c.*,
  s.visits,
  s.last_visit_at,
  s.next_visit_at,
  s.cancellations,
  case when public.can_see_revenue(c.tenant_id) then s.spent_minor end as spent_minor,
  case when public.can_see_revenue(c.tenant_id) and s.visits > 0
       then round(s.spent_minor::numeric / s.visits)::integer end as average_minor,
  case
    when s.last_visit_at < now() - make_interval(days => coalesce(ts.segment_lost_days, 180)) then 'lost'
    when s.last_visit_at < now() - make_interval(days => coalesce(ts.segment_at_risk_days, 60)) then 'at_risk'
    when s.visits <= 1 then 'new'
    when s.visits >= coalesce(ts.segment_vip_visits, 5) then 'vip'
    else 'regular'
  end as segment,
  extract(month from c.birthday)::integer as birthday_month,
  s.first_booking_at
from public.clients c
left join public.tenant_settings ts on ts.tenant_id = c.tenant_id
cross join lateral (
  select
    count(*) filter (where b.status = 'completed')::integer as visits,
    max(b.starts_at) filter (where b.status = 'completed') as last_visit_at,
    min(b.starts_at) filter (where b.status in ('pending', 'confirmed') and b.starts_at > now()) as next_visit_at,
    count(*) filter (where b.status in ('cancelled_by_client', 'cancelled_by_business'))::integer as cancellations,
    coalesce(sum(b.total_minor) filter (where b.status = 'completed'), 0)::integer as spent_minor,
    min(b.starts_at) as first_booking_at
  from public.bookings b
  where b.tenant_id = c.tenant_id and b.client_id = c.id
) s;

revoke all on public.client_list from public, anon;
grant select on public.client_list to authenticated;
