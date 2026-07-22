-- =========================================================
-- Granja Lucyara Dumont — Atualização 4
-- Múltiplas fotos por item
-- Rode em: Supabase > SQL Editor > New query
-- =========================================================

alter table public.items add column if not exists photos text[] default '{}';

-- migra a foto única já existente para a lista de fotos
update public.items
set photos = array[photo_url]
where photo_url is not null and photo_url <> ''
  and (photos is null or array_length(photos, 1) is null);
