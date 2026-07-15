-- =========================================================
-- Granja Lucyara Dumont — Atualização 2
-- Rode em: Supabase > SQL Editor > New query
-- (pode rodar com segurança mesmo se já tiver rodado antes)
-- =========================================================

-- Campos específicos de veículo
alter table public.items add column if not exists plate text;
alter table public.items add column if not exists renavam text;
alter table public.items add column if not exists chassi text;

-- Nota fiscal (número + data) e descrição na movimentação de estoque
alter table public.movements add column if not exists invoice_number text;
alter table public.movements add column if not exists purchase_date date;
alter table public.movements add column if not exists description text;
