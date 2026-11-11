-- Clients section, step 1 (decision 024, docs/plans/clients-section.md):
-- every client with their visit numbers and an automatic group, for the list,
-- its filters/sorting and the client card.
--
-- security_invoker: the view reads clients and bookings with the caller's own
-- rights, so RLS decides as everywhere else (staff see only their clients and
-- the bookings they work on). Money (spent, average) is returned only to
-- people who may see revenue; everyone else gets null.

-- Owner always; admins unless the owner hides revenue from them.
create or replace function public.can_see_revenue(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(p_tenant, array['owner'])
    or (public.has_role(p_tenant, array['admin'])
        and coalesce((select s.admins_see_revenue from public.tenant_settings s where s.tenant_id = p_tenant), true))
$$;
revoke execute on function public.can_see_revenue(uuid) from public, anon;
grant execute on function public.can_see_revenue(uuid) to authenticated;

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
    when s.last_visit_at < now() - interval '180 days' then 'lost'
    when s.last_visit_at < now() - interval '60 days' then 'at_risk'
    when s.visits <= 1 then 'new'
    when s.visits >= 5 then 'vip'
    else 'regular'
  end as segment,
  extract(month from c.birthday)::integer as birthday_month
from public.clients c
cross join lateral (
  select
    count(*) filter (where b.status = 'completed')::integer as visits,
    max(b.starts_at) filter (where b.status = 'completed') as last_visit_at,
    min(b.starts_at) filter (where b.status in ('pending', 'confirmed') and b.starts_at > now()) as next_visit_at,
    count(*) filter (where b.status in ('cancelled_by_client', 'cancelled_by_business'))::integer as cancellations,
    coalesce(sum(b.total_minor) filter (where b.status = 'completed'), 0)::integer as spent_minor
  from public.bookings b
  where b.tenant_id = c.tenant_id and b.client_id = c.id
) s;

revoke all on public.client_list from public, anon;
grant select on public.client_list to authenticated;
