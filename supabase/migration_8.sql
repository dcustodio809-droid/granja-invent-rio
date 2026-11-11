-- =========================================================
-- Granja Lucyara Dumont — Atualização 8
-- Importação de nota fiscal (XML da NF-e) para o estoque
-- Rode em: Supabase > SQL Editor > New query
-- Pode rodar mais de uma vez sem problema.
-- =========================================================

-- 1) Notas já importadas (a chave de acesso não se repete: evita lançar em dobro)
create table if not exists public.invoice_imports (
  id uuid primary key default gen_random_uuid(),
  access_key text not null unique,
  number text,
  series text,
  supplier_cnpj text,
  supplier_name text,
  issue_date date,
  total_value numeric,
  items_count int,
  imported_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- 2) Ligação "produto do fornecedor" -> "material do estoque" (o sistema lembra na próxima nota)
create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_cnpj text not null,
  supplier_code text not null,
  supplier_description text,
  material_id uuid not null references public.materials (id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (supplier_cnpj, supplier_code)
);

-- 3) Cada entrada lançada por nota guarda de qual importação veio
alter table public.movements add column if not exists invoice_import_id uuid
  references public.invoice_imports (id) on delete set null;

-- 4) Segurança: mesmos acessos de materiais e movimentações
alter table public.invoice_imports enable row level security;
alter table public.supplier_products enable row level security;

drop policy if exists "invoice_imports_all_authenticated" on public.invoice_imports;
create policy "invoice_imports_all_authenticated" on public.invoice_imports
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "supplier_products_all_authenticated" on public.supplier_products;
create policy "supplier_products_all_authenticated" on public.supplier_products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 5) Auditoria das notas importadas
drop trigger if exists audit_invoice_imports on public.invoice_imports;
create trigger audit_invoice_imports after insert or update or delete on public.invoice_imports
  for each row execute procedure public.audit_trigger_fn();

-- 6) Lança a nota inteira de uma vez: ou entra tudo, ou nada (se der erro no meio, desfaz)
create or replace function public.import_invoice(p jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  imp_id uuid;
  it jsonb;
  mat_id uuid;
  q numeric;
  price numeric;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Acesso negado.';
  end if;
  if coalesce(p->>'access_key', '') = '' then
    raise exception 'Nota sem chave de acesso.';
  end if;
  if exists (select 1 from public.invoice_imports where access_key = p->>'access_key') then
    raise exception 'NOTA_JA_IMPORTADA';
  end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'Nenhum produto selecionado para lançar.';
  end if;

  insert into public.invoice_imports
    (access_key, number, series, supplier_cnpj, supplier_name, issue_date, total_value, items_count, imported_by)
  values
    (p->>'access_key', p->>'number', p->>'series', p->>'supplier_cnpj', p->>'supplier_name',
     nullif(p->>'issue_date', '')::date, nullif(p->>'total_value', '')::numeric,
     jsonb_array_length(p->'items'), auth.uid())
  returning id into imp_id;

  for it in select * from jsonb_array_elements(p->'items') loop
    q := nullif(it->>'qty', '')::numeric;
    price := nullif(it->>'unit_price', '')::numeric;
    if q is null or q <= 0 then
      raise exception 'Quantidade inválida em: %', it->>'supplier_description';
    end if;

    if it->>'action' = 'new' then
      if coalesce(btrim(it->>'new_name'), '') = '' then
        raise exception 'Informe o nome do material novo para: %', it->>'supplier_description';
      end if;
      insert into public.materials (name, unit, qty, min_qty, unit_price, created_by)
      values (btrim(it->>'new_name'), coalesce(nullif(it->>'new_unit', ''), 'un'), 0, 0, coalesce(price, 0), auth.uid())
      returning id into mat_id;
    else
      mat_id := nullif(it->>'material_id', '')::uuid;
      if mat_id is null or not exists (select 1 from public.materials where id = mat_id) then
        raise exception 'Escolha o material para: %', it->>'supplier_description';
      end if;
    end if;

    insert into public.movements
      (material_id, type, qty, unit_price, total_value, invoice_number, purchase_date,
       description, responsible, created_by, invoice_import_id)
    values
      (mat_id, 'entrada', q, price, case when price is null then null else round(price * q, 2) end,
       p->>'number', nullif(p->>'issue_date', '')::date,
       nullif(p->>'description', ''), coalesce(p->>'responsible', ''), auth.uid(), imp_id);

    update public.materials
       set qty = qty + q,
           unit_price = coalesce(price, unit_price),
           updated_at = now()
     where id = mat_id;

    if coalesce(p->>'supplier_cnpj', '') <> '' and coalesce(it->>'supplier_code', '') <> '' then
      insert into public.supplier_products (supplier_cnpj, supplier_code, supplier_description, material_id)
      values (p->>'supplier_cnpj', it->>'supplier_code', it->>'supplier_description', mat_id)
      on conflict (supplier_cnpj, supplier_code)
      do update set material_id = excluded.material_id,
                    supplier_description = excluded.supplier_description,
                    updated_at = now();
    end if;
  end loop;

  return imp_id;
end;
$$;

revoke all on function public.import_invoice(jsonb) from public, anon;
grant execute on function public.import_invoice(jsonb) to authenticated;
