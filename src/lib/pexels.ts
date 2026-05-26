import type { PexelsPhoto, PexelsVideo } from '@/types'

const BASE = 'https://api.pexels.com/v1'
const BASE_VIDEO = 'https://api.pexels.com/videos'

const THEME_MAP: [RegExp, string][] = [
  [/webinar|aula online|curso online|treinamento/i, 'online webinar presentation laptop'],
  [/vend[ae]|comercial|cliente|conversao|funil/i, 'business sales handshake deal'],
  [/restaurante|gastronomia|food|cardapio/i, 'restaurant kitchen chef food'],
  [/clinica|medic|saude|paciente/i, 'modern clinic medical office'],
  [/academia|fitness|treino|muscula/i, 'gym fitness workout'],
  [/salao|barbearia|cabelo|beleza/i, 'hair salon beauty'],
  [/imovel|imobiliaria|casa|apartamento/i, 'real estate modern house'],
  [/logistic|entrega|frete|transporte/i, 'logistics delivery warehouse'],
  [/estoque|inventario|produto/i, 'warehouse inventory shelves'],
  [/financ|conta|imposto|custo|lucro|preco/i, 'business finance accounting desk'],
  [/marketing|anuncio|campanha|trafego/i, 'digital marketing creative office'],
  [/tecnologia|software|sistema|automac/i, 'technology office startup modern'],
  [/contabilidade|contador|fiscal/i, 'accounting office calculator'],
  [/advocacia|juridico|contrato/i, 'law office professional'],
  [/rh|funcionario|equipe|contratar/i, 'business team office meeting'],
  [/ecommerce|loja virtual|online/i, 'ecommerce online shopping laptop'],
  [/atendimento|suporte|whatsapp|chat/i, 'customer service support phone'],
  [/loja|varejo|moda|roupa/i, 'retail store shopping fashion'],
  [/padaria|confeitaria|bolo/i, 'bakery bread pastry'],
  [/petshop|veterinario|animal/i, 'pet shop animals veterinary'],
]

const STOP_WORDS = new Set([
  'com', 'para', 'por', 'em', 'de', 'da', 'do', 'as', 'os', 'um', 'uma', 'e', 'o', 'a',
])

export function detectSegmentQuery(title: string, _body: string): string {
  const t = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

  for (const [pattern, query] of THEME_MAP) {
    if (pattern.test(t)) return query
  }

  const keywords = title
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 3)
    .join(' ')

  return keywords || 'business entrepreneur office professional'
}

interface PexelsPhotoApi {
  id: number
  url: string
  src: { large2x: string; large: string; medium: string }
  photographer: string
  alt?: string
}

interface PexelsVideoApi {
  id: number
  url: string
  duration: number
  user?: { name?: string }
  video_files: Array<{
    link: string
    width: number
    height: number
    file_type: string
  }>
}

export async function searchPhoto(
  query: string,
  apiKey: string,
): Promise<PexelsPhoto | null> {
  try {
    const res = await fetch(
      `${BASE}/search?query=${encodeURIComponent(query)}&per_page=10&orientation=square`,
      { headers: { Authorization: apiKey } },
    )
    if (!res.ok) throw new Error(`Pexels photo error ${res.status}`)
    const data = (await res.json()) as { photos: PexelsPhotoApi[] }
    const photos = data.photos ?? []
    if (photos.length === 0) return null
    const pick = photos[Math.floor(Math.random() * Math.min(5, photos.length))]
    return {
      id: pick.id,
      url: pick.url,
      src: pick.src,
      photographer: pick.photographer,
      alt: pick.alt ?? '',
    }
  } catch (e) {
    console.error('Pexels photo error:', e)
    return null
  }
}

export async function searchVideo(
  query: string,
  apiKey: string,
): Promise<PexelsVideo | null> {
  try {
    const res = await fetch(
      `${BASE_VIDEO}/search?query=${encodeURIComponent(query)}&per_page=10&orientation=portrait&size=medium`,
      { headers: { Authorization: apiKey } },
    )
    if (!res.ok) throw new Error(`Pexels video error ${res.status}`)
    const data = (await res.json()) as { videos: PexelsVideoApi[] }
    const videos = data.videos ?? []
    if (videos.length === 0) return null
    const pick = videos[Math.floor(Math.random() * Math.min(5, videos.length))]
    const files = (pick.video_files ?? [])
      .filter((f) => f.file_type === 'video/mp4')
      .sort((a, b) => b.height - a.height)
      .map((f) => ({
        link: f.link,
        width: f.width,
        height: f.height,
        fileType: f.file_type,
      }))
    return {
      id: pick.id,
      url: pick.url,
      duration: pick.duration,
      user: pick.user?.name ?? '',
      videoFiles: files,
    }
  } catch (e) {
    console.error('Pexels video error:', e)
    return null
  }
}

// Canvas de export: 1080×1920. Queremos um arquivo do Pexels o mais próximo
// possível dessas dimensões para evitar downscale ruim no canvas e perda de
// nitidez. Baixar 4K e deixar o browser encolher introduz aliasing visível.
const TARGET_W = 1080
const TARGET_H = 1920

export function getBestVideoUrl(video: PexelsVideo): string {
  const exact = video.videoFiles.find(
    (f) => f.width === TARGET_W && f.height === TARGET_H,
  )
  if (exact) return exact.link

  // Próxima preferência: arquivo cuja altura é a mais próxima de 1920,
  // priorizando os que servem o canvas (>= 1920) sobre os menores
  // (upscale degrada mais que downscale).
  const sorted = [...video.videoFiles].sort((a, b) => {
    const aFits = a.height >= TARGET_H ? 0 : 1
    const bFits = b.height >= TARGET_H ? 0 : 1
    if (aFits !== bFits) return aFits - bFits
    return Math.abs(a.height - TARGET_H) - Math.abs(b.height - TARGET_H)
  })
  return sorted[0]?.link ?? ''
}
