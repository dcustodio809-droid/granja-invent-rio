-- =========================================================
-- Granja Lucyara Dumont — Atualização 11
-- Padroniza a Localização dos itens do Inventário com a lista
-- do sistema (Almoxarifado, Escritório, Gerência, Núcleo 1, 2, 3).
-- Corrige valores digitados à mão, ex.: "GERÊNCIA " -> "Gerência",
-- "NUCLEO 1" -> "Núcleo 1". Valores fora da lista ficam como estão.
-- Rode em: Supabase > SQL Editor > New query
-- Pode rodar mais de uma vez sem problema.
-- =========================================================

update public.items
   set location = case
     when upper(translate(btrim(location), 'ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) = 'ALMOXARIFADO' then 'Almoxarifado'
     when upper(translate(btrim(location), 'ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) = 'ESCRITORIO' then 'Escritório'
     when upper(translate(btrim(location), 'ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) = 'GERENCIA' then 'Gerência'
     when upper(translate(btrim(location), 'ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) in ('NUCLEO 1', 'NUCLEO1', 'N1') then 'Núcleo 1'
     when upper(translate(btrim(location), 'ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) in ('NUCLEO 2', 'NUCLEO2', 'N2') then 'Núcleo 2'
     when upper(translate(btrim(location), 'ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) in ('NUCLEO 3', 'NUCLEO3', 'N3') then 'Núcleo 3'
     else location
   end
 where location is not null
   and location not in ('Almoxarifado', 'Escritório', 'Gerência', 'Núcleo 1', 'Núcleo 2', 'Núcleo 3');
