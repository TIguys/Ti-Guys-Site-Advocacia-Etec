# Advocacia ETEC — versão web

## Supabase e autenticação atual

O projeto usa o Supabase configurado em `config.js`. `db.js` sincroniza clientes, advogados, serviços, consultas e usuários na tabela `app_data`, com cópia local no navegador. O schema atual permite acesso anônimo amplo para demonstração; a autenticação da interface é validada no navegador e não constitui autenticação de servidor. Não use estes dados com informações reais confidenciais sem migrar para Supabase Auth e políticas RLS por usuário/organização.

## CSS de produção

O Tailwind é compilado localmente e servido como `tailwind.css`. Para regenerar após alterações nas classes:

```bash
npm ci
npm run build:css
```
