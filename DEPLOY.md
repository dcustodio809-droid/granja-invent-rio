# Guia de publicação — Granja Lucyara Dumont (passo a passo)

Duas contas grátis: **Supabase** (banco de dados + fotos) e **Vercel** (hospedagem do site).
Nenhuma das duas pede cartão de crédito no plano gratuito.

---

## Parte 1 — Criar o banco de dados (Supabase)

1. Acesse https://supabase.com e crie uma conta grátis (pode entrar com Google).
2. Clique em **New Project**. Escolha um nome (ex: `granja-inventario`), uma senha para o banco
   (guarde essa senha) e a região mais próxima (ex: South America - São Paulo).
3. Espere ~2 minutos o projeto ser criado.
4. No menu lateral, clique em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase/schema.sql` (dentro desta pasta), copie todo o conteúdo, cole no editor
   e clique em **Run**. Isso cria todas as tabelas (itens, materiais, movimentações, perfis) e o
   espaço de armazenamento para as fotos.
6. No menu lateral, clique em **Project Settings** (ícone de engrenagem) → **API**.
   Copie dois valores:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (uma chave longa)

Guarde os dois — você vai usá-los no Parte 2.

### Ativar confirmação de e-mail (opcional)
Por padrão o Supabase exige confirmar o e-mail antes do primeiro login. Se quiser liberar o
cadastro sem confirmação (mais simples para uso interno da granja), vá em
**Authentication → Providers → Email** e desmarque "Confirm email".

---

## Parte 2 — Publicar o site (Vercel)

### Opção A — pelo site, sem usar terminal (mais simples)
1. Crie uma conta grátis em https://vercel.com (pode entrar com GitHub, Google ou e-mail).
2. Crie um repositório no GitHub com os arquivos desta pasta (pode arrastar a pasta pelo
   site do GitHub em github.com/new, ou usar o GitHub Desktop) — **não inclua a pasta
   `node_modules` nem `dist`**, elas não são necessárias.
3. Na Vercel, clique em **Add New → Project**, selecione o repositório que você criou.
4. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` → cole o Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → cole a anon public key do Supabase
5. Clique em **Deploy**. Em ~1 minuto você recebe um link tipo
   `https://granja-inventario.vercel.app` — esse é o endereço do seu sistema, acessível de
   qualquer computador ou celular.

### Opção B — pelo terminal (se preferir)
```
npm install -g vercel
cd granja-inventario
vercel
```
Siga as perguntas na tela. Quando pedir as variáveis de ambiente, informe
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores copiados do Supabase.
Para publicar a versão definitiva: `vercel --prod`.

---

## Parte 3 — Criar o primeiro usuário

1. Abra o link do site publicado.
2. Clique em "Criar conta", informe nome, e-mail e senha.
3. Se a confirmação de e-mail estiver ativada, confirme pelo e-mail recebido; senão, já pode
   fazer login direto.
4. Por padrão todo novo usuário entra como "funcionário". Para tornar alguém "gestor" (e liberar
   visualmente o rótulo de gestor no app), vá no Supabase em **Table Editor → profiles**, encontre
   a linha do usuário e mude a coluna `role` para `gestor`.

---

## Onde ficam as fotos e notas fiscais?

Tudo o que você anexar (fotos de itens, fotos de materiais, notas fiscais) é enviado para o
Supabase Storage, no bucket `granja-uploads`, e fica salvo na nuvem — não depende do computador
usado para acessar o sistema.

## Custos

Os planos gratuitos do Supabase e da Vercel cobrem tranquilamente o uso de uma pessoa ou pequena
equipe (poucas dezenas de fotos por mês, poucos usuários simultâneos). Se o uso crescer bastante
no futuro, ambos têm planos pagos a partir de ~US$ 20/mês.
