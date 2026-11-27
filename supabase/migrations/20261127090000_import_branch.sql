-- Booking import with several branches (docs/test-plan.md #36): an imported visit goes
-- to the branch where its specialist works at that time — a date override first,
-- then the weekly schedule for that weekday, both in the business's time zone — and
-- to the main branch when neither says (or the business has one branch).

create or replace function public.staff_location_at(p_tenant uuid, p_staff uuid, p_at timestamptz)
returns uuid language sql stable security definer set search_path = '' as $$
  with t as (
    select (p_at at time zone coalesce(tn.timezone, 'Asia/Tbilisi')) as local
    from public.tenants tn where tn.id = p_tenant
  )
  select coalesce(
    (select o.location_id from public.staff_schedule_overrides o, t
      where o.tenant_id = p_tenant and o.staff_id = p_staff and o.date = t.local::date
        and not o.is_day_off and o.location_id is not null
      order by (t.local::time between o.start_time and o.end_time) desc limit 1),
    (select s.location_id from public.staff_schedules s, t
      where s.tenant_id = p_tenant and s.staff_id = p_staff
        and s.weekday = extract(isodow from t.local)::smallint and s.location_id is not null
      order by (t.local::time between s.start_time and s.end_time) desc, s.start_time limit 1),
    (select l.id from public.locations l where l.tenant_id = p_tenant and l.is_primary)
  )
$$;
revoke all on function public.staff_location_at(uuid, uuid, timestamptz) from public, anon, authenticated;

-- as in 20261028090000_phase3b.sql, except the branch
create or replace function public.import_bookings(p_tenant uuid, p_rows jsonb, p_file_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  v_client uuid;
  v_booking uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_imported integer := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_status text;
begin
  if not public.has_role(p_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'invalid import' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if not exists (select 1 from public.staff where id = (r ->> 'staff_id')::uuid and tenant_id = p_tenant)
         or not exists (select 1 from public.services where id = (r ->> 'service_id')::uuid and tenant_id = p_tenant) then
        raise exception 'unknown staff or service' using errcode = 'P0002';
      end if;

      v_client := null;
      if nullif(r ->> 'phone_e164', '') is not null then
        select id into v_client from public.clients where tenant_id = p_tenant and phone_e164 = r ->> 'phone_e164';
      end if;
      if v_client is null and nullif(btrim(r ->> 'first_name'), '') is not null then
        insert into public.clients (tenant_id, first_name, last_name, phone_e164, source, created_by)
        values (p_tenant, btrim(r ->> 'first_name'), nullif(btrim(r ->> 'last_name'), ''),
                nullif(r ->> 'phone_e164', ''), 'import', auth.uid())
        returning id into v_client;
      end if;

      v_start := (r ->> 'starts_at')::timestamptz;
      v_end := v_start + make_interval(mins => (r ->> 'duration_min')::integer);
      v_status := case when r ->> 'status' in ('confirmed', 'completed', 'no_show', 'cancelled_by_client', 'cancelled_by_business')
                       then r ->> 'status' else (case when v_start < now() then 'completed' else 'confirmed' end) end;

      insert into public.bookings (tenant_id, client_id, starts_at, ends_at, status, source, total_minor, created_by,
                                   location_id)
      values (p_tenant, v_client, v_start, v_end, v_status, 'import', (r ->> 'price_minor')::integer, auth.uid(),
              public.staff_location_at(p_tenant, (r ->> 'staff_id')::uuid, v_start))
      returning id into v_booking;

      insert into public.booking_items (tenant_id, booking_id, service_id, staff_id, name_snapshot, price_type_snapshot,
        price_minor_snapshot, duration_min_snapshot, buffer_min_snapshot, starts_at, ends_at, blocked_until, active)
      values (p_tenant, v_booking, (r ->> 'service_id')::uuid, (r ->> 'staff_id')::uuid, r ->> 'name', 'fixed',
        (r ->> 'price_minor')::integer, (r ->> 'duration_min')::integer, 0, v_start, v_end, v_end,
        v_status not in ('no_show', 'cancelled_by_client', 'cancelled_by_business'));

      insert into public.booking_status_history (tenant_id, booking_id, to_status, changed_by, reason)
      values (p_tenant, v_booking, v_status, auth.uid(), 'imported');
      v_imported := v_imported + 1;
    exception
      when exclusion_violation then
        v_skipped := v_skipped || jsonb_build_object('line', r -> 'line', 'reason', 'overlap');
      when others then
        v_skipped := v_skipped || jsonb_build_object('line', r -> 'line', 'reason', 'invalid');
    end;
  end loop;

  insert into public.booking_imports (tenant_id, file_name, rows_total, rows_imported, rows_skipped, created_by)
  values (p_tenant, left(p_file_name, 200), jsonb_array_length(p_rows), v_imported, jsonb_array_length(v_skipped), auth.uid());
  perform public.write_audit(p_tenant, 'bookings.imported', 'booking', null,
    jsonb_build_object('imported', v_imported, 'skipped', jsonb_array_length(v_skipped)));
  return jsonb_build_object('imported', v_imported, 'skipped', v_skipped);
end;
$$;
