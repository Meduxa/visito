-- Fixes from test day 6 (docs/test-plan.md).
--
-- #56 Client card "spent": the money actually received for the client's visits
-- (payments), not only the price of visits marked "completed" — a part-paid
-- visit that nobody marked completed showed 0 ₾. The average is per visit that
-- brought money. "Visits" stays the number of completed visits.

drop view public.client_list;
create view public.client_list with (security_invoker = true) as
select
  c.*,
  s.visits,
  s.last_visit_at,
  s.next_visit_at,
  s.cancellations,
  case when public.can_see_revenue(c.tenant_id) then s.spent_minor end as spent_minor,
  case when public.can_see_revenue(c.tenant_id) and s.paid_visits > 0
       then round(s.spent_minor::numeric / s.paid_visits)::integer end as average_minor,
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
    coalesce(sum(b.paid_minor), 0)::integer as spent_minor,
    count(*) filter (where b.paid_minor > 0)::integer as paid_visits,
    min(b.starts_at) as first_booking_at
  from public.bookings b
  where b.tenant_id = c.tenant_id and b.client_id = c.id
) s;

revoke all on public.client_list from public, anon;
grant select on public.client_list to authenticated;
