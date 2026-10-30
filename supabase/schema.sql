create table if not exists public.ett_app_state (
  id text primary key check (id = 'main'),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ett_app_state enable row level security;
revoke all on table public.ett_app_state from anon, authenticated;
grant all on table public.ett_app_state to service_role;

create or replace function public.save_ett_report(
  p_month text,
  p_master jsonb,
  p_report jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid report month';
  end if;

  insert into public.ett_app_state (id, payload, updated_at)
  values (
    'main',
    jsonb_build_object(
      'master', p_master,
      'reports', jsonb_build_object(p_month, p_report)
    ),
    now()
  )
  on conflict (id) do update
  set payload = jsonb_set(
    jsonb_set(ett_app_state.payload, '{master}', p_master, true),
    array['reports', p_month],
    p_report,
    true
  ),
  updated_at = now();
end;
$$;

revoke all on function public.save_ett_report(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_ett_report(text, jsonb, jsonb) to service_role;
