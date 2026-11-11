-- =========================================================
-- Granja Lucyara Dumont — Atualização 6
-- Código sequencial dos materiais (GLD-0001, GLD-0002...)
-- usado na etiqueta com código de barras.
-- Rode em: Supabase > SQL Editor > New query
-- Pode rodar mais de uma vez sem problema.
-- =========================================================

-- 1) Coluna do código e contador
alter table public.materials add column if not exists code text;
create sequence if not exists public.materials_code_seq;

-- 2) Função que gera o próximo código (GLD-0001 ... GLD-9999, depois GLD-10000...)
create or replace function public.next_material_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  n := nextval('public.materials_code_seq');
  return 'GLD-' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end;
end;
$$;

-- 3) Acerta o contador para depois do maior código já existente
select setval(
  'public.materials_code_seq',
  coalesce((select max(substring(code from '^GLD-(\d+)$')::bigint) from public.materials), 0) + 1,
  false
);

-- 4) Preenche os materiais antigos, na ordem em que foram cadastrados
do $$
declare
  r record;
begin
  for r in select id from public.materials where code is null order by created_at, id loop
    update public.materials set code = public.next_material_code() where id = r.id;
  end loop;
end;
$$;

-- 5) Todo material novo recebe o próximo código automaticamente
create or replace function public.set_material_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.next_material_code();
  end if;
  return new;
end;
$$;

drop trigger if exists materials_set_code on public.materials;
create trigger materials_set_code before insert on public.materials
  for each row execute function public.set_material_code();

-- 6) Código obrigatório e sem repetição
alter table public.materials alter column code set not null;
create unique index if not exists materials_code_key on public.materials (code);
