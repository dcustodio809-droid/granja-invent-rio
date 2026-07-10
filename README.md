# Granja Lucyara Dumont — Sistema de Inventário

Sistema web (responsivo — funciona no computador e no celular pelo navegador) para controle de
equipamentos, veículos, máquinas, ferramentas e estoque de materiais da granja.

Construído a partir do design em `Criar um aplicativo.zip` (handoff Web/Android/iPhone), como um
único site responsivo com:

- Login/cadastro de usuários (Supabase Auth)
- Cadastro de itens (equipamentos, veículos, máquinas, ferramentas) com foto
- Controle de manutenção preventiva (status "em dia" / "em breve" / "atrasada")
- Estoque de materiais com entradas/saídas, foto do material e nota fiscal anexada
- Painel com indicadores (KPIs), itens por categoria e alertas

## Rodando localmente

```
npm install
cp .env.example .env   # depois preencha com suas chaves do Supabase
npm run dev
```

## Publicando online

Veja o guia completo em `DEPLOY.md` — passo a passo para colocar no ar de graça usando
Supabase (banco de dados + fotos) e Vercel (hospedagem do site).
