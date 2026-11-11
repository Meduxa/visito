-- Online booking extras seen at competitors (decision 023):
--  * online_show_prices: the booking page may hide prices (some salons quote in person)
--  * online_max_upcoming: how many upcoming visits one client may hold at once
--    when booking online (0 = no limit). Checked here, inside the booking
--    function, so no browser trick can skip it.
-- Both columns live on tenant_settings, so the existing RLS policies apply
-- (members read, owner/admin write).

alter table public.tenant_settings
  add column online_show_prices boolean not null default true,
  add column online_max_upcoming integer not null default 0
    check (online_max_upcoming between 0 and 20);

-- Same as 20261107090000_notifications.sql, plus the upcoming-visit limit (P0006).
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
  -- limit on upcoming visits per client (counts every active future visit, however it was booked);
  -- the row lock makes two simultaneous bookings by the same client wait for each other
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
