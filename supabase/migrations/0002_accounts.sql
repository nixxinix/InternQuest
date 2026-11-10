-- 0002_accounts: sign-up details, settings, rate limits, and safe write paths (Phase 1b).
--
-- What changes:
--   * Profiles record the age confirmation from sign-up and when onboarding finished.
--   * Profiles are created only by server code (which checks consent and age first),
--     and users can change only their own profile fields, never their username
--     (that goes through server code, which also renames the sign-in identity).
--   * user_settings: play style and game toggles (SPEC §10), one row per profile.
--   * rate_limits: counters that slow down password guessing (SPEC §14).
--   * Small functions the app calls: set_my_skills, my_recovery, take_rate_limit.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

-- "I'm 18 or older, or I have my parent's or guardian's permission" (sign-up checkbox).
-- No profiles exist before Phase 1b, so the column can be required right away.
alter table public.profiles
  add column age_confirmed_at timestamptz not null,
  add column onboarded_at timestamptz;

-- Profiles are inserted by the sign-up server action (service role), never by the API roles.
drop policy "Create own profile" on public.profiles;
revoke insert on public.profiles from anon, authenticated;

-- Users may update their own profile fields only. Username, consent, and age
-- confirmation are not in this list, so the API can't change them.
revoke update on public.profiles from anon, authenticated;
grant update (field_id, city_name, lat, lng, radius_km, work_type, status, school_id, avatar_skin, avatar_hair, onboarded_at)
  on public.profiles to authenticated;

-- Username checks now go through the rate-limited server action only. Calling
-- the function straight from the public API would let anyone test usernames
-- without a limit.
revoke execute on function public.username_available(text) from anon, authenticated;
grant execute on function public.username_available(text) to service_role;

-- ---------------------------------------------------------------------------
-- Settings (SPEC §10). Created with the profile at sign-up.
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  mode text not null default 'full' check (mode in ('full', 'light', 'plain')),
  streaks boolean not null default true,
  leaderboard boolean not null default true,
  -- Separate from "leaderboard": you can look without being listed.
  show_on_leaderboard boolean not null default true,
  notes text not null default 'cheerful' check (notes in ('cheerful', 'calm', 'off')),
  animations boolean not null default true,
  -- Off by default (SPEC §10).
  sound boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "Read own settings" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Update own settings" on public.user_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke insert, delete, truncate on public.user_settings from anon, authenticated;
revoke update on public.user_settings from anon, authenticated;
grant update (mode, streaks, leaderboard, show_on_leaderboard, notes, animations, sound)
  on public.user_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Skills: replace the whole list in one transaction (Profile > Edit, onboarding).
-- Runs as the caller, so row-level security still applies.
-- ---------------------------------------------------------------------------

create or replace function public.set_my_skills(p_skills text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_skills), 0) > 10 then
    raise exception 'A profile can have at most 10 skills' using errcode = 'check_violation';
  end if;
  delete from public.user_skills where user_id = uid;
  insert into public.user_skills (user_id, skill_id)
    select uid, s from (select distinct unnest(p_skills) as s) as picked;
end;
$$;

revoke execute on function public.set_my_skills(text[]) from public, anon;
grant execute on function public.set_my_skills(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Recovery status for Settings, without opening the recovery tables to the API.
-- Returns how many codes are unused and the recovery email, for the caller only.
-- ---------------------------------------------------------------------------

create or replace function public.my_recovery()
returns table (codes_left integer, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.recovery_codes c where c.user_id = auth.uid() and c.used_at is null),
    (select e.email from public.recovery_emails e where e.user_id = auth.uid());
$$;

revoke execute on function public.my_recovery() from public, anon;
grant execute on function public.my_recovery() to authenticated;

-- Speeds up "codes left" and the reset check.
create index recovery_codes_unused on public.recovery_codes (user_id) where used_at is null;

-- ---------------------------------------------------------------------------
-- Rate limits (SPEC §14: rate-limit login). Fixed windows, one row per bucket.
-- A bucket is "<action>:<subject>", where the subject is a username or a
-- scrambled (HMAC) network address, never a raw IP. Rows older than a day are
-- cleared as the table is used.
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  bucket text primary key check (char_length(bucket) <= 200),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts one try and says whether it's still within the limit. Atomic, so two
-- requests at once can't both slip under it.
create or replace function public.take_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if p_window_seconds < 1 or p_window_seconds > 86400 or p_max < 1 then
    raise exception 'Bad rate limit settings' using errcode = '22023';
  end if;

  -- Housekeeping on about 1 call in 100.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    hits = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits <= p_max into allowed;

  return allowed;
end;
$$;

revoke execute on function public.take_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, integer, integer) to service_role;
