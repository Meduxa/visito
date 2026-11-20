-- "Requires an additional service" (decision 037, Levan 2026-11-15).
-- A service (e.g. hair colouring) can name the service that must follow it
-- (e.g. wash and dry) and how many minutes after the first one ends it starts.
-- When staff book the first service, the booking form reminds them and adds the
-- second one to the same visit; the specialist is free in between.
-- Same table, same RLS policies (members read, owner/admin write).

alter table public.services
  add column followup_service_id uuid,
  add column followup_after_min integer not null default 120
    check (followup_after_min between 0 and 720),
  -- only a service of the same business; deleting it simply clears the link
  add constraint services_followup_fk foreign key (followup_service_id, tenant_id)
    references public.services (id, tenant_id) on delete set null (followup_service_id),
  add constraint services_followup_not_self check (followup_service_id is null or followup_service_id <> id);
