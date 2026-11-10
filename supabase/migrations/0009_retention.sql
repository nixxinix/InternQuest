-- 0009_retention: deleting old data on a schedule, and logging admin CSV imports (Phase 7).
-- "kept only as long as needed"). The daily job calls purge_old_data() with
-- the periods in src/lib/retention.ts, so they live in one place in code.
--
-- Only data that is done with is deleted:
--   * Apply clicks older than the click period (companies only ever see totals,
--     and the "Did you apply?" and EXP checks look back 14 days at most).
--   * Reports and unusual-activity flags an admin has already resolved.
--   * Admin audit entries, after a longer period.
--   * Import run logs (counts only, no personal data), to keep the table small.
-- Open reports and open flags are never deleted, however old.

create index if not exists click_logs_created on public.click_logs (created_at);
create index if not exists reports_resolved on public.reports (resolved_at) where resolved_at is not null;
create index if not exists activity_flags_resolved on public.activity_flags (resolved_at) where resolved_at is not null;
create index if not exists admin_audit_created on public.admin_audit (created_at);

create or replace function public.purge_old_data(
  p_click_days integer,
  p_report_days integer,
  p_flag_days integer,
  p_audit_days integer,
  p_run_days integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  n_clicks integer;
  n_reports integer;
  n_flags integer;
  n_audit integer;
  n_runs integer;
begin
  -- A period under a week is almost certainly a mistake (days vs. hours), and
  -- would break the 7-day EXP checks: refuse rather than delete too much.
  if least(p_click_days, p_report_days, p_flag_days, p_audit_days, p_run_days) < 7 then
    raise exception 'purge_old_data: every period must be at least 7 days';
  end if;

  delete from public.click_logs where created_at < now() - make_interval(days => p_click_days);
  get diagnostics n_clicks = row_count;

  delete from public.reports where resolved_at is not null and resolved_at < now() - make_interval(days => p_report_days);
  get diagnostics n_reports = row_count;

  delete from public.activity_flags where resolved_at is not null and resolved_at < now() - make_interval(days => p_flag_days);
  get diagnostics n_flags = row_count;

  delete from public.admin_audit where created_at < now() - make_interval(days => p_audit_days);
  get diagnostics n_audit = row_count;

  delete from public.import_runs where started_at < now() - make_interval(days => p_run_days);
  get diagnostics n_runs = row_count;

  return jsonb_build_object(
    'clicks', n_clicks,
    'reports', n_reports,
    'flags', n_flags,
    'audit', n_audit,
    'runs', n_runs
  );
end;
$$;

revoke execute on function public.purge_old_data(integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.purge_old_data(integer, integer, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Admin CSV import (SPEC §5.3) is logged like every other admin decision.
-- ---------------------------------------------------------------------------

alter table public.admin_audit drop constraint admin_audit_kind_check;
alter table public.admin_audit add constraint admin_audit_kind_check check (kind in ('company', 'report', 'flag', 'import'));
