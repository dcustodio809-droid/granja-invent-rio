# Sistema de Estoque e Inventário — Granja Lucyara Dumont

Aplicação web para controle de inventário (veículos, máquinas, equipamentos, ferramentas) e estoque de materiais da granja. Usuário principal: Daniel (gestor), não técnico. Explique em português, com passos simples, e mostre o que vai mudar antes de enviar ao GitHub.

## Stack e deploy
- React 18 + Vite 5 + react-router-dom 6 (SPA, 100% client-side). Não atualizar para Vite 8 nem React 19 (Vite 8 quebra no sandbox).
- Supabase: Postgres com RLS, Auth (e-mail/senha, contas criadas manualmente pelo gestor, sem auto-cadastro) e Storage (bucket `granja-uploads`, fotos).
- Deploy: GitHub → Vercel (build automático a cada push na branch principal). Produção: https://granja-invent-rio.vercel.app
- `vercel.json` reescreve todas as rotas para `/index.html` (SPA). Sem ele, recarregar qualquer página que não seja `/` dá 404 NOT_FOUND na Vercel.
- Variáveis na Vercel: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Local: `.env.local` (nunca versionar). Nunca usar nem pedir a chave `service_role` no front-end.

## Fluxo de trabalho obrigatório
1. Antes de enviar: `npm run build` precisa passar.
2. Mostrar ao usuário um resumo das mudanças antes do `git push`.
3. Mudanças de banco: criar `supabase/migration_N.sql` (próxima é a **11**; existem 2 a 10, além de `schema.sql`; 6 a 10 já aplicadas em produção; na 10 toda entrada tem destination = Almoxarifado). Migrations devem ser idempotentes (`if not exists`). Se não houver Supabase CLI ligado, o usuário executa no SQL Editor do Supabase; dizer exatamente o que colar.
4. Mudanças de UI com layout novo: mostrar um esboço ao usuário antes de programar (ele pediu isso na etiqueta).

## Estrutura (src/)
- `lib/data.js` — camada de dados (CRUD de items, materials, movements; fotos; `registerStockUpdate`; deletes em lote).
- `lib/cropImage.js` + `components/ImageCropper.jsx` — recorte de foto (react-easy-crop) antes do upload.
- `components/Layout.jsx` — menu: Início, Inventário (`/inventario`), Estoque, Perfil; Usuários e Auditoria só para gestor.
- `components/CategoryIcons.jsx` — ícones do dashboard (furadeira SVG para equipamentos; emojis para veículos/máquinas/ferramentas).
- `components/PrintReport` + `styles/print.css` — PDF via `window.print()` (elemento `.print-only` + `@media print`).
- `components/MaterialLabels.jsx` — etiquetas de materiais (folha A4 3×7, 63,5×38,1 mm, tipo Pimaco A4360; Code128 via `jsbarcode`). Renderiza por portal no `body` e imprime com a classe `body.printing-labels` (esconde `#root`). Janela `LabelPrintModal` em `pages/Stock.jsx`: cópias por material e posição inicial na folha.
- `lib/nfe.js` — leitura do XML da NF-e no navegador (`parseNFe`), lista `UNITS` de unidades do estoque e `mapUnit` (UN→un, M2→m2...).
- `components/InvoiceImportModal.jsx` — "Importar nota fiscal" (só XML, sem custo): conferência por produto (material existente / novo com estoque mínimo obrigatório / ignorar, quantidade editável) e lançamento via RPC `import_invoice` (tudo ou nada). Leitura de PDF/foto por IA foi discutida e adiada (exigiria conta paga e função na Vercel).
- `pages/`: Dashboard (contagem por categoria + notificações de estoque abaixo do mínimo), Items (inventário, filtros em balão, seleção/exclusão, PDF), ItemDetail (várias fotos, editar), Stock (abas Materiais/Movimentação, valor unitário e total, atualizar estoque; `EditMaterialModal` edita nome/unidade/mínimo/valor/foto — quantidade só por movimentação; Movimentação com busca e filtros em balão: período com atalhos, tipo, destino, material — o PDF sai filtrado e ordenado pela data da movimentação), Users (gestor), Audit (gestor), Login, Profile.

## Banco de dados
- Tabelas: `profiles` (role: gestor/funcionario), `items` (inclui `photos text[]`, `photo_url` = `photos[0]`, plate/renavam/chassi), `materials` (inclui `unit_price` e `code` único `GLD-0001`… gerado pelo trigger `materials_set_code` / sequência `materials_code_seq`), `movements` (inclui invoice_number, purchase_date, unit_price, total_value, destination — destino da saída: Escritório, Gerência, Núcleo 1–3, lista `DESTINATIONS` em Stock.jsx; `invoice_import_id`), `invoice_imports` (notas importadas, `access_key` única impede lançar em dobro), `supplier_products` (CNPJ + código do produto do fornecedor → material; o sistema lembra na próxima nota), `audit_log`.
- Função `import_invoice(p jsonb)` (SECURITY INVOKER, só autenticado): cria materiais novos, entradas, soma estoque e grava as ligações numa transação.
- Categorias de item: veiculo, maquina ("Máquinas e Implementos"), equipamento, ferramenta.
- RLS: usuários autenticados leem/escrevem items, materials, movements. `profiles` completo e `audit_log` só para gestor, via função `current_user_role()` (SECURITY DEFINER, evita recursão).
- Triggers de auditoria (`audit_trigger_fn`) em items, materials e movements.
- Na interface, "Itens" se chama **Inventário**; "Estoque" = materiais + movimentações.

## Convenções
- Interface em português do Brasil; valores em R$ com `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Texto das tabelas: cabeçalhos grandes, escuros e em negrito; opções de selects/balões em preto.
- Foto de detalhe com `object-fit: cover` (escolha do usuário, após recorte manual).
- Logo em `public/logo.png`.
- Não adicionar bibliotecas pesadas sem necessidade; evitar `localStorage` para dados de negócio.

## Ambiente local
- Repositório em `C:\Users\custo\granja-invent-rio` (Git e Node instalados via winget). `.env.local` com URL e chave anon (ignorado pelo Git).
- Supabase gratuito pausa após ~7 dias sem uso: se o host não resolver, o usuário precisa clicar em "Restore project" no painel.
- `src/pages/Maintenance.jsx` existe no repositório mas não está ligada a nenhuma rota.

## Histórico
Versões v1–v16 entregues como zips; a v16 é a última antes desta migração para Claude Code. O repositório do GitHub é a fonte da verdade daqui em diante.
- 10/11/2026: código sequencial GLD + etiquetas A4 com código de barras para Materiais (migration_6).
