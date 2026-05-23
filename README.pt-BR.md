# Mike

Uma alternativa open-source ao Harvey e ao Legora: um Word Addin e uma aplicação completa local-first com backend em Bun.

Site: [mikeoss.com](https://mikeoss.com)

### Por que um Word Addin?

Todo advogado no mundo tem uma coisa em comum: usa o Microsoft Word. Ele é a camada de documentos padrão para o trabalho jurídico há mais de 30 anos, em todas as jurisdições, tamanhos de escritório e sistemas legais. Em vez de pedir que advogados abandonem seus fluxos de trabalho, o Mike funciona dentro das ferramentas que eles já conhecem.

O Word Addin se integra diretamente ao Microsoft Word com sincronização em tempo real com o aplicativo desktop. A IA pode editar documentos no modo de Controle de Alterações ou no modo de Comentários, dependendo do fluxo de trabalho. Cada redline da IA traz uma justificativa de uma frase anexada como comentário do Word. O revisor vê tanto a alteração quanto o motivo — o mesmo fluxo de trabalho que um advogado revisor já utiliza.

### Backend Compartilhado

Chats, projetos e uploads são visíveis tanto pelo Word Addin quanto pelo aplicativo desktop. Revise no desktop, redija no Word, sem inconsistências de estado.

### Por que Local-First?

O trabalho jurídico é um dos piores ambientes para uma ferramenta de IA baseada em nuvem. A versão original do Mike exigia implantar o Cloudflare R2 e o Supabase separadamente, além de executar comandos npm separados para o backend e o frontend — uma barreira real para advogados sem conhecimento técnico.

Esta versão simplifica tudo:
- **Aplicativo Electron único** com configuração de dependências simplificada
- **Banco de dados SQLite** em `~/.mike/mike.db` — sem necessidade de implantar o Supabase
- **Armazenamento local** em `~/.mike/storage/` — os documentos ficam na própria máquina do advogado
- **Um comando para iniciar**: `bun start`

### Por que Bun?

Este repositório contém múltiplos pacotes: backend, frontend, word-addin, electron e outros. O protocolo `workspace:*` do Bun resolve todas as dependências em uma única passagem de instalação, tornando o desenvolvimento e a implantação mais simples.

## Conteúdo

- `backend/` - API Express, acesso ao banco de dados, processamento de documentos e migrations
- `frontend/` - Aplicação desktop em Next.js
- `electron/` - Wrapper do aplicativo Electron
- `word-addin/` - Word Addin para Microsoft Word
- `packages/mcp-server/` - Servidor Model Context Protocol (a ser desenvolvido)
- `packages/shared/` - Tipos e utilitários compartilhados

## Configuração

Instale as dependências usando o Bun:

```bash
bun install
```

Crie os arquivos de ambiente locais a partir dos exemplos:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Inicie o servidor de desenvolvimento:

```bash
bun start
```

Isso inicia o backend e o frontend em modo de desenvolvimento. Abra o aplicativo Electron ou acesse `http://localhost:3000`.

## Build

```bash
bun run build
bun run build --filter word-addin
bun run build --filter frontend
bun run lint
```

## Serviços Necessários

- Chave de API de pelo menos um provedor de modelos suportado, dependendo dos modelos que você habilitar
- LibreOffice para conversão de DOC/DOCX para PDF (opcional, para conversão de documentos)

## Licença

AGPL-3.0-only. Consulte `LICENSE`.
