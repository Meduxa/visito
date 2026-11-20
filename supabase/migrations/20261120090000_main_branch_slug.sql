-- Main branch link name (bug found 2026-11-20 while preparing the full test).
-- The branches migration gave existing main branches the link name "main", but a
-- business created later got its main branch from the tenant trigger without one.
-- With a second branch, the booking page lists only branches that have a link
-- name, so the main branch disappeared from the client's branch choice.

-- 1. Every new main branch gets "main" (the tenant trigger inserts it without a slug).
create function public.default_primary_location_slug()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_primary and new.slug is null
     and not exists (select 1 from public.locations l where l.tenant_id = new.tenant_id and l.slug = 'main') then
    new.slug := 'main';
  end if;
  return new;
end;
$$;

create trigger locations_primary_slug
  before insert or update of is_primary, slug on public.locations
  for each row execute function public.default_primary_location_slug();

-- 2. Main branches created since then.
update public.locations p set slug = 'main'
 where p.is_primary and p.slug is null
   and not exists (select 1 from public.locations l where l.tenant_id = p.tenant_id and l.slug = 'main');
