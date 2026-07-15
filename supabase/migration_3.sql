-- =========================================================
-- Granja Lucyara Dumont — Atualização 3
-- Usuários (gerenciamento) + Auditoria
-- Rode em: Supabase > SQL Editor > New query
-- =========================================================

-- Guarda o e-mail no perfil (para listar usuários sem precisar de permissão admin)
alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

-- preenche o e-mail de quem já tinha conta antes desta atualização
update public.profiles p set email = u.email from auth.users u where p.id = u.id and (p.email is null or p.email = '');

-- Função auxiliar: qual o cargo do usuário logado (evita recursão nas policies)
create or replace function public.current_user_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Gestor pode ver e editar o perfil (cargo) de todos os usuários
drop policy if exists "profiles_gestor_select_all" on public.profiles;
create policy "profiles_gestor_select_all" on public.profiles
  for select using (public.current_user_role() = 'gestor');

drop policy if exists "profiles_gestor_update_all" on public.profiles;
create policy "profiles_gestor_update_all" on public.profiles
  for update using (public.current_user_role() = 'gestor');

-- =========================================================
-- Auditoria: registra automaticamente toda alteração em
-- itens, materiais e movimentações (quem, quando, o quê)
-- =========================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert','update','delete')),
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_gestor_select" on public.audit_log;
create policy "audit_log_gestor_select" on public.audit_log
  for select using (public.current_user_role() = 'gestor');

create or replace function public.audit_trigger_fn()
returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    insert into public.audit_log (table_name, record_id, action, changed_by, old_data)
    values (tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log (table_name, record_id, action, changed_by, old_data, new_data)
    values (tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'INSERT') then
    insert into public.audit_log (table_name, record_id, action, changed_by, new_data)
    values (tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists audit_items on public.items;
create trigger audit_items after insert or update or delete on public.items
  for each row execute procedure public.audit_trigger_fn();

drop trigger if exists audit_materials on public.materials;
create trigger audit_materials after insert or update or delete on public.materials
  for each row execute procedure public.audit_trigger_fn();

drop trigger if exists audit_movements on public.movements;
create trigger audit_movements after insert or update or delete on public.movements
  for each row execute procedure public.audit_trigger_fn();
