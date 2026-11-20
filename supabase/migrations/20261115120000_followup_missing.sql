-- "Additional service not added" (decision 037, Levan 2026-11-15).
-- Online booking stays as it is: the client books only the main service. Staff
-- see a mark on such visits and add the additional service by hand.
--
-- 1. add_booking_item: adds one service to an existing visit, at its own time
--    (same checks and snapshots as create_booking; the overlap constraint is
--    the final judge).
-- 2. A computed bell notification "needs_followup": a future online visit with
--    a service whose additional service is missing from the visit. Not stored —
--    it disappears by itself once the service is added (like needs_action).
--    Who sees it follows the "new online booking" settings.

create function public.add_booking_item(
  p_tenant uuid, p_booking uuid, p_service uuid, p_staff uuid, p_starts_at timestamptz,
  p_locale text default 'ka'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  snap record;
  v_item uuid;
  v_end timestamptz;
begin
  if not public.may_book_for(p_tenant, array[p_staff]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into b from public.bookings where id = p_booking and tenant_id = p_tenant for update;
  if b.id is null or b.status not in ('pending', 'confirmed', 'arrived', 'in_progress') then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.booking_items where booking_id = p_booking) >= 10 then
    raise exception 'invalid items' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff where id = p_staff and tenant_id = p_tenant and active) then
    raise exception 'staff not available' using errcode = 'P0002';
  end if;
  select * into snap from public.item_snapshot(p_tenant, p_service, null, p_staff, p_locale, b.location_id);

  v_end := p_starts_at + make_interval(mins => snap.duration_min);
  insert into public.booking_items (tenant_id, booking_id, service_id, variant_id, staff_id, resource_id,
    name_snapshot, price_type_snapshot, price_minor_snapshot, duration_min_snapshot, buffer_min_snapshot,
    starts_at, ends_at, blocked_until, sort_order)
  values (p_tenant, p_booking, p_service, null, p_staff, null,
    snap.name, snap.price_type, snap.price_minor, snap.duration_min, snap.buffer_min,
    p_starts_at, v_end, v_end + make_interval(mins => snap.buffer_min),
    (select coalesce(max(sort_order), -1) + 1 from public.booking_items where booking_id = p_booking))
  returning id into v_item;

  update public.bookings
     set starts_at = least(starts_at, p_starts_at),
         ends_at = greatest(ends_at, v_end),
         total_minor = total_minor + snap.price_minor
   where id = p_booking;
  return v_item;
end;
$$;

revoke all on function public.add_booking_item(uuid, uuid, uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.add_booking_item(uuid, uuid, uuid, uuid, timestamptz, text) to authenticated;

-- the new notification kind can be marked read
alter table public.notification_reads drop constraint notification_reads_kind_check;
alter table public.notification_reads add constraint notification_reads_kind_check
  check (kind in ('online_booking', 'needs_action', 'needs_followup'));

create or replace function public.notification_visible(p_tenant uuid, p_booking uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  with s as (
    select * from public.tenant_settings where tenant_id = p_tenant
  )
  select coalesce((
    select
      (public.has_role(p_tenant, array['owner', 'admin'])
        and case p_kind when 'online_booking' then s.notify_online_managers
                        when 'needs_followup' then s.notify_online_managers
                        when 'needs_action' then s.notify_overdue_managers else false end)
      or
      (public.current_staff_id(p_tenant) is not null
        and case p_kind when 'online_booking' then s.notify_online_staff
                        when 'needs_followup' then s.notify_online_staff
                        when 'needs_action' then s.notify_overdue_staff else false end
        and exists (select 1 from public.booking_items i
                    where i.booking_id = p_booking and i.tenant_id = p_tenant
                      and i.staff_id = public.current_staff_id(p_tenant)))
    from s
  ), false)
$$;

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
    union all
    -- online visits still to come whose additional service is missing
    select 'needs_followup', b.id, b.created_at
    from public.bookings b
    where b.tenant_id = p_tenant
      and b.source = 'online'
      and b.status in ('pending', 'confirmed')
      and b.starts_at > now()
      and exists (
        select 1 from public.booking_items i
        join public.services s on s.id = i.service_id and s.tenant_id = i.tenant_id
        where i.booking_id = b.id and s.followup_service_id is not null
          and not exists (select 1 from public.booking_items j
                          where j.booking_id = b.id and j.service_id = s.followup_service_id))
  )
  select x.kind, x.booking_id, x.at,
         exists (select 1 from public.notification_reads r
                 where r.user_id = auth.uid() and r.kind = x.kind and r.booking_id = x.booking_id)
  from items x
  where p_tenant in (select public.user_tenant_ids())
    and public.notification_visible(p_tenant, x.booking_id, x.kind)
$$;
