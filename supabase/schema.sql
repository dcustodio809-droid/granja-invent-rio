-- =========================================================
-- Granja Lucyara Dumont — Sistema de Inventário
-- Schema do Supabase (Postgres)
-- Rode este script inteiro em: Supabase > SQL Editor > New query
-- =========================================================

-- Extensão para gerar UUIDs
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- PERFIS (dados extras de cada usuário logado)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'funcionario' check (role in ('gestor','funcionario')),
  notif_low_stock boolean not null default true,
  auto_sync boolean not null default true,
  biometric_login boolean not null default false,
  weekly_report boolean not null default false,
  created_at timestamptz not null default now()
);

-- Cria o profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- ITENS (equipamentos, veículos, máquinas, ferramentas)
-- ---------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('veiculo','maquina','equipamento','ferramenta')),
  brand text default '',
  serial text default '',
  qty integer not null default 1,
  location text default '',
  photo_url text,
  description text default '',
  maintenance_interval_days integer,
  maintenance_due date,
  last_maintenance date,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- MATERIAIS (estoque: ração, ovos, insumos, embalagens...)
-- ---------------------------------------------------------
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'un',
  qty numeric not null default 0,
  min_qty numeric not null default 0,
  photo_url text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- MOVIMENTAÇÕES (entradas/saídas de materiais)
-- ---------------------------------------------------------
create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  type text not null check (type in ('entrada','saida')),
  qty numeric not null,
  invoice_url text,
  photo_url text,
  responsible text default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists movements_material_id_idx on public.movements (material_id);
create index if not exists movements_created_at_idx on public.movements (created_at desc);

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- Qualquer usuário autenticado (da sua granja) pode ler/escrever.
-- Simples e adequado para uso pessoal/pequena equipe.
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.materials enable row level security;
alter table public.movements enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "items_all_authenticated" on public.items;
create policy "items_all_authenticated" on public.items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "materials_all_authenticated" on public.materials;
create policy "materials_all_authenticated" on public.materials
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "movements_all_authenticated" on public.movements;
create policy "movements_all_authenticated" on public.movements
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------
-- STORAGE (bucket para fotos e notas fiscais)
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('granja-uploads', 'granja-uploads', true)
on conflict (id) do nothing;

drop policy if exists "granja_uploads_read" on storage.objects;
create policy "granja_uploads_read" on storage.objects
  for select using (bucket_id = 'granja-uploads');

drop policy if exists "granja_uploads_write" on storage.objects;
create policy "granja_uploads_write" on storage.objects
  for insert with check (bucket_id = 'granja-uploads' and auth.role() = 'authenticated');

drop policy if exists "granja_uploads_update" on storage.objects;
create policy "granja_uploads_update" on storage.objects
  for update using (bucket_id = 'granja-uploads' and auth.role() = 'authenticated');

drop policy if exists "granja_uploads_delete" on storage.objects;
create policy "granja_uploads_delete" on storage.objects
  for delete using (bucket_id = 'granja-uploads' and auth.role() = 'authenticated');
