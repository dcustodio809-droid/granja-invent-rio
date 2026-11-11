-- =========================================================
-- Granja Lucyara Dumont — Atualização 9
-- Importação de nota fiscal: material novo já nasce com o
-- estoque mínimo informado na conferência (obrigatório).
-- Rode em: Supabase > SQL Editor > New query
-- Pode rodar mais de uma vez sem problema.
-- =========================================================

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
      if nullif(it->>'new_min_qty', '') is null or (it->>'new_min_qty')::numeric < 0 then
        raise exception 'Informe o estoque mínimo do material novo: %', it->>'new_name';
      end if;
      insert into public.materials (name, unit, qty, min_qty, unit_price, created_by)
      values (btrim(it->>'new_name'), coalesce(nullif(it->>'new_unit', ''), 'un'), 0,
              (it->>'new_min_qty')::numeric, coalesce(price, 0), auth.uid())
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
