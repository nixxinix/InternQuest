-- 0003_places: cache for map lookups of typed places (Phase 1c).
--
-- Nominatim's usage policy asks apps to cache results and send at most one
-- request per second. Each typed place is looked up once; later saves of the
-- same text reuse the answer. Only the place text is stored, never who typed
-- it. "Not found" answers are cached too, so a typo isn't looked up again.
-- Server code only (service role): no API access.

create table public.geocode_cache (
  -- Normalized query: lowercase, no accents, single spaces (src/lib/geo/nominatim.ts).
  query text primary key check (char_length(query) between 2 and 80),
  found boolean not null,
  name text check (char_length(name) <= 80),
  -- Rounded to 2 decimals (about 1 km), same as profiles.
  lat numeric(5, 2) check (lat between -90 and 90),
  lng numeric(5, 2) check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  constraint found_has_place check (
    (found and name is not null and lat is not null and lng is not null)
    or (not found and name is null and lat is null and lng is null)
  )
);

alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from anon, authenticated;
