-- 0006_learning: learning resources, tips progress, and the AI helper's daily cap (Phase 4).
--
--   * skill_resources: curated free links per skill (SPEC §6), public read,
--     seeded from src/lib/catalog/resources.ts (run seed.sql after this file).
--   * resource_opens: when a user last opened a resource through /learn/:id.
--     "I finished it" earns EXP only some minutes after an open (server only).
--   * tips_progress: checklist ticks per guide (SPEC §13), so they follow you
--     across devices. Users read their own; the server writes after checking ids.
--   * ai_usage: one row per AI helper use, for the 5-a-day cap (SPEC §9).
--     The generated text is never stored.

create table public.skill_resources (
  id text primary key check (id ~ '^[a-z0-9-]{3,80}$'),
  skill_id text not null references public.skills (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  type text not null check (type in ('video', 'course', 'article', 'docs')),
  sort smallint not null default 1
);
create index skill_resources_skill on public.skill_resources (skill_id, sort);

create table public.resource_opens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  resource_id text not null references public.skill_resources (id) on delete cascade,
  opened_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table public.tips_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z-]{2,40}$'),
  done text[] not null default '{}' check (cardinality(done) <= 50),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('cover_letter', 'resume_bullet')),
  -- Which listing it was for: "I used this cover letter" EXP needs a real draft for that listing.
  internship_id text references public.internships (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_time on public.ai_usage (user_id, created_at);

alter table public.skill_resources enable row level security;
alter table public.resource_opens enable row level security;
alter table public.tips_progress enable row level security;
alter table public.ai_usage enable row level security;

create policy "Anyone can read learning resources" on public.skill_resources for select to anon, authenticated using (true);
create policy "Read own tips progress" on public.tips_progress for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.skill_resources, public.tips_progress from anon, authenticated;
revoke all on public.resource_opens, public.ai_usage from anon, authenticated;

-- New EXP kinds: a finished learning resource (+15, once per skill) and a used AI cover letter (+10, once per listing).
alter table public.exp_events drop constraint exp_events_kind_check;
alter table public.exp_events add constraint exp_events_kind_check check (
  kind in ('profile', 'view_match', 'first_save', 'confirm', 'status', 'result', 'checklist', 'weekly_goal', 'resource', 'cover_letter')
);
