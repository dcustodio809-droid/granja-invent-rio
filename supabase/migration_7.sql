-- =========================================================
-- Granja Lucyara Dumont — Atualização 7
-- Destino da saída de material (Almoxarifado entrega para:
-- Escritório, Gerência, Núcleo 1, Núcleo 2, Núcleo 3)
-- Rode em: Supabase > SQL Editor > New query
-- Pode rodar mais de uma vez sem problema.
-- =========================================================

alter table public.movements add column if not exists destination text;
