# Mike

Mike é um assistente de documentos jurídicos com frontend em Next.js, backend em Express, autenticação e banco de dados via Supabase/Postgres, e armazenamento de objetos compatível com Cloudflare R2.

Site: [mikeoss.com](https://mikeoss.com)

## Conteúdo

- `frontend/` - Aplicação Next.js
- `backend/` - API Express, acesso ao Supabase, processamento de documentos e esquema do banco de dados
- `backend/schema.sql` - Esquema do Supabase para bancos de dados novos
- `backend/migrations/` - Atualizações incrementais do banco de dados para instalações existentes

## Pré-requisitos

- Node.js 20 ou superior
- npm
- git
- Um projeto no Supabase
- Um bucket no Cloudflare R2, MinIO ou outro bucket compatível com S3
- Chave de API de pelo menos um provedor de modelos suportado: Anthropic, Google Gemini ou OpenAI
- LibreOffice instalado localmente caso precise de conversão de DOC/DOCX para PDF

## Configuração do Banco de Dados

Para um banco de dados Supabase novo, abra o editor SQL do Supabase e execute:

```sql
-- copie e execute o conteúdo de:
-- backend/schema.sql
```

O arquivo de esquema é baseado em `supabase-migration.sql` e incorpora os arquivos posteriores de `backend/migrations/`.

Para um banco de dados existente, não execute o arquivo de esquema completo sobre dados de produção. Aplique os arquivos incrementais em `backend/migrations/` em vez disso.

## Variáveis de Ambiente

Crie os arquivos de ambiente locais:

```bash
touch backend/.env
touch frontend/.env.local
```

Crie `backend/.env`:

```bash
PORT=3001
FRONTEND_URL=http://localhost:3000
DOWNLOAD_SIGNING_SECRET=substitua-por-uma-string-hex-aleatoria-de-32-bytes
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SECRET_KEY=sua-chave-service-role-do-supabase

R2_ENDPOINT_URL=https://seu-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=sua-chave-de-acesso-r2
R2_SECRET_ACCESS_KEY=sua-chave-secreta-r2
R2_BUCKET_NAME=mike

GEMINI_API_KEY=sua-chave-gemini
ANTHROPIC_API_KEY=sua-chave-anthropic
OPENAI_API_KEY=sua-chave-openai
RESEND_API_KEY=sua-chave-resend
USER_API_KEYS_ENCRYPTION_SECRET=seu-segredo-longo-e-aleatorio
```

Crie `frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua-chave-anon-do-supabase
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Os valores do Supabase estão disponíveis no painel do projeto. Use a URL do projeto para `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, a chave service role para o backend `SUPABASE_SECRET_KEY` e a chave anon/pública para `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`. Se o seu projeto Supabase exibir múltiplos formatos de chave, use as chaves no formato JWT legado (anon e service role) esperadas pelas bibliotecas cliente do Supabase.

As chaves de provedor só são necessárias para os modelos e recursos de e-mail que você pretende utilizar. As chaves de provedor de modelos podem ser configuradas em `backend/.env` para toda a instância, ou individualmente por usuário em **Conta > Modelos e Chaves de API**. Se uma chave de provedor estiver presente em `backend/.env`, esse provedor estará disponível por padrão e o campo correspondente no navegador será somente leitura.

## Instalação

Instale as dependências de cada aplicação:

```bash
npm install --prefix backend
npm install --prefix frontend
```

## Executando Localmente

Inicie o backend:

```bash
npm run dev --prefix backend
```

Inicie a aplicação principal:

```bash
npm run dev --prefix frontend
```

Acesse `http://localhost:3000`.

## Primeiro Uso

1. Cadastre-se na aplicação.
2. Se não configurou as chaves de provedor em `backend/.env`, acesse **Conta > Modelos e Chaves de API** e adicione uma chave da Anthropic, Gemini ou OpenAI.
3. Crie ou abra um projeto e comece a conversar com seus documentos.

## Solução de Problemas

**O e-mail de confirmação de cadastro nunca chega.** Os e-mails de confirmação são enviados pelo Supabase Auth, não pelo Mike. Para desenvolvimento local, a solução mais simples é desativar a confirmação por e-mail em **Supabase > Authentication > Providers > Email**. Para produção, configure um SMTP personalizado no Supabase; o servidor de e-mail nativo tem limites rigorosos de taxa e pode ser restrito em projetos mais recentes.

**O seletor de modelo exibe um aviso de chave ausente.** Adicione uma chave para esse provedor em **Conta > Modelos e Chaves de API**, ou configure a chave do provedor em `backend/.env` e reinicie o backend.

**A conversão de DOC ou DOCX falha.** Instale o LibreOffice localmente e reinicie o backend para que os comandos de conversão de documentos estejam disponíveis no PATH do processo.

## Docker

Imagens Docker estão disponíveis para o frontend e o backend. A imagem do backend inclui o LibreOffice para conversão de DOC/DOCX para PDF.

### Construindo as imagens

Execute os comandos abaixo a partir da raiz do projeto. O frontend requer as variáveis `NEXT_PUBLIC_*` em tempo de build, pois o Next.js as incorpora no bundle do cliente.

```bash
# Backend
docker build -t homeserver:32081/mike-backend:latest ./backend

# Frontend
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua-chave-anon-do-supabase \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://seu-servidor:32083 \
  -t homeserver:32081/mike-frontend:latest \
  ./frontend
```

### Executando localmente com Docker Compose

Crie um arquivo `.env` na raiz do projeto com todas as variáveis de `backend/.env.example` e `frontend/.env.local.example`, depois execute:

```bash
docker compose up
```

O frontend estará disponível em `http://localhost:3000` e o backend em `http://localhost:3001`.

### Deploy em Homelab / Portainer

Use `docker-compose-homelab.yml` para fazer o deploy como uma stack no Portainer. O arquivo contém todas as variáveis de ambiente embutidas e expõe o backend na porta `32083` e o frontend na porta `32084`.

Se você alterar a URL do backend após a imagem do frontend ter sido construída, reconstrua a imagem do frontend com o argumento de build `NEXT_PUBLIC_API_BASE_URL` correto e envie a nova imagem para o registry antes de reimplantar a stack.

## Verificações Úteis

```bash
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```
