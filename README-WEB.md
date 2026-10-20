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

Quem usa o site não precisa informar nem enviar chave de IA. Quando o Ollama está instalado e iniciado na mesma máquina, o backend usa automaticamente o modelo local `llama3.2:3b`; nenhuma chave externa é necessária e as conversas ficam nessa máquina. Em outros servidores, o administrador pode configurar uma credencial de provedor apenas no servidor; ela nunca é enviada ao navegador.

Para instalar o modelo local, instale o Ollama, baixe `llama3.2:3b` (`ollama pull llama3.2:3b`) e mantenha o serviço Ollama iniciado antes de abrir o site. Defina `OLLAMA_MODELS` para armazenar os modelos em uma unidade com espaço livre. O status da Law AI confirma a disponibilidade do modelo local antes de anunciar que está pronta.

Quando o Ollama local não estiver disponível, OpenAI continua disponível com `OPENAI_API_KEY`; `AI_MODEL` e `AI_BASE_URL` permitem selecionar outro modelo ou endpoint compatível. NVIDIA NIM também pode ser escolhida com `NVIDIA_API_KEY`. Em hospedagens como Render, configure `AI_PROVIDER=openai` para selecionar explicitamente o provedor remoto.

```bash
pip install -r requirements.txt
python server.py
```

Depois abra:

http://localhost:8080

Para executar os testes automatizados do serviço de IA:

```bash
python -m unittest discover -p "test_*.py"
```

### Módulo de análise de penas

Para perguntas sobre crimes, penas, dosimetria, progressão e execução penal, o backend consulta excertos correspondentes em até três textos oficiais do Planalto (Código Penal, legislação especial identificada e Constituição Federal), quando disponíveis. A consulta é feita pelo servidor e usa cache por seis horas. Nenhum texto do caso é enviado ao Planalto; ao modelo de IA aplica-se o fluxo normal da conversa. Com Ollama, esse processamento é local; com provedor remoto, o conteúdo da conversa é enviado ao provedor configurado.

A busca é uma recuperação limitada por palavras-chave, não verifica sozinha vigência, lei temporalmente aplicável ou se o trecho localizado é completo; a resposta deve declarar a limitação e citar os links fornecidos. Não há pesquisa de jurisprudência, consulta a tribunais nem mecanismo que valide automaticamente a dosimetria. Cálculos e conclusões devem ser conferidos no texto integral oficial e revisados pelo advogado.

## 4. Publicar na web com Render

1. Suba esta pasta para um repositório GitHub.
2. No Render, crie um Web Service apontando para o repositório.
3. Build command: `pip install -r requirements.txt`
4. Start command: `python server.py`
5. Em **Environment** no Render, configure `AI_PROVIDER=openai` e `OPENAI_API_KEY` no servidor. Essa configuração é feita uma vez pelo administrador: usuários do site não precisam enviar chave alguma, e o segredo não é exposto no navegador. O modelo padrão remoto é `gpt-4o-mini`; altere `AI_MODEL` se desejar outro. Para usar NVIDIA NIM, selecione `AI_PROVIDER=nvidia` e configure `NVIDIA_API_KEY`.
6. Configure `SUPABASE_ANON_KEY` com a anon public key para ativar a sincronização.
7. Faça o deploy.

O `server.py` serve o site e também o endpoint `/api/ai`.
Nunca compartilhe a chave nem a coloque em `config.js`, no frontend ou no GitHub. O endpoint `/api/health` informa se a credencial foi carregada pelo servidor.

### Frontend no GitHub Pages e backend separado

O GitHub Pages serve arquivos estáticos e não executa `server.py`. Portanto, o chat não responderá no site publicado enquanto não existir um backend público. Publique `server.py` como Web Service (por exemplo, no Render), configure o provedor no servidor ou instale o Ollama no próprio host do backend e confirme que `/api/health` responde. Em seguida, defina `AI_API_BASE_URL` em `config.js` para a URL pública desse backend, sem barra final, e publique novamente o frontend. Não use `localhost` nessa configuração: no navegador de cada visitante, `localhost` aponta para o computador do visitante. A URL do backend é pública; credenciais devem permanecer somente no ambiente privado do servidor.

## 5. Importante sobre segurança

Somente a **anon public key** pode ser enviada ao navegador. Nunca configure a `service_role` key em `config.js` ou nas variáveis servidas ao frontend.

O schema atual usa uma política aberta para `anon`, adequada para um projeto/TCC de demonstração, mas não recomendada para produção com dados jurídicos reais. Para produção, use Supabase Auth e políticas RLS por usuário/organização.

## 6. Limitação atual da IA

A IA usa o Ollama local automaticamente quando o serviço está disponível. Em hospedagens sem Ollama, OpenAI ou NVIDIA NIM podem ser configurados pelo administrador no servidor, sem que os usuários forneçam chaves. O modelo local é menor e pode ser menos preciso que modelos remotos; respostas jurídicas devem ser revisadas e referências e prazos conferidos em fontes oficiais.

Se o provedor responder com erro de crédito insuficiente, quota esgotada ou chave inválida, o sistema exibirá uma mensagem clara em vez de falha genérica. Nesse caso, é necessário recarregar créditos da conta do provedor, validar a chave ou trocar para outro modelo/fornecedor.

A assistente usa as instruções jurídicas do backend para orientar respostas em português, análise cuidadosa de fatos, elaboração de rascunhos e proteção contra pedidos ilícitos. Para perguntas sobre penas, há recuperação limitada de excertos da legislação oficial do Planalto, mas não pesquisa de jurisprudência, integração com tribunais, leitura de anexos, histórico persistente ou acesso autorizado ao cadastro de clientes/processos. Não use respostas como pesquisa jurídica completa ou com dados reais sigilosos; confirme legislação, jurisprudência e prazos em fontes oficiais e revise minutas com o advogado responsável. O login atual do site não autentica nem autoriza o endpoint de IA no servidor.
