-- TEST ONLY: the small part of Supabase that our migrations rely on, so they
-- can run in PGlite (Postgres in WebAssembly) without Docker or a project.
-- Mirrors Supabase's auth.uid() and the default grants Supabase gives the API roles.

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants table, function, and sequence rights to the API roles by default;
-- row-level security is what actually protects the rows.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
