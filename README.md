# PostCraft

Plataforma de geração de posts para Instagram a partir de artigos de blog.

## Stack

- Vite 6 + React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui components (Radix UI primitives)
- React Router v6
- Zustand (estado global)
- Supabase JS client

## Setup local

```bash
npm install
npm run dev
```

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz com:

```env
VITE_SUPABASE_URL=        # URL do projeto Supabase (ex: https://xxxx.supabase.co)
VITE_SUPABASE_ANON_KEY=   # Chave anônima pública do Supabase
VITE_OPENAI_KEY=          # Chave da API da OpenAI (para GPT-4o-mini e DALL-E 3)
VITE_GEMINI_KEY=          # Chave da API do Google Gemini (opcional)
```

As chaves também podem ser inseridas diretamente na interface em `/setup` e são salvas em `localStorage` com a chave `postcraft_config`.

## Rotas

| Rota | Descrição |
|------|-----------|
| `/setup` | Configuração de conexões e chaves de API |
| `/source` | Seleção de tabela, colunas e artigos do Supabase |
| `/queue` | Fila de geração com status em tempo real |
| `/studio/:id` | Revisão, edição e exportação de um post |

## Funcionalidades do MVP

- Conexão com Supabase via API REST (sem SDK server-side)
- Geração de legendas via OpenAI GPT-4o-mini ou Google Gemini 2.0 Flash
- Geração de imagens via DALL-E 3
- Download de imagem gerada
- Edição de legenda com contador de caracteres
- Preview estilo Instagram
- Persistência das configurações em localStorage
