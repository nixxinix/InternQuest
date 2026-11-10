-- 0010_listing_updated_at: "last edited" on listings.
--
-- The company dashboard (Phase 6) shows when each listing was last edited, but
-- `internships` only had `created_at`. Existing rows start at their creation
-- time; from now on any change (a company's edit, an import refresh, an admin
-- hide) updates it.

alter table public.internships add column updated_at timestamptz;
update public.internships set updated_at = created_at;
alter table public.internships alter column updated_at set not null;
alter table public.internships alter column updated_at set default now();

create trigger internships_updated_at
  before update on public.internships
  for each row execute function public.set_updated_at();
