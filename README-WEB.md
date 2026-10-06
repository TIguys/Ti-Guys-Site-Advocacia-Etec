# Advocacia ETEC — versão web

## 1. Supabase

O projeto já está apontando para:

https://xfdfnqknajmwzspfqqcw.supabase.co

Execute `supabase_schema.sql` no SQL Editor do Supabase. Para GitHub Pages, configure `SUPABASE_URL` e a chave pública (`anon`/`publishable`) em `config.js` antes de publicar. Para Render, também é possível definir `SUPABASE_URL` e `SUPABASE_ANON_KEY` como variáveis de ambiente; o endpoint `/api/config` fornece esses valores ao frontend. Nunca use a `service_role` key.

O `db.js` já sincroniza `clientes`, `advogados`, `servicos`, `consultas` e usuários na tabela `app_data`.

Se a chave não estiver configurada, o app permanece em modo local e não tenta chamadas que resultariam em `401`.

## 2. CSS de produção

O Tailwind é compilado localmente e servido como `tailwind.css`, sem o CDN no navegador. Para regenerar o CSS após alterações nas classes:

```bash
npm ci
npm run build:css
```

## 3. Rodar localmente

```bash
pip install -r requirements.txt
python server.py
```

Depois abra:

http://localhost:8080

## 4. Publicar na web com Render

1. Suba esta pasta para um repositório GitHub.
2. No Render, crie um Web Service apontando para o repositório.
3. Build command: `pip install -r requirements.txt`
4. Start command: `python server.py`
5. Crie a variável de ambiente `OPENAI_API_KEY` se quiser usar a LawAI.
6. Configure `SUPABASE_ANON_KEY` com a anon public key para ativar a sincronização.
7. Faça o deploy.

O `server.py` serve o site e também o endpoint `/api/ai`.

## 5. Importante sobre segurança

Somente a **anon public key** pode ser enviada ao navegador. Nunca configure a `service_role` key em `config.js` ou nas variáveis servidas ao frontend.

O schema atual usa uma política aberta para `anon`, adequada para um projeto/TCC de demonstração, mas não recomendada para produção com dados jurídicos reais. Para produção, use Supabase Auth e políticas RLS por usuário/organização.

## 6. Limitação atual da IA

A IA depende de `OPENAI_API_KEY`/configuração do provedor definida no servidor. O navegador não recebe essa chave.
