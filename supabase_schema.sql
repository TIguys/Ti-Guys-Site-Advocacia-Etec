-- ============================================================
-- SCHEMA SUPABASE — Sistema Advocacia ETEC
-- Execute este script no SQL Editor do seu projeto Supabase
-- ============================================================

create table if not exists app_data (
  key        text primary key,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_data enable row level security;

drop policy if exists "app_data_acesso_anon" on app_data;

-- ATENÇÃO: esta política permite que qualquer cliente com a anon key
-- leia/altere os dados. Para produção real, use Supabase Auth + RLS
-- por usuário/organização.
create policy "app_data_acesso_anon"
  on app_data for all
  to anon
  using (true)
  with check (true);


  create table if not exists public.app_data (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

drop policy if exists "app_data_acesso_anon" on public.app_data;

create policy "app_data_acesso_anon"
  on public.app_data
  for all
  to anon
  using (true)
  with check (true);

grant select, insert, update, delete
  on table public.app_data
  to anon;

notify pgrst, 'reload schema';
