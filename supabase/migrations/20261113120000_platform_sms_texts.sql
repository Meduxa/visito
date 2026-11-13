-- SMS texts written by the Visito team for every business (decision 033).
-- During the pilot, businesses do not edit texts; automatic SMS use the row
-- here for that message and language, or the built-in default when there is none.
-- Not tenant data: no tenant_id. Only Visito's platform admins read and write it;
-- the sending jobs read it with the server key.

create table public.sms_platform_templates (
  type        text not null check (type in ('confirmed', 'pending', 'reminder', 'rescheduled', 'cancelled', 'review')),
  locale      text not null check (locale in ('ka', 'en', 'ru')),
  body        text not null check (char_length(btrim(body)) between 1 and 600),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  primary key (type, locale)
);

alter table public.sms_platform_templates enable row level security;
alter table public.sms_platform_templates force row level security;
revoke all on public.sms_platform_templates from anon, authenticated;
grant select, insert, update, delete on public.sms_platform_templates to authenticated;

create policy sms_platform_templates_select on public.sms_platform_templates for select to authenticated
  using (public.is_platform_admin());
create policy sms_platform_templates_insert on public.sms_platform_templates for insert to authenticated
  with check (public.is_platform_admin());
create policy sms_platform_templates_update on public.sms_platform_templates for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy sms_platform_templates_delete on public.sms_platform_templates for delete to authenticated
  using (public.is_platform_admin());
