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

O chat da Law AI usa o endpoint Python quando o site é servido pelo próprio `server.py`. Para executar:

```bash
pip install -r requirements.txt
ollama pull qwen2.5:7b
python server.py
```

Abra http://localhost:8080. Não é necessária uma chave de API para o Ollama local. O banco SQLite é criado em `data/legal_knowledge.sqlite3`.

Para testar e consultar a base:

```bash
python -m unittest discover -p "test_*.py"
python ai_legal_research.py --sync
python ai_legal_research.py --status
```

`--sync` baixa os textos do catálogo de fontes oficiais do Planalto e informa falhas por fonte; `--status` mostra quantas normas e trechos estão persistidos. A aplicação também tenta obter a norma relevante quando ela ainda não está na base. Se a conexão oficial falhar, não afirma que a norma foi sincronizada.

## 4. Hospedar o modelo e o backend

O GitHub Pages hospeda somente os arquivos estáticos. Para que todos usem o mesmo modelo e a mesma base jurídica, hospede `server.py`, Ollama e o volume SQLite em um servidor Linux com GPU NVIDIA. A configuração Docker Compose deste projeto mantém a porta do Ollama apenas na rede interna e publica a API da Law AI na porta 8080.

Pré-requisitos do servidor: Docker Engine, Docker Compose v2 e NVIDIA Container Toolkit. Em um servidor/Pod com GPU:

```bash
docker compose up -d --build
docker compose exec lawai python ai_legal_research.py --sync
docker compose exec lawai python ai_legal_research.py --status
```

O primeiro início baixa `qwen2.5:7b`, que ocupa vários gigabytes e precisa de espaço e memória de GPU. O Compose persiste os pesos do modelo e a base legal em volumes Docker, mesmo que os contêineres sejam recriados. Para escolher outro modelo compatível com Ollama, defina `AI_MODEL` no ambiente antes de subir a composição.

Configure um proxy HTTPS para encaminhar tráfego público à porta 8080. Não publique a porta 11434 do Ollama na internet. `CORS_ALLOWED_ORIGINS` já inclui `https://tiguys.github.io`; para outros domínios, defina a lista de origens separadas por vírgula. O endpoint aplica limite de requisições e concorrência, mas, por ser público, ainda deve ser monitorado e protegido contra abuso pelo provedor de hospedagem.

Após obter o endereço HTTPS público do backend, configure essa URL em `config.js`:

```js
window.AI_API_BASE_URL = "https://SEU-BACKEND-PUBLICO";
```

Publique novamente os arquivos estáticos no GitHub Pages. A Law AI tentará primeiro `/api/ai` nesse backend; respostas do servidor usam o modelo hospedado e a base SQLite. Se o backend não estiver disponível e o navegador tiver WebGPU, a interface ainda pode usar o modelo local como alternativa.

## 5. Dados, privacidade e limites

A base SQLite guarda textos legais públicos, URL oficial, data de obtenção, hash e trechos indexados. Ela não guarda as perguntas nem as conversas feitas ao modelo hospedado. O histórico da sessão fica na memória da página; no modo de fallback local do navegador, respostas independentes podem ser gravadas no IndexedDB daquele dispositivo e apagadas pelo botão do chat.

A busca cobre Constituição, códigos principais e um conjunto de leis especiais. A recuperação por palavras-chave pode não encontrar todos os dispositivos. A data de obtenção não prova, sozinha, que a norma continua vigente ou é aplicável ao caso; não há pesquisa de jurisprudência. Respostas jurídicas relevantes, prazos e cálculos precisam ser conferidos em fonte oficial e revisados pelo profissional responsável.

Somente a chave pública anon/publishable do Supabase pode ser enviada ao navegador. Nunca use a chave `service_role` em `config.js` ou em valores servidos ao frontend. O schema atual do Supabase tem políticas abertas para demonstração e não deve ser usado com dados jurídicos reais sem autenticação e regras RLS adequadas.
