-- Fixes from the test salon run (docs/test-plan.md, problems #19, #23, #25).
--
-- 1. The bell tells the business when a client moves or cancels a visit with
--    the manage link (kinds 'client_moved', 'client_cancelled'). Who sees it
--    follows the "new online booking" settings. A second move of the same
--    visit brings the notice back as unread.
-- 2. The manage page: the branch name also for the main branch when there are
--    several; "from" prices; prices hidden when the business hides them online.
-- 3. Branch names/addresses and staff positions may have English and Russian
--    versions (`translations` = {"en": {...}, "ru": {...}}); Georgian stays in
--    the normal columns and is the fallback.

-- 1 -------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('online_booking', 'client_moved', 'client_cancelled'));

alter table public.notification_reads drop constraint notification_reads_kind_check;
alter table public.notification_reads add constraint notification_reads_kind_check
  check (kind in ('online_booking', 'needs_action', 'needs_followup', 'client_moved', 'client_cancelled'));

create or replace function public.notification_visible(p_tenant uuid, p_booking uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  with s as (
    select * from public.tenant_settings where tenant_id = p_tenant
  )
  select coalesce((
    select
      (public.has_role(p_tenant, array['owner', 'admin'])
        and case when p_kind in ('online_booking', 'needs_followup', 'client_moved', 'client_cancelled')
                   then s.notify_online_managers
                 when p_kind = 'needs_action' then s.notify_overdue_managers else false end)
      or
      (public.current_staff_id(p_tenant) is not null
        and case when p_kind in ('online_booking', 'needs_followup', 'client_moved', 'client_cancelled')
                   then s.notify_online_staff
                 when p_kind = 'needs_action' then s.notify_overdue_staff else false end
        and exists (select 1 from public.booking_items i
                    where i.booking_id = p_booking and i.tenant_id = p_tenant
                      and i.staff_id = public.current_staff_id(p_tenant)))
    from s
  ), false)
$$;

-- public_cancel_booking / public_move_booking write these history reasons
create or replace function public.notify_client_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_kind text;
begin
  v_kind := case new.reason when 'manage link' then 'client_cancelled'
                            when 'rescheduled online' then 'client_moved' end;
  if v_kind is null then return new; end if;
  insert into public.notifications (tenant_id, kind, booking_id)
  values (new.tenant_id, v_kind, new.booking_id)
  on conflict (kind, booking_id) do update set created_at = now();
  delete from public.notification_reads where kind = v_kind and booking_id = new.booking_id;
  return new;
end;
$$;
revoke all on function public.notify_client_change() from public, anon, authenticated;

create trigger booking_status_history_notify
  after insert on public.booking_status_history
  for each row when (new.reason in ('manage link', 'rescheduled online'))
  execute function public.notify_client_change();

-- 3 (columns first: the manage view below reads them) -----------------------
alter table public.locations
  add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object' and pg_column_size(translations) < 4000);
alter table public.staff
  add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object' and pg_column_size(translations) < 2000);

-- 2 -------------------------------------------------------------------------
create or replace function public.public_manage_view(p_token_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'booking_id', b.id, 'tenant_id', b.tenant_id, 'slug', t.slug, 'business', t.name, 'timezone', t.timezone,
    'status', b.status, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'total_minor', b.total_minor,
    'first_name', c.first_name, 'cancel_window_min', s.cancel_window_min,
    'phone', case when l.is_primary then coalesce(s.phone, l.phone) else coalesce(l.phone, s.phone) end,
    'address', l.address, 'location_id', l.id,
    -- the branch's name whenever the business has more than one
    'branch', case when (select count(*) from public.locations x where x.tenant_id = b.tenant_id and x.active) > 1
                   then l.name end,
    'location_translations', coalesce(l.translations, '{}'::jsonb),
    'show_prices', s.online_show_prices,
    'price_from', exists (select 1 from public.booking_items i
                          where i.booking_id = b.id and i.price_type_snapshot in ('from', 'range')),
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
