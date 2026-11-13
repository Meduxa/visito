-- Branches (decision 032). A business may have several branches (locations).
--  * plans.max_locations: how many active branches a plan allows (null = no limit).
--    Starter 1, Standard 3, Clinic/Premium no limit, trial 3. Enforced by a trigger.
--  * locations.slug: each branch gets its own booking link (/book/{business}?branch={slug}).
--  * staff_schedules / staff_schedule_overrides.location_id: every working interval says
--    WHERE the person works (null = the main branch). A person may work in several
--    branches on different days.
--  * service_locations: per branch, a service can be switched off or get its own price
--    (no row = offered at the normal price).
--  * bookings get the branch chosen by the user; prices come from that branch.

-- ---------------------------------------------------------------------------
-- Plan limit
-- ---------------------------------------------------------------------------
alter table public.plans
  add column max_locations integer check (max_locations is null or max_locations >= 1);  -- null = no limit
update public.plans set max_locations = case code
  when 'start' then 1
  when 'pro' then 3
  when 'trial' then 3
  else null end;

-- ---------------------------------------------------------------------------
-- Locations: link name, order, the main branch is always open
-- ---------------------------------------------------------------------------
alter table public.locations
  add column slug text check (slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$'),
  add column sort_order integer not null default 0,
  add constraint locations_primary_active check (not is_primary or active);
create unique index locations_slug_unique on public.locations (tenant_id, slug) where slug is not null;
update public.locations set slug = 'main' where is_primary and slug is null;

create or replace function public.enforce_location_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_max integer;
begin
  if not new.active then return new; end if;
  if tg_op = 'UPDATE' and old.active then return new; end if;
  select p.max_locations into v_max from public.tenants t join public.plans p on p.code = t.plan where t.id = new.tenant_id;
  if v_max is not null and (select count(*) from public.locations where tenant_id = new.tenant_id and active and id <> new.id) >= v_max then
    raise exception 'plan location limit' using errcode = 'P0006';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_location_limit() from public, anon, authenticated;
create trigger locations_plan_limit before insert or update of active on public.locations
  for each row execute function public.enforce_location_limit();

-- ---------------------------------------------------------------------------
-- Where each working interval is
-- ---------------------------------------------------------------------------
alter table public.staff_schedules
  add column location_id uuid,
  add foreign key (location_id, tenant_id) references public.locations (id, tenant_id) on delete cascade;
alter table public.staff_schedule_overrides
  add column location_id uuid,
  add foreign key (location_id, tenant_id) references public.locations (id, tenant_id) on delete cascade;

-- Weekly schedule. p_rows: [{weekday, start_time, end_time, location_id?}]
-- Intervals of one day must not overlap, whatever the branch: one person, one place.
create or replace function public.set_staff_schedule(p_staff uuid, p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.staff where id = p_staff;
  if v_tenant is null or not public.has_role(v_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 70 then
    raise exception 'invalid schedule' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) a(weekday smallint, start_time time, end_time time)
    join jsonb_to_recordset(p_rows) b(weekday smallint, start_time time, end_time time)
      on a.weekday = b.weekday and (a.start_time, a.end_time) <> (b.start_time, b.end_time)
     and a.start_time < b.end_time and b.start_time < a.end_time
  ) then
    raise exception 'overlapping intervals' using errcode = '23P01';
  end if;

  delete from public.staff_schedules where staff_id = p_staff;
  -- the composite foreign key rejects a branch of another business
  insert into public.staff_schedules (tenant_id, staff_id, weekday, start_time, end_time, location_id)
  select v_tenant, p_staff, r.weekday, r.start_time, r.end_time, r.location_id
  from jsonb_to_recordset(p_rows) r(weekday smallint, start_time time, end_time time, location_id uuid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Services per branch
-- ---------------------------------------------------------------------------
create table public.service_locations (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  service_id       uuid not null,
  location_id      uuid not null,
  offered          boolean not null default true,
  price_minor      integer check (price_minor between 0 and 100000000),      -- null = the normal price
  price_max_minor  integer check (price_max_minor between 0 and 100000000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (service_id, location_id),
  foreign key (service_id, tenant_id) references public.services (id, tenant_id) on delete cascade,
  foreign key (location_id, tenant_id) references public.locations (id, tenant_id) on delete cascade
);
create index on public.service_locations (tenant_id, location_id);

alter table public.service_locations enable row level security;
alter table public.service_locations force row level security;
revoke all on public.service_locations from anon, authenticated;
grant select, insert, update, delete on public.service_locations to authenticated;
create trigger service_locations_tenant_fixed before update on public.service_locations
  for each row execute function public.prevent_tenant_change();
create trigger service_locations_updated_at before update on public.service_locations
  for each row execute function public.set_updated_at();
create policy service_locations_select on public.service_locations for select to authenticated
  using (tenant_id in (select public.user_tenant_ids()));
create policy service_locations_insert on public.service_locations for insert to authenticated
  with check (public.has_role(tenant_id, array['owner', 'admin']));
create policy service_locations_update on public.service_locations for update to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']))
  with check (public.has_role(tenant_id, array['owner', 'admin']));
create policy service_locations_delete on public.service_locations for delete to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin']));

-- Replace a branch's service settings. Caller's rights (RLS decides).
-- p_rows: [{service_id, offered, price_minor?, price_max_minor?}] — only rows that differ from normal.
create or replace function public.set_location_services(p_location uuid, p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.locations where id = p_location;
  if v_tenant is null or not public.has_role(v_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid services' using errcode = '22023';
  end if;
  delete from public.service_locations where location_id = p_location;
  insert into public.service_locations (tenant_id, service_id, location_id, offered, price_minor, price_max_minor)
  select v_tenant, r.service_id, p_location, coalesce(r.offered, true), r.price_minor, r.price_max_minor
  from jsonb_to_recordset(p_rows) r(service_id uuid, offered boolean, price_minor integer, price_max_minor integer);
end;
$$;
revoke execute on function public.set_location_services(uuid, jsonb) from public, anon;
grant execute on function public.set_location_services(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Booking functions: the branch is chosen; prices come from it
-- ---------------------------------------------------------------------------

-- Snapshot of one service line: name, price (staff's own → branch → variant → service),
-- duration, buffer. A service switched off at the branch cannot be booked there (P0003).
-- The branch price applies to services without variants; variants keep their prices.
drop function public.item_snapshot(uuid, uuid, uuid, uuid, text);
create function public.item_snapshot(
  p_tenant uuid, p_service uuid, p_variant uuid, p_staff uuid, p_locale text, p_location uuid default null
) returns table (name text, price_type text, price_minor integer, duration_min integer, buffer_min integer, resource_type text)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.services;
  ss public.staff_services;
  v public.service_variants;
  sl public.service_locations;
begin
  select * into s from public.services where id = p_service and tenant_id = p_tenant and active;
  if s.id is null then
    raise exception 'service not available' using errcode = 'P0002';
  end if;
  select * into ss from public.staff_services where staff_id = p_staff and service_id = p_service;
  if ss.id is null then
    raise exception 'staff does not perform this service' using errcode = 'P0003';
  end if;
  if p_variant is not null then
    select * into v from public.service_variants where id = p_variant and service_id = p_service;
    if v.id is null then raise exception 'variant not found' using errcode = 'P0002'; end if;
  end if;
  if p_location is not null then
    select * into sl from public.service_locations where service_id = p_service and location_id = p_location;
    if sl.id is not null and not sl.offered then
      raise exception 'service not offered at this branch' using errcode = 'P0003';
    end if;
  end if;

  return query select
    coalesce(nullif(s.name_i18n ->> p_locale, ''), s.name_i18n ->> 'ka', s.name_i18n ->> 'en', s.name_i18n ->> 'ru')
      || coalesce(' · ' || coalesce(nullif(v.name_i18n ->> p_locale, ''), v.name_i18n ->> 'ka', v.name_i18n ->> 'en'), ''),
    case when v.id is not null then 'fixed' else s.price_type end,
    coalesce(ss.price_minor_override, case when v.id is null then sl.price_minor end, v.price_minor, s.price_minor),
    coalesce(ss.duration_min_override, v.duration_min, s.duration_min),
    s.buffer_after_min,
    s.resource_type;
end;
$$;
revoke execute on function public.item_snapshot(uuid, uuid, uuid, uuid, text, uuid) from public, anon, authenticated;

-- The branch of a new booking: the given one (active, same business) or the main branch.
create or replace function public.booking_location(p_tenant uuid, p_location uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  if p_location is null then
    select id into v from public.locations where tenant_id = p_tenant and is_primary;
  else
    select id into v from public.locations where id = p_location and tenant_id = p_tenant and active;
    if v is null then raise exception 'branch not found' using errcode = 'P0002'; end if;
  end if;
  return v;
end;
$$;
revoke execute on function public.booking_location(uuid, uuid) from public, anon, authenticated;

-- A resource belongs to a branch (no branch = the main one).
create or replace function public.resource_at(p_resource uuid, p_location uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.resources r
    where r.id = p_resource
      and coalesce(r.location_id, (select l.id from public.locations l where l.tenant_id = r.tenant_id and l.is_primary)) = p_location
  )
$$;
revoke execute on function public.resource_at(uuid, uuid) from public, anon, authenticated;

-- Same as 20261027090000_bookings.sql, plus the branch.
drop function public.create_recurring_booking(uuid, uuid, jsonb, integer, text, text, text);
drop function public.create_booking(uuid, uuid, jsonb, text, text, text, text);
create function public.create_booking(
  p_tenant uuid, p_client uuid, p_items jsonb, p_source text default 'admin',
  p_note text default null, p_status text default 'confirmed', p_locale text default 'ka',
  p_location uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_booking uuid;
  v_staff uuid[];
  r record;
  snap record;
  v_start timestamptz;
  v_end timestamptz;
  v_total integer := 0;
  v_min timestamptz;
  v_max timestamptz;
  v_loc uuid;
  i integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 10 then
    raise exception 'invalid items' using errcode = '22023';
  end if;
  select array_agg((x ->> 'staff_id')::uuid) into v_staff from jsonb_array_elements(p_items) x;
  if not public.may_book_for(p_tenant, v_staff) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'confirmed') or p_source not in ('admin', 'phone', 'walk_in', 'online', 'import') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  if p_client is not null and not exists (select 1 from public.clients where id = p_client and tenant_id = p_tenant and anonymized_at is null) then
    raise exception 'client not found' using errcode = 'P0002';
  end if;
  v_loc := public.booking_location(p_tenant, p_location);

  insert into public.bookings (tenant_id, location_id, client_id, starts_at, ends_at, status, source, internal_note, created_by)
  values (p_tenant, v_loc, p_client, now(), now() + interval '1 minute', p_status, p_source, nullif(btrim(p_note), ''), auth.uid())
  returning id into v_booking;

  for r in select (x ->> 'service_id')::uuid service_id, nullif(x ->> 'variant_id', '')::uuid variant_id,
                  (x ->> 'staff_id')::uuid staff_id, nullif(x ->> 'resource_id', '')::uuid resource_id,
                  (x ->> 'starts_at')::timestamptz starts_at
           from jsonb_array_elements(p_items) x
  loop
    if not exists (select 1 from public.staff where id = r.staff_id and tenant_id = p_tenant and active) then
      raise exception 'staff not available' using errcode = 'P0002';
    end if;
    select * into snap from public.item_snapshot(p_tenant, r.service_id, r.variant_id, r.staff_id, p_locale, v_loc);
    if snap.resource_type is not null and r.resource_id is not null and not exists (
      select 1 from public.resources where id = r.resource_id and tenant_id = p_tenant and type = snap.resource_type and active
    ) then
      raise exception 'resource not suitable' using errcode = 'P0002';
    end if;
    if r.resource_id is not null and not public.resource_at(r.resource_id, v_loc) then
      raise exception 'resource of another branch' using errcode = 'P0002';
    end if;

    v_start := r.starts_at;
    v_end := v_start + make_interval(mins => snap.duration_min);
    insert into public.booking_items (tenant_id, booking_id, service_id, variant_id, staff_id, resource_id,
      name_snapshot, price_type_snapshot, price_minor_snapshot, duration_min_snapshot, buffer_min_snapshot,
      starts_at, ends_at, blocked_until, sort_order)
    values (p_tenant, v_booking, r.service_id, r.variant_id, r.staff_id, r.resource_id,
      snap.name, snap.price_type, snap.price_minor, snap.duration_min, snap.buffer_min,
      v_start, v_end, v_end + make_interval(mins => snap.buffer_min), i);
    v_total := v_total + snap.price_minor;
    v_min := least(coalesce(v_min, v_start), v_start);
    v_max := greatest(coalesce(v_max, v_end), v_end);
    i := i + 1;
  end loop;

  update public.bookings set starts_at = v_min, ends_at = v_max, total_minor = v_total where id = v_booking;
  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, changed_by)
  values (p_tenant, v_booking, null, p_status, auth.uid());
  return v_booking;
end;
$$;

create function public.create_recurring_booking(
  p_tenant uuid, p_client uuid, p_occurrences jsonb, p_every_weeks integer,
  p_source text default 'admin', p_note text default null, p_locale text default 'ka',
  p_location uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_rec uuid;
  v_booking uuid;
  occ jsonb;
begin
  if jsonb_typeof(p_occurrences) <> 'array' or jsonb_array_length(p_occurrences) not between 2 and 52 then
    raise exception 'invalid occurrences' using errcode = '22023';
  end if;
  insert into public.recurrences (tenant_id, every_weeks, occurrences, created_by)
  values (p_tenant, p_every_weeks, jsonb_array_length(p_occurrences), auth.uid())
  returning id into v_rec;

  for occ in select * from jsonb_array_elements(p_occurrences) loop
    -- create_booking checks permissions, services, staff, branch and overlaps
    v_booking := public.create_booking(p_tenant, p_client, occ, p_source, p_note, 'confirmed', p_locale, p_location);
    update public.bookings set recurrence_id = v_rec where id = v_booking;
  end loop;
  return v_rec;
end;
$$;

revoke execute on function public.create_booking(uuid, uuid, jsonb, text, text, text, text, uuid),
  public.create_recurring_booking(uuid, uuid, jsonb, integer, text, text, text, uuid) from public, anon;
grant execute on function public.create_booking(uuid, uuid, jsonb, text, text, text, text, uuid),
  public.create_recurring_booking(uuid, uuid, jsonb, integer, text, text, text, uuid) to authenticated;

-- Same as 20261109090000_online_limits.sql, plus the branch (only a branch where the
-- service is offered; the resource must be of that branch).
drop function public.public_create_booking(uuid, text, text, text, text, text, jsonb, boolean, boolean, text, text, text);
create function public.public_create_booking(
  p_tenant uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_comment text,
  p_items jsonb,              -- [{service_id, variant_id?, staff_id, resource_id?, starts_at}]
  p_marketing_sms boolean,
  p_marketing_email boolean,
  p_locale text,
  p_manage_token_hash text,
  p_otp_pass_hash text,       -- null only when the business does not require a code
  p_location uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.tenant_settings;
  v_client uuid;
  v_blocked boolean;
  v_booking uuid;
  v_status text;
  v_loc uuid;
  r record;
  snap record;
  v_start timestamptz;
  v_end timestamptz;
  v_total integer := 0;
  v_min timestamptz;
  v_max timestamptz;
  i integer := 0;
begin
  if not exists (select 1 from public.tenants where id = p_tenant and status in ('trial', 'active', 'past_due')) then
    raise exception 'business not available' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 5 then
    raise exception 'invalid items' using errcode = '22023';
  end if;
  if p_phone !~ '^\+[1-9][0-9]{7,14}$' or nullif(btrim(p_first_name), '') is null
     or char_length(p_first_name) > 80 or char_length(coalesce(p_last_name, '')) > 80
     or char_length(coalesce(p_email, '')) > 200 then
    raise exception 'invalid client' using errcode = '22023';
  end if;
  v_loc := public.booking_location(p_tenant, p_location);
  select * into v_settings from public.tenant_settings where tenant_id = p_tenant;

  -- phone proof: required unless the business switched it off
  if v_settings.online_otp_required or p_otp_pass_hash is not null then
    update public.otp_passes set used_at = now()
    where token_hash = p_otp_pass_hash and tenant_id = p_tenant and phone_e164 = p_phone
      and used_at is null and expires_at > now();
    if not found then raise exception 'phone not verified' using errcode = '28000'; end if;
  end if;

  select id, blocked_online into v_client, v_blocked from public.clients
  where tenant_id = p_tenant and phone_e164 = p_phone and anonymized_at is null
  order by created_at limit 1;
  if v_blocked then raise exception 'online booking blocked' using errcode = 'P0004'; end if;
  if v_client is not null and v_settings.online_max_upcoming > 0 then
    perform 1 from public.clients where id = v_client for update;
  end if;
  if v_client is not null and v_settings.online_max_upcoming > 0 and (
    select count(*) from public.bookings
    where tenant_id = p_tenant and client_id = v_client
      and status in ('pending', 'confirmed') and starts_at > now()
  ) >= v_settings.online_max_upcoming then
    raise exception 'too many upcoming visits' using errcode = 'P0006';
  end if;
  if v_client is null then
    insert into public.clients (tenant_id, first_name, last_name, phone_e164, email, source)
    values (p_tenant, btrim(p_first_name), nullif(btrim(p_last_name), ''), p_phone,
            nullif(lower(btrim(p_email)), ''), 'online')
    returning id into v_client;
  else
    update public.clients set email = coalesce(email, nullif(lower(btrim(p_email)), ''))
    where id = v_client;
  end if;

  if p_marketing_sms then
    insert into public.client_consents (tenant_id, client_id, channel, granted, source)
    values (p_tenant, v_client, 'sms', true, 'booking_page');
  end if;
  if p_marketing_email and nullif(btrim(p_email), '') is not null then
    insert into public.client_consents (tenant_id, client_id, channel, granted, source)
    values (p_tenant, v_client, 'email', true, 'booking_page');
  end if;

  v_status := case when v_settings.online_requires_approval then 'pending' else 'confirmed' end;
  insert into public.bookings (tenant_id, location_id, client_id, starts_at, ends_at, status, source, client_comment)
  values (p_tenant, v_loc, v_client, now(), now() + interval '1 minute', v_status, 'online',
          nullif(btrim(left(p_comment, 500)), ''))
  returning id into v_booking;

  for r in select (x ->> 'service_id')::uuid service_id, nullif(x ->> 'variant_id', '')::uuid variant_id,
                  (x ->> 'staff_id')::uuid staff_id, nullif(x ->> 'resource_id', '')::uuid resource_id,
                  (x ->> 'starts_at')::timestamptz starts_at
           from jsonb_array_elements(p_items) x
  loop
    if not exists (select 1 from public.services
                   where id = r.service_id and tenant_id = p_tenant and active and bookable_online)
       or not exists (select 1 from public.staff
                      where id = r.staff_id and tenant_id = p_tenant and active and bookable_online)
       or not exists (select 1 from public.staff_services where staff_id = r.staff_id and service_id = r.service_id) then
      raise exception 'not bookable online' using errcode = 'P0003';
    end if;
    if r.starts_at < now() then raise exception 'in the past' using errcode = '22023'; end if;
    select * into snap from public.item_snapshot(p_tenant, r.service_id, r.variant_id, r.staff_id, p_locale, v_loc);
    if snap.resource_type is not null and (r.resource_id is null or not exists (
      select 1 from public.resources where id = r.resource_id and tenant_id = p_tenant and type = snap.resource_type and active
    ) or not public.resource_at(r.resource_id, v_loc)) then
      raise exception 'resource not suitable' using errcode = 'P0003';
    end if;
    v_start := r.starts_at;
    v_end := v_start + make_interval(mins => snap.duration_min);
    insert into public.booking_items (tenant_id, booking_id, service_id, variant_id, staff_id, resource_id,
      name_snapshot, price_type_snapshot, price_minor_snapshot, duration_min_snapshot, buffer_min_snapshot,
      starts_at, ends_at, blocked_until, sort_order)
    values (p_tenant, v_booking, r.service_id, r.variant_id, r.staff_id, r.resource_id,
      snap.name, snap.price_type, snap.price_minor, snap.duration_min, snap.buffer_min,
      v_start, v_end, v_end + make_interval(mins => snap.buffer_min), i);
    v_total := v_total + snap.price_minor;
    v_min := least(coalesce(v_min, v_start), v_start);
    v_max := greatest(coalesce(v_max, v_end), v_end);
    i := i + 1;
  end loop;

  update public.bookings set starts_at = v_min, ends_at = v_max, total_minor = v_total where id = v_booking;
  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, reason)
  values (p_tenant, v_booking, null, v_status, 'online');
  insert into public.booking_manage_tokens (token_hash, tenant_id, booking_id)
  values (p_manage_token_hash, p_tenant, v_booking);
  insert into public.notifications (tenant_id, kind, booking_id)
  values (p_tenant, 'online_booking', v_booking);
  return jsonb_build_object('booking_id', v_booking, 'status', v_status, 'client_id', v_client);
end;
$$;
revoke all on function public.public_create_booking(uuid, text, text, text, text, text, jsonb, boolean, boolean, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.public_create_booking(uuid, text, text, text, text, text, jsonb, boolean, boolean, text, text, text, uuid)
  to service_role;

-- The booking's own branch: its address and phone on the manage page and in reminders.
create or replace function public.public_manage_view(p_token_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'booking_id', b.id, 'tenant_id', b.tenant_id, 'slug', t.slug, 'business', t.name, 'timezone', t.timezone,
    'status', b.status, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'total_minor', b.total_minor,
    'first_name', c.first_name, 'cancel_window_min', s.cancel_window_min,
    'phone', case when l.is_primary then coalesce(s.phone, l.phone) else coalesce(l.phone, s.phone) end,
    'address', l.address, 'location_id', l.id, 'branch', case when l.is_primary then null else l.name end,
    'items', (select jsonb_agg(jsonb_build_object('service_id', i.service_id, 'variant_id', i.variant_id,
                'staff_id', i.staff_id, 'staff', st.display_name, 'name', i.name_snapshot,
                'starts_at', i.starts_at, 'duration_min', i.duration_min_snapshot) order by i.sort_order)
              from public.booking_items i join public.staff st on st.id = i.staff_id where i.booking_id = b.id)
  )
  from public.booking_manage_tokens m
  join public.bookings b on b.id = m.booking_id
  join public.tenants t on t.id = b.tenant_id
  join public.tenant_settings s on s.tenant_id = b.tenant_id
  left join public.clients c on c.id = b.client_id
  left join public.locations l on l.tenant_id = b.tenant_id
    and (l.id = b.location_id or (b.location_id is null and l.is_primary))
  where m.token_hash = p_token_hash;
$$;

create or replace function public.sms_due_reminders()
returns table (
  tenant_id uuid, booking_id uuid, client_id uuid, offset_min integer, starts_at timestamptz,
  phone text, first_name text, business text, timezone text, locale text, address text, business_phone text,
  quiet_start time, quiet_end time, services text, staff text
) language sql stable security definer set search_path = '' as $$
  select b.tenant_id, b.id, c.id, o.offset_min, b.starts_at,
         c.phone_e164, c.first_name, t.name, t.timezone, t.locale_default, l.address,
         case when l.is_primary then coalesce(s.phone, l.phone) else coalesce(l.phone, s.phone) end,
         s.quiet_start, s.quiet_end,
         (select string_agg(i.name_snapshot, ', ' order by i.sort_order) from public.booking_items i where i.booking_id = b.id),
         (select string_agg(distinct st.display_name, ', ') from public.booking_items i
            join public.staff st on st.id = i.staff_id where i.booking_id = b.id)
  from public.bookings b
  join public.tenants t on t.id = b.tenant_id and t.status in ('trial', 'active', 'past_due')
  join public.tenant_settings s on s.tenant_id = b.tenant_id
  join public.clients c on c.id = b.client_id and c.phone_e164 is not null and c.anonymized_at is null
  left join public.locations l on l.tenant_id = b.tenant_id
    and (l.id = b.location_id or (b.location_id is null and l.is_primary))
  cross join lateral (
    select 1440 as offset_min where s.reminder_24h
    union all select 120 where s.reminder_2h
  ) o
  where b.status in ('pending', 'confirmed')
    and b.starts_at > now()
    and b.starts_at - make_interval(mins => o.offset_min) <= now()
    and b.starts_at - make_interval(mins => o.offset_min) > now() - interval '6 hours'  -- never very late
    and b.created_at < b.starts_at - make_interval(mins => o.offset_min)  -- booked after the offset: skip
    and not exists (
      select 1 from public.sms_messages m
      where m.tenant_id = b.tenant_id
        and m.idempotency_key = 'reminder:' || o.offset_min || ':' || b.id || ':' || floor(extract(epoch from b.starts_at))::bigint
    );
$$;
