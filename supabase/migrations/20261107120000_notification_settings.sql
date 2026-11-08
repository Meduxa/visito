-- Settings → Notifications (decision 021): the business decides who gets which
-- in-app notification. Two kinds × two audiences:
--   new online booking   → owner & admins / the specialist who serves it
--   booking needs status → owner & admins / the specialist who serves it
-- All on by default, so nothing changes for existing businesses.
--
-- "The specialist" is whoever's membership is linked to a specialist profile
-- on the booking — also an owner or admin who works as a specialist, so an
-- owner who switched managers' alerts off still hears about their own clients.

alter table public.tenant_settings
  add column notify_online_managers  boolean not null default true,
  add column notify_online_staff     boolean not null default true,
  add column notify_overdue_managers boolean not null default true,
  add column notify_overdue_staff    boolean not null default true;

create or replace function public.notification_visible(p_tenant uuid, p_booking uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  with s as (
    select * from public.tenant_settings where tenant_id = p_tenant
  )
  select coalesce((
    select
      (public.has_role(p_tenant, array['owner', 'admin'])
        and case p_kind when 'online_booking' then s.notify_online_managers
                        when 'needs_action' then s.notify_overdue_managers else false end)
      or
      (public.current_staff_id(p_tenant) is not null
        and case p_kind when 'online_booking' then s.notify_online_staff
                        when 'needs_action' then s.notify_overdue_staff else false end
        and exists (select 1 from public.booking_items i
                    where i.booking_id = p_booking and i.tenant_id = p_tenant
                      and i.staff_id = public.current_staff_id(p_tenant)))
    from s
  ), false)
$$;

-- the stored rows are all online bookings; the table policy keeps its 2-argument call
create or replace function public.notification_visible(p_tenant uuid, p_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.notification_visible(p_tenant, p_booking, 'online_booking')
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
  )
  select x.kind, x.booking_id, x.at,
         exists (select 1 from public.notification_reads r
                 where r.user_id = auth.uid() and r.kind = x.kind and r.booking_id = x.booking_id)
  from items x
  where p_tenant in (select public.user_tenant_ids())
    and public.notification_visible(p_tenant, x.booking_id, x.kind)
$$;

revoke all on function public.notification_visible(uuid, uuid, text) from public, anon;
grant execute on function public.notification_visible(uuid, uuid, text) to authenticated;
