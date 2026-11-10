-- 0005_game: EXP, badges, unusual-activity flags, and the leaderboard (Phase 3).
--
-- EXP is decided on the server only (CLAUDE.md hard rule): the API roles can
-- read their own EXP and badges but never write them. Every grant is one
-- exp_events row with a unique (user, kind, ref), so retrying or repeating an
-- action can never pay twice (idempotent, SPEC §10).

create table public.exp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('profile', 'view_match', 'first_save', 'confirm', 'status', 'result', 'checklist', 'weekly_goal')),
  -- What it was for: a listing id, an entry id plus step, a guide slug, a week. Unique per kind.
  ref text not null check (char_length(ref) between 1 and 120),
  amount smallint not null check (amount between 0 and 100),
  created_at timestamptz not null default now(),
  constraint exp_once unique (user_id, kind, ref)
);
create index exp_events_user_time on public.exp_events (user_id, created_at);
create index exp_events_time on public.exp_events (created_at);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null check (badge_id in ('first-quest', 'prepared', 'follow-through', 'skill-up', 'on-a-roll', 'scout')),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- Unusual activity for the admin queue (Phase 6). A flag only asks someone to
-- look; nothing is taken away automatically (decision #99).
create table public.activity_flags (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index activity_flags_open on public.activity_flags (created_at) where resolved_at is null;

alter table public.exp_events enable row level security;
alter table public.user_badges enable row level security;
alter table public.activity_flags enable row level security;

create policy "Read own EXP" on public.exp_events for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own badges" on public.user_badges for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.exp_events, public.user_badges from anon, authenticated;
revoke all on public.activity_flags from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard (SPEC §10, decision S4 option 1). Server only.
-- Lists Full Quest players who haven't hidden themselves, plus the caller.
-- Usernames and school ids only: no other profile data leaves the database.
-- ---------------------------------------------------------------------------

create or replace function public.leaderboard_entries(p_me uuid, p_week_start timestamptz)
returns table (
  username text,
  school_id text,
  week_exp integer,
  week_apps integer,
  total_exp integer,
  total_apps integer,
  hidden boolean,
  is_me boolean
)
language sql
stable
set search_path = ''
as $$
  select
    p.username,
    p.school_id,
    coalesce((select sum(e.amount) from public.exp_events e where e.user_id = p.id and e.created_at >= p_week_start), 0)::integer,
    (select count(*) from public.applications a where a.user_id = p.id and a.confirmed_at >= p_week_start)::integer,
    coalesce((select sum(e.amount) from public.exp_events e where e.user_id = p.id), 0)::integer,
    (select count(*) from public.applications a where a.user_id = p.id and a.confirmed_at is not null)::integer,
    not s.show_on_leaderboard,
    p.id = p_me
  from public.profiles p
  join public.user_settings s on s.user_id = p.id
  where p.id = p_me
     or (s.show_on_leaderboard and s.mode = 'full' and p.onboarded_at is not null);
$$;

revoke execute on function public.leaderboard_entries(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.leaderboard_entries(uuid, timestamptz) to service_role;
