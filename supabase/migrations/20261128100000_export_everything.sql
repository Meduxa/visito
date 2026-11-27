-- Test plan #65: "download everything" left out part of the business's data.
-- The export now also has categories, variants, add-ons, branch services and
-- hours, closed days, resources, specialists' services, schedules, schedule
-- changes, time off and requests, client field definitions, extra charges on
-- visits, reviews, waitlist, pay rules, bonuses/deductions, payouts and the
-- subscription payments. Still never included: treatment notes (health data,
-- CLAUDE.md 3.3), SMS codes, access tokens, the audit log.

create or replace function public.export_tenant(p_tenant uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.has_role(p_tenant, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'business', (select to_jsonb(t) - 'settings' from public.tenants t where t.id = p_tenant),
    'settings', (select to_jsonb(s) from public.tenant_settings s where s.tenant_id = p_tenant),
    'locations', coalesce((select jsonb_agg(to_jsonb(l) order by l.sort_order) from public.locations l where l.tenant_id = p_tenant), '[]'),
    'location_hours', coalesce((select jsonb_agg(to_jsonb(x) order by x.location_id, x.weekday, x.start_time) from public.location_hours x where x.tenant_id = p_tenant), '[]'),
    'closures', coalesce((select jsonb_agg(to_jsonb(x) order by x.date) from public.closures x where x.tenant_id = p_tenant), '[]'),
    'resources', coalesce((select jsonb_agg(to_jsonb(x)) from public.resources x where x.tenant_id = p_tenant), '[]'),
    'service_categories', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.service_categories x where x.tenant_id = p_tenant), '[]'),
    'services', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.services x where x.tenant_id = p_tenant), '[]'),
    'service_variants', coalesce((select jsonb_agg(to_jsonb(x)) from public.service_variants x where x.tenant_id = p_tenant), '[]'),
    'service_addons', coalesce((select jsonb_agg(to_jsonb(x)) from public.service_addons x where x.tenant_id = p_tenant), '[]'),
    'service_locations', coalesce((select jsonb_agg(to_jsonb(x)) from public.service_locations x where x.tenant_id = p_tenant), '[]'),
    'staff', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.staff x where x.tenant_id = p_tenant), '[]'),
    'staff_services', coalesce((select jsonb_agg(to_jsonb(x)) from public.staff_services x where x.tenant_id = p_tenant), '[]'),
    'staff_schedules', coalesce((select jsonb_agg(to_jsonb(x) order by x.staff_id, x.weekday, x.start_time) from public.staff_schedules x where x.tenant_id = p_tenant), '[]'),
    'staff_schedule_overrides', coalesce((select jsonb_agg(to_jsonb(x)) from public.staff_schedule_overrides x where x.tenant_id = p_tenant), '[]'),
    'time_off', coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_at) from public.time_off x where x.tenant_id = p_tenant), '[]'),
    'time_off_requests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.time_off_requests x where x.tenant_id = p_tenant), '[]'),
    'client_fields', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.client_fields x where x.tenant_id = p_tenant), '[]'),
    'clients', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.clients x where x.tenant_id = p_tenant), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(x)) from public.client_consents x where x.tenant_id = p_tenant), '[]'),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object(
                  'items', (select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.booking_items i where i.booking_id = b.id),
                  'charges', (select jsonb_agg(to_jsonb(c) order by c.created_at) from public.booking_charges c where c.booking_id = b.id))
                  order by b.starts_at)
                  from public.bookings b where b.tenant_id = p_tenant), '[]'),
    'payments', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.payments x where x.tenant_id = p_tenant), '[]'),
    'reviews', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.reviews x where x.tenant_id = p_tenant), '[]'),
    'waitlist', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.waitlist x where x.tenant_id = p_tenant), '[]'),
    'staff_pay', coalesce((select jsonb_agg(to_jsonb(x)) from public.staff_pay x where x.tenant_id = p_tenant), '[]'),
    'staff_pay_rates', coalesce((select jsonb_agg(to_jsonb(x)) from public.staff_pay_rates x where x.tenant_id = p_tenant), '[]'),
    'pay_adjustments', coalesce((select jsonb_agg(to_jsonb(x) order by x.month) from public.pay_adjustments x where x.tenant_id = p_tenant), '[]'),
    'payouts', coalesce((select jsonb_agg(to_jsonb(x) order by x.month) from public.payouts x where x.tenant_id = p_tenant), '[]'),
    'subscription_payments', coalesce((select jsonb_agg(to_jsonb(x) - 'provider_payment_id' order by x.created_at) from public.billing_payments x where x.tenant_id = p_tenant), '[]'),
    'sms_messages', coalesce((select jsonb_agg(to_jsonb(x) - 'body' order by x.created_at) from public.sms_messages x where x.tenant_id = p_tenant), '[]')
  ) into v;
  perform public.write_audit(p_tenant, 'tenant.exported', 'tenant', p_tenant::text);
  return v;
end;
$$;
