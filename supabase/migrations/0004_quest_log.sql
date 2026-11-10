-- 0004_quest_log: the quest log (applications) and Apply clicks (Phase 2).
--
--   * applications: one row per tracked listing or outside job (SPEC §5.6).
--     Users manage their own rows. Two columns are set only by server code:
--       confirmed_at     "Yes, I applied", checked against a logged Apply click
--       last_clicked_at  when this user last clicked Apply on the listing
--     so a confirmed application can't be made up through the API (SPEC §10,
--     "only confirmed applications count").
--   * click_logs: Apply clicks (SPEC §5.5). No IP address. The user is
--     unlinked (set null) when they delete their account, so listing totals stay.

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- null = added by hand from outside InternQuest. A removed listing also becomes null; the title stays.
  internship_id text references public.internships (id) on delete set null,
  title text not null check (char_length(title) between 1 and 100),
  company text not null check (char_length(company) between 1 and 100),
  -- Entries added by hand: where the original posting is.
  url text check (url ~ '^https?://' and char_length(url) <= 500),
  status text not null default 'saved' check (status in ('saved', 'applied', 'interview', 'result')),
  outcome text check (outcome in ('offer', 'not_selected', 'no_reply', 'withdrew')),
  applied_on date,
  interview_at timestamptz,
  interview_how text not null default '' check (char_length(interview_how) <= 80),
  note text not null default '' check (char_length(note) <= 1000),
  last_clicked_at timestamptz,
  -- "Not yet" on the "Did you apply?" question.
  prompt_dismissed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outcome_only_for_result check (outcome is null or status = 'result')
);

-- One entry per listing per user.
create unique index applications_user_listing on public.applications (user_id, internship_id) where internship_id is not null;
create index applications_user on public.applications (user_id, updated_at desc);
create index applications_listing on public.applications (internship_id) where internship_id is not null;

create trigger applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- A generous cap, so one account can't fill the database.
create or replace function public.enforce_application_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.applications where user_id = new.user_id) >= 500 then
    raise exception 'A quest log can have at most 500 entries' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger applications_limit
  before insert on public.applications
  for each row execute function public.enforce_application_limit();

revoke execute on function public.enforce_application_limit() from public, anon, authenticated;

alter table public.applications enable row level security;

create policy "Read own applications" on public.applications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Add own applications" on public.applications
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Change own applications" on public.applications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Remove own applications" on public.applications
  for delete to authenticated using (user_id = (select auth.uid()));

-- Column rights: confirmed_at and last_clicked_at are server-only.
revoke all on public.applications from anon;
revoke insert, update on public.applications from authenticated;
grant insert (internship_id, title, company, url, status, outcome, applied_on, interview_at, interview_how, note)
  on public.applications to authenticated;
grant update (status, outcome, applied_on, interview_at, interview_how, note, prompt_dismissed_at)
  on public.applications to authenticated;

-- ---------------------------------------------------------------------------
-- Apply clicks
-- ---------------------------------------------------------------------------

create table public.click_logs (
  id bigint generated always as identity primary key,
  internship_id text not null references public.internships (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  -- link: the Apply button or "Read the full posting"; email: "Open my email app".
  kind text not null check (kind in ('link', 'email')),
  created_at timestamptz not null default now()
);

create index click_logs_user on public.click_logs (user_id, internship_id, created_at desc) where user_id is not null;
create index click_logs_listing on public.click_logs (internship_id, created_at);

alter table public.click_logs enable row level security;
revoke all on public.click_logs from anon, authenticated;
