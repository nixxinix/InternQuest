-- 0001_core: reference data, profiles, skills, and listings (Phase 1).
--
-- Security model (SPEC §4, §14):
--   * Row-level security is ON for every table.
--   * Reference data and listings: anyone may read; nobody may write through the API.
--   * Profiles and skills: each user reads and changes only their own rows.
--   * Recovery data: no API access at all (no policies); server code with the
--     service role key is the only way in.
--   * Deleting an auth user deletes everything they own (ON DELETE CASCADE).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data (seeded from src/lib/catalog; see supabase/seed.sql)
-- ---------------------------------------------------------------------------

create table public.fields (
  id text primary key check (id ~ '^[a-z-]+$'),
  label text not null,
  short_label text not null,
  sort smallint not null
);

create table public.skills (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  -- Fields where this skill is suggested first.
  field_ids text[] not null default '{}',
  -- Extra words people search for. Search only, never scoring.
  aliases text[] not null default '{}'
);

-- "IoT" and "Embedded systems" count as the same skill when matching (SPEC §7).
create table public.skill_synonyms (
  skill_id text primary key references public.skills (id) on delete cascade,
  canonical_id text not null references public.skills (id) on delete cascade,
  constraint not_self check (skill_id <> canonical_id)
);

-- Fixed list so leaderboard groups don't split (decision M8).
create table public.schools (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null unique
);

-- ---------------------------------------------------------------------------
-- Profiles: one per auth user. No real name and no email are stored here.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  field_id text references public.fields (id),
  -- The city as typed and found, never an address. Coordinates are rounded to
  -- 2 decimals (about 1 km) before they are saved.
  city_name text check (char_length(city_name) <= 80),
  lat numeric(5, 2) check (lat between -90 and 90),
  lng numeric(5, 2) check (lng between -180 and 180),
  radius_km smallint not null default 25 check (radius_km in (5, 10, 25, 50)),
  work_type text check (work_type in ('onsite', 'hybrid', 'remote')),
  status text check (status in ('student', 'fresh-grad', 'career-shifter', 'other')),
  school_id text references public.schools (id) on delete set null,
  avatar_skin text not null default '#c98f62' check (avatar_skin ~ '^#[0-9a-f]{6}$'),
  avatar_hair text not null default '#1b1410' check (avatar_hair ~ '^#[0-9a-f]{6}$'),
  -- When they ticked the consent box at sign-up (Data Privacy Act).
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same rules as src/lib/auth/validation.ts: 3-20 chars, lowercase, starts
  -- with a letter, ends with a letter or digit, no ".." or "__".
  constraint username_format check (
    username ~ '^[a-z][a-z0-9._]{1,18}[a-z0-9]$' and username !~ '[._]{2}'
  ),
  constraint username_not_reserved check (
    username not in ('admin', 'administrator', 'internquest', 'support', 'moderator', 'help', 'root', 'system')
  ),
  constraint city_has_both_coordinates check ((lat is null) = (lng is null))
);

-- Usernames are always lowercase (format check), so this is case-insensitive.
create unique index profiles_username_key on public.profiles (username);
create index profiles_school on public.profiles (school_id) where school_id is not null;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_skills (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_id text not null references public.skills (id) on delete cascade,
  primary key (user_id, skill_id)
);
create index user_skills_skill on public.user_skills (skill_id);

-- At most 10 skills per profile (MAX_SKILLS in src/lib/listings/picks.ts).
create or replace function public.enforce_skill_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.user_skills where user_id = new.user_id) >= 10 then
    raise exception 'A profile can have at most 10 skills' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger user_skills_limit
  before insert on public.user_skills
  for each row execute function public.enforce_skill_limit();

-- Username availability for the sign-up form, without exposing profiles.
-- Phase 1 calls it from a rate-limited server action.
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles p where p.username = lower(trim(name)));
$$;

-- ---------------------------------------------------------------------------
-- Recovery (decision M3). No policies: only server code can read or write.
-- ---------------------------------------------------------------------------

create table public.recovery_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A slow hash of the code (like a password). The code itself is never stored.
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index recovery_codes_user on public.recovery_codes (user_id);

create table public.recovery_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

create table public.internships (
  -- A readable slug, used in URLs (/listings/<id>).
  id text primary key check (id ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 3 and 120),
  company_name text not null check (char_length(company_name) between 1 and 120),
  verified boolean not null default false,
  source text not null check (source in ('jsearch', 'direct', 'admin')),
  -- The aggregator's own id, for refreshes (Phase 5).
  source_ref text,
  field_id text not null references public.fields (id),
  area text not null check (char_length(area) <= 120),
  lat numeric(8, 5) check (lat between -90 and 90),
  lng numeric(8, 5) check (lng between -180 and 180),
  work_type text not null check (work_type in ('onsite', 'hybrid', 'remote')),
  allowance text check (char_length(allowance) <= 60),
  hours smallint check (hours between 1 and 2000),
  moa boolean not null default false,
  deadline date,
  posted_at timestamptz not null default now(),
  -- Outside sources: a short snippet only, never the full posting (CLAUDE.md hard rule).
  snippet text not null check (char_length(snippet) <= 600),
  apply_kind text not null check (apply_kind in ('link', 'email')),
  apply_url text check (apply_url ~ '^https://'),
  apply_email text check (apply_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_active boolean not null default true,
  last_checked timestamptz not null default now(),
  -- Normalized company + title + area (SPEC §5.3), so the same job from two sources is stored once.
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint listing_has_both_coordinates check ((lat is null) = (lng is null)),
  constraint apply_target check (
    (apply_kind = 'link' and apply_url is not null and apply_email is null)
    or (apply_kind = 'email' and apply_email is not null and apply_url is null)
  )
);

create unique index internships_dedupe_key on public.internships (dedupe_key);
create index internships_active_field on public.internships (field_id) where is_active;
create index internships_active_posted on public.internships (posted_at desc) where is_active;

create table public.internship_skills (
  internship_id text not null references public.internships (id) on delete cascade,
  skill_id text not null references public.skills (id),
  required boolean not null,
  primary key (internship_id, skill_id)
);
create index internship_skills_skill on public.internship_skills (skill_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.fields enable row level security;
alter table public.skills enable row level security;
alter table public.skill_synonyms enable row level security;
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.user_skills enable row level security;
alter table public.recovery_codes enable row level security;
alter table public.recovery_emails enable row level security;
alter table public.internships enable row level security;
alter table public.internship_skills enable row level security;

-- Public reading (closed listings stay readable so old links show "This listing is closed").
create policy "Anyone can read fields" on public.fields for select to anon, authenticated using (true);
create policy "Anyone can read skills" on public.skills for select to anon, authenticated using (true);
create policy "Anyone can read skill synonyms" on public.skill_synonyms for select to anon, authenticated using (true);
create policy "Anyone can read schools" on public.schools for select to anon, authenticated using (true);
create policy "Anyone can read listings" on public.internships for select to anon, authenticated using (true);
create policy "Anyone can read listing skills" on public.internship_skills for select to anon, authenticated using (true);

-- Your own profile only. No delete policy: deleting the account (auth user) cascades.
create policy "Read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Create own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Read own skills" on public.user_skills
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Add own skills" on public.user_skills
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Remove own skills" on public.user_skills
  for delete to authenticated using (user_id = (select auth.uid()));

-- Defense in depth on top of RLS: the API roles get no table rights at all on recovery data.
revoke all on public.recovery_codes from anon, authenticated;
revoke all on public.recovery_emails from anon, authenticated;

-- Writes to reference data and listings come only from server code (service role) or later migrations.
revoke insert, update, delete on public.fields, public.skills, public.skill_synonyms, public.schools,
  public.internships, public.internship_skills from anon, authenticated;

-- Functions: only what the app calls.
revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
revoke execute on function public.enforce_skill_limit() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
