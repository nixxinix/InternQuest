-- 0007_imports: the daily listings refresh (Phase 5, SPEC §5.3).
--
--   * One row per source posting (source + source_ref), so a refresh updates
--     instead of duplicating.
--   * import_runs: a log of each run (counts only, never posting text), for
--     the admin and for spotting quota or API problems. Server only.
--   * expire_listings(): hides listings past their deadline (Manila date), and
--     aggregator listings not seen for a while (dead postings). Server only.

create unique index internships_source_ref on public.internships (source, source_ref) where source_ref is not null;
create index internships_active_checked on public.internships (source, last_checked) where is_active;

create table public.import_runs (
  id bigint generated always as identity primary key,
  source text not null check (char_length(source) <= 40),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  -- Reasons and counts, e.g. {"not an internship": 4, "direct post wins": 1}.
  skipped jsonb not null default '{}',
  expired integer not null default 0,
  stale integer not null default 0,
  error text check (char_length(error) <= 500)
);
create index import_runs_started on public.import_runs (started_at desc);

alter table public.import_runs enable row level security;
revoke all on public.import_runs from anon, authenticated;

create or replace function public.expire_listings(p_stale_days integer)
returns table (expired integer, stale integer)
language plpgsql
set search_path = ''
as $$
declare
  n_expired integer;
  n_stale integer;
begin
  update public.internships
     set is_active = false
   where is_active
     and deadline is not null
     and deadline < (now() at time zone 'Asia/Manila')::date;
  get diagnostics n_expired = row_count;

  update public.internships
     set is_active = false
   where is_active
     and source = 'jsearch'
     and last_checked < now() - make_interval(days => p_stale_days);
  get diagnostics n_stale = row_count;

  return query select n_expired, n_stale;
end;
$$;

revoke execute on function public.expire_listings(integer) from public, anon, authenticated;
grant execute on function public.expire_listings(integer) to service_role;
