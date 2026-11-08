-- In-app notifications (decision 019).
--
-- Two kinds:
-- * online_booking — a stored event, written inside public_create_booking (the
--   server-only function behind the public booking page), so the browser can
--   never create one.
-- * needs_action — not stored: computed on every read from bookings whose time
--   is over but whose status is still pending/confirmed. It disappears by
--   itself the moment someone sets the status.
--
-- Who sees what: owner/admin see every notification of the business; staff
-- see only those for bookings with their own linked specialist profile.
-- Read state is per user. Notifications carry no notes or health data.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  kind        text not null check (kind in ('online_booking')),
  booking_id  uuid not null,
  created_at  timestamptz not null default now(),
  unique (kind, booking_id),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade
);

create table public.notification_reads (
  user_id     uuid not null references auth.users (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  kind        text not null check (kind in ('online_booking', 'needs_action')),
  booking_id  uuid not null,
  read_at     timestamptz not null default now(),
  primary key (user_id, kind, booking_id),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade
);

create index notifications_tenant_created on public.notifications (tenant_id, created_at desc);
create index notification_reads_tenant on public.notification_reads (tenant_id);
create index notification_reads_booking on public.notification_reads (booking_id);
-- needs_action scan: open bookings of a business by end time
create index bookings_open_by_end on public.bookings (tenant_id, ends_at)
  where status in ('pending', 'confirmed');

create trigger notifications_tenant_fixed before update on public.notifications
  for each row execute function public.prevent_tenant_change();
create trigger notification_reads_tenant_fixed before update on public.notification_reads
  for each row execute function public.prevent_tenant_change();

alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.notification_reads enable row level security;
alter table public.notification_reads force row level security;
revoke all on public.notifications, public.notification_reads from anon, authenticated;
-- users only read; writes go through the functions below
grant select on public.notifications, public.notification_reads to authenticated;

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------

-- owner/admin: every booking; staff: bookings with an item of their own
-- profile (regardless of "staff see all bookings" — notifications are personal)
create or replace function public.notification_visible(p_tenant uuid, p_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_tenant, array['owner', 'admin'])
    or (public.has_role(p_tenant, array['staff'])
        and public.current_staff_id(p_tenant) is not null
        and exists (select 1 from public.booking_items i
                    where i.booking_id = p_booking and i.tenant_id = p_tenant
                      and i.staff_id = public.current_staff_id(p_tenant)))
$$;

create policy notifications_select on public.notifications for select to authenticated
  using (public.notification_visible(tenant_id, booking_id));
create policy notification_reads_select on public.notification_reads for select to authenticated
  using (user_id = auth.uid() and tenant_id in (select public.user_tenant_ids()));

-- ---------------------------------------------------------------------------
-- Feed
-- ---------------------------------------------------------------------------

-- Everything the current user should see in one business, last 30 days.
-- A needs_action item only counts when the booking was created before it
-- ended (imported or back-dated history is not "missed").
create or replace function public.notification_feed(p_tenant uuid)
returns table (kind text, booking_id uuid, at timestamptz, is_read boolean)
language sql stable security definer set search_path = '' as $$
  with items as (
    select n.kind, n.booking_id, n.created_at as at
    from public.notifications n
    where n.tenant_id = p_tenant and n.created_at > now() - interval '30 days'
    union all
    select 'needs_action', b.id, b.ends_at
    from public.bookings b
    where b.tenant_id = p_tenant
      and b.status in ('pending', 'confirmed')
      and b.ends_at < now() and b.ends_at > now() - interval '30 days'
      and b.created_at < b.ends_at
  )
  select x.kind, x.booking_id, x.at,
         exists (select 1 from public.notification_reads r
                 where r.user_id = auth.uid() and r.kind = x.kind and r.booking_id = x.booking_id)
  from items x
  where p_tenant in (select public.user_tenant_ids())
    and public.notification_visible(p_tenant, x.booking_id)
$$;

-- The list for the bell: newest first, with what a person needs to act —
-- client, services, specialists, start time, status. Nothing else.
create or replace function public.my_notifications(p_tenant uuid, p_limit integer default 30)
returns table (
  kind text, booking_id uuid, at timestamptz, is_read boolean,
  starts_at timestamptz, status text, client_name text, services text, staff text
) language sql stable security definer set search_path = '' as $$
  select f.kind, f.booking_id, f.at, f.is_read, b.starts_at, b.status,
         nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
         (select string_agg(i.name_snapshot, ', ' order by i.sort_order)
            from public.booking_items i where i.booking_id = b.id),
         (select string_agg(distinct st.display_name, ', ')
            from public.booking_items i join public.staff st on st.id = i.staff_id
            where i.booking_id = b.id)
  from public.notification_feed(p_tenant) f
  join public.bookings b on b.id = f.booking_id and b.tenant_id = p_tenant
  left join public.clients c on c.id = b.client_id
  order by f.at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

create or replace function public.my_notifications_unread(p_tenant uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.notification_feed(p_tenant) f where not f.is_read
$$;

-- Mark some ([{kind, booking_id}]) or, with null, all of the caller's current
-- notifications as read. Only items in the caller's own feed can be marked.
create or replace function public.mark_notifications_read(p_tenant uuid, p_items jsonb default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null or not (p_tenant in (select public.user_tenant_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_items is not null and (jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100) then
    raise exception 'invalid items' using errcode = '22023';
  end if;
  insert into public.notification_reads (user_id, tenant_id, kind, booking_id)
  select auth.uid(), p_tenant, f.kind, f.booking_id
  from public.notification_feed(p_tenant) f
  where not f.is_read
    and (p_items is null or exists (
      select 1 from jsonb_array_elements(p_items) x
      where x ->> 'kind' = f.kind and x ->> 'booking_id' = f.booking_id::text))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.notification_visible(uuid, uuid) from public, anon;
revoke all on function public.notification_feed(uuid) from public, anon;
revoke all on function public.my_notifications(uuid, integer) from public, anon;
revoke all on function public.my_notifications_unread(uuid) from public, anon;
revoke all on function public.mark_notifications_read(uuid, jsonb) from public, anon;
grant execute on function public.notification_visible(uuid, uuid) to authenticated;
grant execute on function public.notification_feed(uuid) to authenticated;
grant execute on function public.my_notifications(uuid, integer) to authenticated;
grant execute on function public.my_notifications_unread(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Online booking → notification, in the same transaction as the booking.
-- public_create_booking as in 20261031093000, plus one insert at the end.
-- ---------------------------------------------------------------------------

create or replace function public.public_create_booking(
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
  p_otp_pass_hash text        -- null only when the business does not require a code
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
  if v_client is null then
    insert into public.clients (tenant_id, first_name, last_name, phone_e164, email, source)
    values (p_tenant, btrim(p_first_name), nullif(btrim(p_last_name), ''), p_phone,
            nullif(lower(btrim(p_email)), ''), 'online')
    returning id into v_client;
  else
    update public.clients set email = coalesce(email, nullif(lower(btrim(p_email)), ''))
    where id = v_client;
  end if;

  -- a ticked box is consent; an unticked one changes nothing
  if p_marketing_sms then
    insert into public.client_consents (tenant_id, client_id, channel, granted, source)
    values (p_tenant, v_client, 'sms', true, 'booking_page');
  end if;
  if p_marketing_email and nullif(btrim(p_email), '') is not null then
    insert into public.client_consents (tenant_id, client_id, channel, granted, source)
    values (p_tenant, v_client, 'email', true, 'booking_page');
  end if;

  v_status := case when v_settings.online_requires_approval then 'pending' else 'confirmed' end;
  select id into v_loc from public.locations where tenant_id = p_tenant and is_primary;
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
    select * into snap from public.item_snapshot(p_tenant, r.service_id, r.variant_id, r.staff_id, p_locale);
    if snap.resource_type is not null and (r.resource_id is null or not exists (
      select 1 from public.resources where id = r.resource_id and tenant_id = p_tenant and type = snap.resource_type and active
    )) then
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
