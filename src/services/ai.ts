import type { AppConfig, GeneratedVariation, LayoutId, ElementId, Template } from '@/types'
import { TEMPLATES, extractNumber } from '@/lib/templates'
import { renderToDataUrlWithBg } from '@/lib/canvasRenderer'
import { searchPhoto, detectSegmentQuery } from '@/lib/pexels'

export const CAPTION_PROMPT = (title: string, body: string) => `
Você é um copywriter sênior com domínio de:
- Storytelling de Samer Agi (cenas reais, tensão antes da solução)
- Narrativa de Flávio Augusto (caso concreto, número, virada)
- SEO conversacional: a pessoa digita o problema, não o produto
- AEO (Answer Engine Optimization): responder a pergunta antes de vender
- Copywriting de resposta direta: primeira linha para, resto converte

PASSO 1 — LEIA O ARTIGO E EXTRAIA:
- Qual é o problema REAL que o artigo resolve? (não o tema, o problema)
- Tem algum número, percentual, prazo ou dado concreto? Liste todos.
- Tem algum exemplo de segmento (restaurante, clínica, loja)? Qual?
- Qual é a maior sacada ou virada do artigo? (a coisa que muda a cabeça)
- Que tipo de empresário leria isso às 23h preocupado?

PASSO 2 — MONTE O HOOK (para a imagem, máximo 8 palavras):
Use UM dos formatos abaixo, escolha o que mais doer:
- Consequência ignorada: "Você perde [X] por não saber disso"
- Cena específica: "23h. Caixa fechado. Mesmo erro de sempre."
- Dado chocante: "[número real do artigo] de diferença. Só isso."
- Pergunta que dói: "Por que seu concorrente cobra mais e vende mais?"
- Confissão: "Demorei [tempo] pra entender isso. Custou caro."

PASSO 3 — MONTE A LEGENDA com esta estrutura exata:

[Cena de 1-2 linhas que o empresário-alvo reconhece na própria vida]

[Tensão: o que acontece quando ele ignora isso — seja específico com dados do artigo]

[Virada: a sacada principal do artigo, explicada de forma simples e direta]

[Prova ou exemplo concreto do artigo — se tiver número, use. Se tiver segmento, cite.]

[CTA suave que gera comentário — faça uma pergunta que só quem vive isso responde]

[linha em branco]
[exatamente 5 hashtags sobre negócios/empreendedorismo — ex.: #PequenosNegócios #Empreendedorismo #GestãoDeNegócios #Vendas #MarketingDigital]

REGRAS DE OURO:
- Use dados reais do artigo — se tem "40% de aumento", coloca "40%", não "aumento significativo"
- Se o artigo fala de restaurante, fala de restaurante. Não generalize.
- Nunca escreva "Chega de", "Descubra", "Você sabia que", "Transforme"
- Nunca mencione IA, tecnologia ou ferramenta na primeira metade
- Tom: conversa de calçada com o dono do negócio, não palestra de coach
- Máximo 200 palavras na legenda (sem as hashtags)
- Exatamente 5 hashtags, todas sobre negócios / empreendedorismo / gestão / vendas / marketing — nunca mais que isso
- Máximo 4 emojis, só onde reforçam a emoção

PASSO 4 — GERE photoQuery (foto de fundo da imagem):
- Deve descrever uma cena visual que ILUSTRA o hook, não o tema genérico
- Ex: hook "23h. Caixa fechado. Mesmo erro de sempre." → photoQuery: "tired businessman late night office desk lamp"
- Ex: hook "Você perde 40% de conversão por ignorar isso" → photoQuery: "frustrated customer leaving store empty handed"
- Ex: hook "Dobrei o faturamento sem contratar ninguém" → photoQuery: "happy entrepreneur celebrating business growth laptop"
- Sempre em inglês, 4-6 palavras descritivas, sem vírgulas

PASSO 5 — GERE videoQuery (vídeo de fundo do Reel):
- Deve ter MOVIMENTO relacionado ao tema — Pexels vídeo performa melhor com cenas dinâmicas
- Ex: restaurante → "busy restaurant kitchen chef cooking"
- Ex: vendas → "business meeting handshake closing deal"
- Ex: finanças → "hands counting money calculator spreadsheet"
- Sempre em inglês, 4-6 palavras, foco em ação/movimento

PASSO 6 — GERE points (3 pontos para o vídeo Reel):
- Exatamente 3 pontos
- Cada ponto é uma sacada prática do artigo — não genérica
- Máximo 8 palavras por ponto
- Tom direto: o que o empresário GANHA ou PARA DE PERDER
- Ex para artigo de social media:
  "Conteúdo certo atrai cliente certo"
  "Consistência vale mais que viralizar"
  "IA reduz 80% do tempo de criação"
- Nunca usar: "Aprenda", "Descubra", "Entenda", "Saiba mais"

FORMATO DE RETORNO — apenas JSON sem markdown:
{
  "hook": "texto da imagem — até 8 palavras de impacto",
  "caption": "legenda completa com hashtags",
  "photoQuery": "query em inglês para foto de fundo — descreve a CENA do hook",
  "videoQuery": "query em inglês para vídeo de fundo — descreve MOVIMENTO relacionado ao tema",
  "points": [
    "ponto 1 curto e direto — máximo 8 palavras",
    "ponto 2 curto e direto — máximo 8 palavras",
    "ponto 3 curto e direto — máximo 8 palavras"
  ]
}

ARTIGO PARA TRANSFORMAR:
Título: ${title}
Conteúdo completo: ${body.slice(0, 3000)}
`

async function callOpenAI(prompt: string, config: AppConfig, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices[0].message.content as string
}

async function callGemini(prompt: string, config: AppConfig): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text as string
}

async function callOpenRouter(prompt: string, config: AppConfig, maxTokens: number): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openrouterKey.trim()}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'PostCraft',
    },
    body: JSON.stringify({
      model: config.openrouterModel || 'google/gemini-flash-1.5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`)
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`)
  return data.choices[0].message.content as string
}

async function callTextAI(prompt: string, config: AppConfig, maxTokens: number): Promise<string> {
  if (config.aiProvider === 'gemini') {
    return callGemini(prompt, config)
  }
  if (config.aiProvider === 'openrouter') {
    return callOpenRouter(prompt, config, maxTokens)
  }
  return callOpenAI(prompt, config, maxTokens)
}

export interface CaptionResult {
  hook: string
  caption: string
  photoQuery: string
  videoQuery: string
  points: string[]
}

const FALLBACK_POINTS = [
  'Identifique onde está perdendo dinheiro',
  'Use os dados do seu próprio negócio',
  'Resultado visível em menos de 7 dias',
]

function normalizePoints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return FALLBACK_POINTS
  const cleaned = raw
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .slice(0, 3)
  return cleaned.length ? cleaned : FALLBACK_POINTS
}

export async function generateCaption(
  title: string,
  body: string,
  config: AppConfig,
  promptOverride?: string,
): Promise<CaptionResult> {
  const prompt = promptOverride
    ? promptOverride.replace('[TÍTULO]', title).replace('[CONTEÚDO]', body.slice(0, 3000))
    : CAPTION_PROMPT(title, body)
  const raw = await callTextAI(prompt, config, 1400)
  const cleaned = raw.replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim()
  const fallbackQuery = detectSegmentQuery(title, body)
  try {
    const parsed = JSON.parse(cleaned) as {
      hook?: string
      caption?: string
      photoQuery?: string
      videoQuery?: string
      points?: unknown
    }
    return {
      hook: parsed.hook || title,
      caption: parsed.caption || cleaned,
      photoQuery: parsed.photoQuery?.trim() || fallbackQuery,
      videoQuery: parsed.videoQuery?.trim() || fallbackQuery,
      points: normalizePoints(parsed.points),
    }
  } catch {
    const lines = cleaned.split('\n').filter((l) => l.trim())
    return {
      hook: lines[0] || title,
      caption: lines.slice(1).join('\n') || cleaned,
      photoQuery: fallbackQuery,
      videoQuery: fallbackQuery,
      points: FALLBACK_POINTS,
    }
  }
}

// Slots fixos: 4 feed + 4 story, intercalados [feed0, story0, feed1, story1, ...].
// O StudioPage usa essa ordem em selectFeedVariation (feedIndex * 2).
interface SlotSpec {
  format: 'feed' | 'story'
  templateId: string
  layout: LayoutId
  withPhoto: boolean
}

const SLOT_SPECS: SlotSpec[] = [
  // pair 0 — foto Pexels (se disponível) + dark + center
  { format: 'feed',  templateId: 'dark',   layout: 'center',       withPhoto: true },
  { format: 'story', templateId: 'dark',   layout: 'center',       withPhoto: true },
  // pair 1 — cor sólida + dark + center (versão "limpa" que sempre funcionou)
  { format: 'feed',  templateId: 'dark',   layout: 'center',       withPhoto: false },
  { format: 'story', templateId: 'dark',   layout: 'center',       withPhoto: false },
  // pair 2 — cor sólida + orange + bold-single
  { format: 'feed',  templateId: 'orange', layout: 'bold-single',  withPhoto: false },
  { format: 'story', templateId: 'orange', layout: 'bold-single',  withPhoto: false },
  // pair 3 — cor sólida + light/navy + left
  { format: 'feed',  templateId: 'light',  layout: 'left',         withPhoto: false },
  { format: 'story', templateId: 'navy',   layout: 'left',         withPhoto: false },
]

function pickElement(layout: LayoutId, format: 'feed' | 'story', hook: string): ElementId {
  const num = extractNumber(hook)
  if (num) return 'number'
  if (layout === 'bold-single') return 'corner'
  if (layout === 'left') return 'dots'
  return format === 'story' ? 'lines' : 'circle'
}

function templateById(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

export async function generateVariations(
  hook: string,
  handle?: string,
  pexelsKey?: string,
  bgQuery?: string,
  title?: string,
  body?: string,
): Promise<GeneratedVariation[]> {
  // Buscar uma única foto do Pexels e reutilizar nos slots com withPhoto=true.
  let photoUrl: string | undefined
  let photoCredit = ''
  let usedQuery = ''
  if (pexelsKey) {
    usedQuery = bgQuery?.trim() || detectSegmentQuery(title ?? '', body ?? '')
    const photo = await searchPhoto(usedQuery, pexelsKey)
    if (photo) {
      photoUrl = photo.src.large2x
      photoCredit = photo.photographer
    }
  }

  const variations: GeneratedVariation[] = []

  for (const slot of SLOT_SPECS) {
    const tmpl = templateById(slot.templateId)
    const element = pickElement(slot.layout, slot.format, hook)
    const useBg = slot.withPhoto && !!photoUrl

    const dataUrl = await renderToDataUrlWithBg(
      tmpl,
      slot.layout,
      element,
      hook,
      slot.format,
      handle,
      useBg ? photoUrl : undefined,
    )
    variations.push({
      dataUrl,
      config: {
        template: tmpl,
        layout: slot.layout,
        element,
        format: slot.format,
        backgroundType: useBg ? 'photo' : 'color',
        backgroundMediaUrl: useBg ? photoUrl : '',
        backgroundMediaCredit: useBg ? photoCredit : '',
        backgroundQuery: usedQuery,
      },
      format: slot.format,
    })
  }

  return variations // 8 variações: feed0,story0,feed1,story1,feed2,story2,feed3,story3
}
