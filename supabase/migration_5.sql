-- =========================================================
-- Granja Lucyara Dumont — Atualização 5
-- Valor do material (unitário e total)
-- Rode em: Supabase > SQL Editor > New query
-- =========================================================

alter table public.materials add column if not exists unit_price numeric default 0;
alter table public.movements add column if not exists unit_price numeric;
alter table public.movements add column if not exists total_value numeric;
