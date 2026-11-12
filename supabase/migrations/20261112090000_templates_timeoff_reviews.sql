-- Three features taken from the Rezervo review (decisions 028–030):
-- 1. Ready services per business type (names in ka/en/ru).
-- 2. Staff ask for time off; owner/admin approve or decline.
-- 3. Reviews after a visit: an SMS link, a 1–5 rating and a comment, replies,
--    and the published ones on the booking page.

-- ===========================================================================
-- 1. Ready services
-- ===========================================================================
-- p_rows: [{category: {ka,en,ru}, name: {ka,en,ru}, price_minor, price_type, duration_min}]
-- A category is matched by its Georgian name; a service whose Georgian name
-- already exists in that business is skipped (adding twice changes nothing).
create or replace function public.add_template_services(p_tenant uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  v_cat uuid;
  v_count integer := 0;
  v_sort integer;
begin
  if not public.has_role(p_tenant, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'invalid rows' using errcode = '22023';
  end if;
  select coalesce(max(sort_order), 0) into v_sort from public.services where tenant_id = p_tenant;
  for r in select * from jsonb_array_elements(p_rows) loop
    if exists (select 1 from public.services s
               where s.tenant_id = p_tenant and lower(s.name_i18n ->> 'ka') = lower(r -> 'name' ->> 'ka')) then
      continue;
    end if;
    select id into v_cat from public.service_categories
    where tenant_id = p_tenant and lower(name_i18n ->> 'ka') = lower(r -> 'category' ->> 'ka') limit 1;
    if v_cat is null then
      insert into public.service_categories (tenant_id, name_i18n, sort_order)
      values (p_tenant, r -> 'category',
              (select coalesce(max(sort_order), 0) + 1 from public.service_categories where tenant_id = p_tenant))
      returning id into v_cat;
    end if;
    v_sort := v_sort + 1;
    insert into public.services (tenant_id, category_id, name_i18n, price_type, price_minor, duration_min, sort_order)
    values (p_tenant, v_cat, r -> 'name', r ->> 'price_type', (r ->> 'price_minor')::integer,
            (r ->> 'duration_min')::integer, v_sort);
    v_count := v_count + 1;
  end loop;
  perform public.write_audit(p_tenant, 'services.templates_added', 'service', null, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;
revoke all on function public.add_template_services(uuid, jsonb) from public, anon;
grant execute on function public.add_template_services(uuid, jsonb) to authenticated;

-- ===========================================================================
-- 2. Time-off requests
-- ===========================================================================
create table public.time_off_requests (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  staff_id       uuid not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null check (ends_at > starts_at),
  reason         text not null default 'vacation' check (reason in ('vacation', 'sick', 'other')),
  note           text check (char_length(note) <= 300),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  decision_note  text check (char_length(decision_note) <= 300),
  decided_by     uuid references auth.users (id) on delete set null,
  decided_at     timestamptz,
  time_off_id    uuid references public.time_off (id) on delete set null,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete cascade,
  check (ends_at - starts_at <= interval '90 days')
);
create index time_off_requests_tenant on public.time_off_requests (tenant_id, status, created_at desc);
alter table public.time_off_requests enable row level security;
alter table public.time_off_requests force row level security;
revoke all on public.time_off_requests from anon, authenticated;
grant select on public.time_off_requests to authenticated;
create trigger time_off_requests_tenant_fixed before update on public.time_off_requests
  for each row execute function public.prevent_tenant_change();
-- managers see all; a staff member only their own profile's. Writes only through the functions below.
create policy time_off_requests_select on public.time_off_requests for select to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin'])
         or (public.has_role(tenant_id, array['staff']) and staff_id = public.current_staff_id(tenant_id)));

-- A staff member asks for time off for their own profile (the profile comes from
-- the membership, never from the browser). Managers can file one for anyone.
create or replace function public.request_time_off(
  p_tenant uuid, p_starts timestamptz, p_ends timestamptz, p_reason text, p_note text, p_staff uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_staff uuid;
  v_id uuid;
begin
  if public.has_role(p_tenant, array['owner', 'admin']) and p_staff is not null then
    v_staff := p_staff;
  else
    v_staff := public.current_staff_id(p_tenant);
  end if;
  if v_staff is null or not exists (select 1 from public.staff s where s.id = v_staff and s.tenant_id = p_tenant) then
    raise exception 'no staff profile' using errcode = '42501';
  end if;
  if p_ends <= p_starts or p_ends < now() then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  if (select count(*) from public.time_off_requests r
      where r.staff_id = v_staff and r.status = 'pending') >= 10 then
    raise exception 'too many open requests' using errcode = 'P0006';
  end if;
  insert into public.time_off_requests (tenant_id, staff_id, starts_at, ends_at, reason, note, created_by)
  values (p_tenant, v_staff, p_starts, p_ends, coalesce(p_reason, 'vacation'), nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  perform public.write_audit(p_tenant, 'time_off.requested', 'time_off_request', v_id::text,
    jsonb_build_object('staff_id', v_staff, 'starts_at', p_starts, 'ends_at', p_ends));
  return v_id;
end;
$$;

-- Owner/admin approve (the time off is created) or decline. Only pending requests.
create or replace function public.decide_time_off(p_id uuid, p_approve boolean, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.time_off_requests;
  v_off uuid;
begin
  select * into r from public.time_off_requests where id = p_id for update;
  if r.id is null or not public.has_role(r.tenant_id, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    raise exception 'already decided' using errcode = 'P0001';
  end if;
  if p_approve then
    insert into public.time_off (tenant_id, staff_id, starts_at, ends_at, reason, note)
    values (r.tenant_id, r.staff_id, r.starts_at, r.ends_at, r.reason, r.note)
    returning id into v_off;
  end if;
  update public.time_off_requests set
    status = case when p_approve then 'approved' else 'declined' end,
    decision_note = nullif(btrim(p_note), ''),
    decided_by = auth.uid(), decided_at = now(), time_off_id = v_off
  where id = p_id;
  perform public.write_audit(r.tenant_id, case when p_approve then 'time_off.approved' else 'time_off.declined' end,
    'time_off_request', p_id::text, jsonb_build_object('staff_id', r.staff_id));
  return v_off;
end;
$$;

-- The person who asked (or a manager) withdraws a request that is still pending.
create or replace function public.cancel_time_off_request(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.time_off_requests;
begin
  select * into r from public.time_off_requests where id = p_id for update;
  if r.id is null or not (
       public.has_role(r.tenant_id, array['owner', 'admin'])
       or (public.has_role(r.tenant_id, array['staff']) and r.staff_id = public.current_staff_id(r.tenant_id))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    raise exception 'already decided' using errcode = 'P0001';
  end if;
  update public.time_off_requests set status = 'cancelled' where id = p_id;
end;
$$;

-- Bookings the staff member has in the asked period (shown before approving).
create or replace function public.time_off_conflicts(p_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(distinct i.booking_id)::integer
  from public.time_off_requests r
  join public.booking_items i on i.staff_id = r.staff_id and i.active
       and i.starts_at < r.ends_at and i.ends_at > r.starts_at
  join public.bookings b on b.id = i.booking_id and b.status in ('pending', 'confirmed', 'arrived', 'in_progress')
  where r.id = p_id and public.has_role(r.tenant_id, array['owner', 'admin'])
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.request_time_off(uuid, timestamptz, timestamptz, text, text, uuid)',
    'public.decide_time_off(uuid, boolean, text)',
    'public.cancel_time_off_request(uuid)',
    'public.time_off_conflicts(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- ===========================================================================
-- 3. Reviews
-- ===========================================================================
alter table public.tenant_settings
  add column reviews_ask boolean not null default false,            -- SMS after a finished visit (costs SMS)
  add column reviews_delay_hours integer not null default 2 check (reviews_delay_hours between 1 and 48),
  add column reviews_public boolean not null default true;          -- show published reviews on the booking page

-- one review link per finished visit; the key is stored only as an HMAC
create table public.review_requests (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days'
);
alter table public.review_requests enable row level security;
alter table public.review_requests force row level security;
revoke all on public.review_requests from anon, authenticated;
-- no policies: only server functions use it

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  booking_id  uuid not null unique,
  client_id   uuid,
  staff_id    uuid,
  rating      integer not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 1000),
  status      text not null default 'published' check (status in ('published', 'hidden')),
  reply       text check (char_length(reply) <= 1000),
  replied_at  timestamptz,
  replied_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (booking_id, tenant_id) references public.bookings (id, tenant_id) on delete cascade,
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete set null (client_id),
  foreign key (staff_id, tenant_id) references public.staff (id, tenant_id) on delete set null (staff_id)
);
create index reviews_tenant on public.reviews (tenant_id, created_at desc);
alter table public.reviews enable row level security;
alter table public.reviews force row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
create trigger reviews_tenant_fixed before update on public.reviews
  for each row execute function public.prevent_tenant_change();
-- managers see every review; staff the ones about their own visits
create policy reviews_select on public.reviews for select to authenticated
  using (public.has_role(tenant_id, array['owner', 'admin'])
         or (public.has_role(tenant_id, array['staff']) and staff_id = public.current_staff_id(tenant_id)));

-- reply / hide / show: owner and admin
create or replace function public.moderate_review(p_id uuid, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reviews;
begin
  select * into r from public.reviews where id = p_id for update;
  if r.id is null or not public.has_role(r.tenant_id, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('published', 'hidden') or char_length(coalesce(p_reply, '')) > 1000 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  update public.reviews set
    status = p_status,
    reply = nullif(btrim(p_reply), ''),
    replied_at = case when nullif(btrim(p_reply), '') is distinct from r.reply then now() else replied_at end,
    replied_by = case when nullif(btrim(p_reply), '') is distinct from r.reply then auth.uid() else replied_by end
  where id = p_id;
  perform public.write_audit(r.tenant_id, 'review.moderated', 'review', p_id::text,
    jsonb_build_object('status', p_status, 'replied', nullif(btrim(p_reply), '') is not null));
end;
$$;
revoke all on function public.moderate_review(uuid, text, text) from public, anon;
grant execute on function public.moderate_review(uuid, text, text) to authenticated;

-- Finished visits whose review SMS is due (run by the SMS job): the business
-- asked for it, the visit ended reviews_delay_hours ago (at most 3 days), the
-- client has a phone, and no link was made yet.
create or replace function public.reviews_due()
returns table (
  tenant_id uuid, booking_id uuid, client_id uuid, phone text, first_name text, business text,
  timezone text, locale text, quiet_start time, quiet_end time
) language sql stable security definer set search_path = '' as $$
  select b.tenant_id, b.id, c.id, c.phone_e164, c.first_name, t.name, t.timezone, t.locale_default,
         s.quiet_start, s.quiet_end
  from public.bookings b
  join public.tenants t on t.id = b.tenant_id and t.status in ('trial', 'active', 'past_due')
  join public.tenant_settings s on s.tenant_id = b.tenant_id and s.reviews_ask
  join public.clients c on c.id = b.client_id and c.phone_e164 is not null and c.anonymized_at is null
  where b.status = 'completed'
    and b.ends_at <= now() - make_interval(hours => s.reviews_delay_hours)
    and b.ends_at > now() - interval '3 days'
    and not exists (select 1 from public.review_requests q where q.booking_id = b.id)
    and not exists (select 1 from public.reviews v where v.booking_id = b.id)
  limit 200
$$;

create or replace function public.add_review_request(p_booking uuid, p_token_hash text)
returns boolean language sql security definer set search_path = '' as $$
  with ins as (
    insert into public.review_requests (booking_id, tenant_id, token_hash)
    select b.id, b.tenant_id, p_token_hash from public.bookings b where b.id = p_booking
    on conflict (booking_id) do nothing
    returning 1
  ) select exists (select 1 from ins)
$$;

-- The public review page: what the link is about (no personal data beyond the first name).
create or replace function public.public_review_get(p_token_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'business', t.name, 'slug', t.slug, 'locale', t.locale_default, 'timezone', t.timezone,
    'starts_at', b.starts_at, 'first_name', c.first_name,
    'services', (select string_agg(i.name_snapshot, ', ' order by i.sort_order) from public.booking_items i where i.booking_id = b.id),
    'staff', (select string_agg(distinct st.display_name, ', ') from public.booking_items i join public.staff st on st.id = i.staff_id where i.booking_id = b.id),
    'done', exists (select 1 from public.reviews v where v.booking_id = b.id),
    'expired', q.expires_at < now()
  )
  from public.review_requests q
  join public.bookings b on b.id = q.booking_id
  join public.tenants t on t.id = q.tenant_id
  left join public.clients c on c.id = b.client_id
  where q.token_hash = p_token_hash
$$;

create or replace function public.public_review_submit(p_token_hash text, p_rating integer, p_comment text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  q public.review_requests;
  b public.bookings;
  v_staff uuid;
begin
  select * into q from public.review_requests where token_hash = p_token_hash;
  if q.booking_id is null then return 'not_found'; end if;
  if q.expires_at < now() then return 'expired'; end if;
  if p_rating not between 1 and 5 or char_length(coalesce(p_comment, '')) > 1000 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  select * into b from public.bookings where id = q.booking_id;
  select i.staff_id into v_staff from public.booking_items i where i.booking_id = b.id order by i.sort_order limit 1;
  insert into public.reviews (tenant_id, booking_id, client_id, staff_id, rating, comment)
  values (b.tenant_id, b.id, b.client_id, v_staff, p_rating, nullif(btrim(p_comment), ''))
  on conflict (booking_id) do nothing;
  if not found then return 'done'; end if;
  return 'ok';
end;
$$;

-- Published reviews for the booking page (only when the business shows them).
create or replace function public.public_reviews(p_tenant uuid, p_limit integer default 6)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not coalesce((select s.reviews_public from public.tenant_settings s where s.tenant_id = p_tenant), false)
         then null else jsonb_build_object(
    'count', (select count(*) from public.reviews v where v.tenant_id = p_tenant and v.status = 'published'),
    'average', (select round(avg(rating)::numeric, 1) from public.reviews v where v.tenant_id = p_tenant and v.status = 'published'),
    'items', coalesce((select jsonb_agg(x) from (
       select v.rating, v.comment, v.reply, v.created_at,
              coalesce(left(c.first_name, 40), '') as first_name
       from public.reviews v left join public.clients c on c.id = v.client_id and c.anonymized_at is null
       where v.tenant_id = p_tenant and v.status = 'published' and v.comment is not null
       order by v.created_at desc limit least(greatest(p_limit, 1), 20)) x), '[]'::jsonb)
  ) end
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.reviews_due()',
    'public.add_review_request(uuid, text)',
    'public.public_review_get(text)',
    'public.public_review_submit(text, integer, text)',
    'public.public_reviews(uuid, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- the SMS log knows the new message type
alter table public.sms_messages drop constraint if exists sms_messages_type_check;
alter table public.sms_messages add constraint sms_messages_type_check check (type in (
  'otp', 'confirmed', 'pending', 'reminder', 'rescheduled', 'cancelled', 'manual', 'marketing', 'review'));
