# PostCraft — Especificação do Produto

## Visão geral

PostCraft é uma plataforma SaaS de geração de conteúdo para redes sociais. Ela conecta fontes de conteúdo (Supabase, Google Drive, Docs, etc.), usa IA para criar legendas e imagens no padrão da marca, e entrega um fluxo de aprovação + exportação para publicação manual ou automatizada.

O produto nasceu como ferramenta interna da Cloudfy Leads — que usa o blog para gerar demanda para parceiros de automação com IA — mas é agnóstico de marca e pode ser usado por qualquer empresa ou agência.

---

## Problema que resolve

Criar conteúdo consistente para Instagram a partir de artigos de blog é lento, manual e depende de um designer. O PostCraft automatiza 80% do processo: lê o artigo, gera a imagem no padrão visual da marca, cria a legenda com hashtags, e entrega tudo pronto para aprovação em lote. O operador só valida e posta.

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Vite 6 + React 19 + TypeScript |
| Estilização | Tailwind CSS v4 + shadcn/ui |
| Roteamento | React Router v6 |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| IA — texto | OpenAI GPT-4o mini ou Gemini 2.0 Flash (selecionável) |
| IA — imagem | DALL-E 3 (via OpenAI) |
| Linguagem | TypeScript 5, pt-BR |
| Deploy | Cloudflare Pages (estático) |

---

## Estrutura de pastas

```
src/
├── pages/
│   ├── SetupPage.tsx           # Configuração de conexões e chaves
│   ├── SourcePage.tsx          # Seleção de fonte e artigos
│   ├── QueuePage.tsx           # Fila de geração com status
│   └── StudioPage.tsx          # Revisão, edição e exportação
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── source/
│   │   ├── TableSelector.tsx
│   │   ├── ColumnMapper.tsx
│   │   └── ArticleList.tsx
│   ├── queue/
│   │   ├── QueueItem.tsx
│   │   └── StatusBadge.tsx
│   └── studio/
│       ├── ImagePreview.tsx
│       ├── CaptionEditor.tsx
│       └── InstagramPreview.tsx
├── lib/
│   ├── supabase.ts             # Cliente Supabase
│   ├── openai.ts               # Chamadas OpenAI (texto + imagem)
│   ├── gemini.ts               # Chamadas Gemini
│   ├── generators.ts           # Prompts e orquestração de geração
│   └── imageTemplate.ts        # Composição de imagem com template de marca
├── hooks/
│   ├── useSupabaseSource.ts
│   ├── useGenerationQueue.ts
│   └── useStudio.ts
├── contexts/
│   └── ConfigContext.tsx        # Chaves de API, provedor selecionado
├── stores/
│   └── queueStore.ts           # Estado global da fila (Zustand)
├── types/
│   └── index.ts
└── utils/
    └── download.ts
```

---

## Fluxo principal

```
Configuração → Fonte → Fila → Studio → Exportação
```

### 1. Configuração (SetupPage)

O usuário fornece:
- URL e anon key do Supabase
- Chave OpenAI
- Chave Gemini
- Seleção de provedor de texto (OpenAI ou Gemini)
- Handle do Instagram (para preview)
- (Futuro) Credenciais Google Drive / Docs

Dados salvos em `localStorage` com chave `postcraft_config`. Nunca enviados a servidor externo.

### 2. Fonte (SourcePage)

Ao conectar ao Supabase:
- Busca tabelas disponíveis via spec OpenAPI em `/rest/v1/`
- Usuário seleciona a tabela
- Sistema detecta automaticamente colunas de título e conteúdo (busca por `title`, `titulo`, `content`, `body`, `conteudo`)
- Usuário confirma ou ajusta o mapeamento
- Lista os registros com checkbox de seleção múltipla
- Botão "Adicionar à fila" envia os selecionados para QueuePage

### 3. Fila de geração (QueuePage)

Cada item na fila tem status: `pending → generating → done | error`

Ao clicar em "Gerar todos", para cada item pendente em sequência:
1. Gera legenda via IA (texto)
2. Gera prompt de imagem via IA (texto)
3. Gera imagem via DALL-E 3
4. Atualiza status para `done`

Cada item mostra: thumbnail da imagem, título, início da legenda, status badge e botão "Abrir no Studio".

### 4. Studio (StudioPage)

Para cada post gerado:
- Imagem 1:1 em preview com botões Baixar e Regerar
- Legenda editável em textarea com contagem de caracteres
- Botões Copiar e Regerar legenda
- Preview estilo Instagram (avatar + handle + início do texto)
- Exibe o prompt de imagem usado (para auditoria e ajuste)

---

## Integrações de fonte de conteúdo

### Fase 1 (MVP)
- **Supabase** — qualquer tabela, qualquer coluna

### Fase 2
- **Google Drive** — lista arquivos de uma pasta, lê conteúdo de .txt e .docx
- **Google Docs** — conecta via OAuth, lê documento por URL ou ID
- **Upload manual** — textarea ou upload de arquivo .txt/.md

### Fase 3
- **Notion** — via API pública, lê páginas de um database
- **Webflow CMS** — via API, lê itens de uma collection
- **RSS Feed** — lê artigos de qualquer feed RSS

---

## Geração de conteúdo

### Legenda (prompt base)

```
Você é especialista em social media para Instagram.
Crie uma legenda impactante e humanizada baseada neste conteúdo.

REGRAS:
- Tom conversacional, direto, sem jargão corporativo
- Máximo 180 palavras
- Use emojis estrategicamente (máximo 4–5)
- Inclua 1 pergunta de engajamento
- Termine com linha em branco e 20 hashtags relevantes

Formato exato:
[texto da legenda]

[#hashtag1 #hashtag2 ...]

Título: {title}
Conteúdo: {body}
```

### Prompt de imagem (gerado por IA antes de chamar DALL-E)

```
Baseado neste artigo, crie um prompt conciso para DALL-E 3.
Estilo: fotografia moderna, clean, profissional. Formato quadrado 1:1.
Sem texto ou palavras na imagem. Tons quentes com acento laranja/coral.
Máximo 80 palavras. Retorne APENAS o prompt.

Tema: {title}
Contexto: {body}
```

### Custo estimado por post
- Legenda GPT-4o mini: ~$0,001
- Prompt de imagem GPT-4o mini: ~$0,001
- Imagem DALL-E 3 standard: ~$0,040
- **Total por post: ~$0,042**

---

## Template de imagem com identidade visual

Na Fase 2, em vez de usar a imagem bruta do DALL-E, o sistema compõe uma imagem final com o template da marca:

**Camadas (fundo → frente):**
1. Imagem gerada pelo DALL-E (fundo, 1024×1024)
2. Overlay semitransparente com gradiente da marca
3. Logo da empresa (canto superior ou inferior)
4. Título do post (tipografia da marca)
5. URL ou CTA (opcional, zona de segurança do Instagram)

**Implementação:** `canvas` no browser ou `sharp` + `jimp` em Node.js. Exporta como JPEG 1080×1080.

Zona de segurança do Instagram: manter elementos críticos dentro de uma margem de 14% em todos os lados.

---

## Publicação automatizada (Fase 3)

Via Instagram Graph API (oficial, sem risco de ban):

**Pré-requisitos:**
- Conta Instagram Business ou Creator
- App configurado no Facebook Developers
- Token com permissão `instagram_content_publish`
- Imagem hospedada em URL pública (upload para Supabase Storage ou S3)

**Fluxo:**
1. Upload da imagem para Supabase Storage (URL pública)
2. POST para Graph API criando um container de mídia
3. POST para publicar o container com legenda

---

## Banco de dados (Supabase)

Tabelas do PostCraft (schema separado do blog):

| Tabela | Campos principais | Uso |
|---|---|---|
| `pc_connections` | id, name, type, config_json | Fontes de conteúdo salvas |
| `pc_posts` | id, source_id, title, body, caption, image_url, image_prompt, status, created_at | Histórico de posts gerados |
| `pc_templates` | id, name, config_json, preview_url | Templates de imagem salvos |

---

## Variáveis de ambiente

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_KEY=
VITE_GEMINI_KEY=
```

> Em produção multi-tenant, as chaves de IA devem ficar no backend (Edge Functions do Supabase), nunca expostas no frontend.

---

## Roadmap

| Fase | Features | Status |
|---|---|---|
| MVP | Setup + Supabase + geração + studio | 🔨 Em construção |
| 1.1 | Histórico de posts, favoritos, re-edição | — |
| 1.2 | Template de imagem com identidade visual | — |
| 2.0 | Google Drive, Docs, upload manual | — |
| 2.1 | Notion, Webflow, RSS | — |
| 3.0 | Publicação via Instagram Graph API | — |
| 3.1 | Agendamento de posts | — |
| 4.0 | Multi-usuário, workspaces, planos | — |
