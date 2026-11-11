-- client_list (decision 024): add the first booking date, so "client since" on
-- the card can show when the client really started (imported clients come with
-- years of history but a fresh created_at). Appended as the last column.
create or replace view public.client_list with (security_invoker = true) as
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
  extract(month from c.birthday)::integer as birthday_month,
  s.first_booking_at
from public.clients c
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
