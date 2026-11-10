-- 0008_companies: company accounts, listing drafts, admin review, and reports (Phase 6).
--
-- Companies are a second kind of auth.users account (their real work email,
-- unlike interns' usernames), reviewed by a human before their listings go
-- live (SPEC §12). Admin tables are server-only: every write goes through a
-- server action that checks admin membership first (src/lib/admin/server.ts).

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  website text not null,
  -- The verified work email (== the auth email). Kept here too since the API
  -- roles can't read auth.users, and the admin queue needs to show it.
  work_email text not null,
  role text not null check (char_length(role) between 1 and 60),
  registration_no text check (char_length(registration_no) <= 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  reject_reason text check (char_length(reject_reason) <= 200),
  -- "Proved they can read mail at this address" (decision: a Resend link when
  -- configured; admin can also confirm this by hand during review).
  email_confirmed boolean not null default false,
  email_confirm_token text,
  email_confirm_sent_at timestamptz,
  -- Best-effort checks at registration, and again whenever admin rechecks.
  website_loads boolean,
  website_checked_at timestamptz,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  suspended_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

alter table public.companies enable row level security;

-- A company reads its own row. No public read at all: nothing here (email,
-- website, role, registration number) is for other users.
create policy "Read own company" on public.companies
  for select to authenticated using (id = (select auth.uid()));

-- No direct writes. Edits go through updateCompanyDetails, which locks the
-- name and website once a company is approved (so a verified company can't
-- quietly rename itself into someone else) and sends a rejected company back
-- to review.
revoke insert, update, delete on public.companies from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Listings: who owns them, and the draft -> published -> closed lifecycle.
-- Company writes to internships go through server actions (service role)
-- after an ownership check, the same pattern as applications in 0004.
-- ---------------------------------------------------------------------------

alter table public.internships add column company_id uuid references public.companies (id) on delete set null;
alter table public.internships add column status text not null default 'published' check (status in ('draft', 'published', 'closed'));
-- When the internship begins (SPEC §5.1 company post form). Optional; shown next to the deadline.
alter table public.internships add column start_date date;
create index internships_company on public.internships (company_id) where company_id is not null;

-- A draft only needs a title (W13 UX): the rest can be filled in gradually.
alter table public.internships alter column field_id drop not null;
alter table public.internships alter column area drop not null;
alter table public.internships alter column work_type drop not null;
alter table public.internships alter column snippet drop not null;
alter table public.internships alter column apply_kind drop not null;

alter table public.internships drop constraint apply_target;
alter table public.internships add constraint apply_target check (
  apply_kind is null
  or (apply_kind = 'link' and apply_url is not null and apply_email is null)
  or (apply_kind = 'email' and apply_email is not null and apply_url is null)
);

-- A published listing must be complete; a draft may be missing any of this.
alter table public.internships add constraint listing_published_complete check (
  status <> 'published' or (
    field_id is not null and area is not null and work_type is not null
    and snippet is not null and apply_kind is not null
    and (apply_url is not null or apply_email is not null)
  )
);

-- Drafts are never publicly visible. Closed and published listings still are
-- (so an old link can say "This listing is closed", and so is_active=false
-- expired listings keep working the same way they always have).
drop policy "Anyone can read listings" on public.internships;
create policy "Anyone can read published and closed listings" on public.internships
  for select to anon, authenticated using (status <> 'draft');

-- ---------------------------------------------------------------------------
-- Admins: a short list of user ids. Added by hand in the SQL Editor
-- (docs/SUPABASE_SETUP.md): insert into public.admins (user_id) values ('<uuid>');
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  -- A label kept alongside the id, so the log still reads if the admin's account is later removed.
  admin_label text not null check (char_length(admin_label) <= 100),
  kind text not null check (kind in ('company', 'report', 'flag')),
  item_id text not null check (char_length(item_id) <= 100),
  subject text not null check (char_length(subject) <= 200),
  action text not null check (char_length(action) <= 60),
  reason text not null check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
create index admin_audit_time on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reports ("Report this listing", SPEC §12). Guests may report too, so this
-- is server-only (a service-role server action handles the rate limit and
-- the insert; there is no direct-write path for anon to abuse).
-- ---------------------------------------------------------------------------

create table public.reports (
  id bigint generated always as identity primary key,
  internship_id text not null references public.internships (id) on delete cascade,
  -- null for a guest report. Reporters are never shown to the company (SPEC §12).
  user_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('payment', 'scam', 'closed', 'wrong', 'other')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (char_length(resolution) <= 60)
);
create index reports_open on public.reports (internship_id) where resolved_at is null;

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Activity flags (0005): record which window was flagged, so "Reverse EXP"
-- can undo exactly the EXP earned in that burst and nothing else.
-- ---------------------------------------------------------------------------

alter table public.activity_flags add column window_start timestamptz;
alter table public.activity_flags add column window_end timestamptz;
