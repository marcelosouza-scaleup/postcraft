import type { VideoConfig, VideoPhase, VideoPoint } from '../types'
import { detectSegmentQuery } from './pexels'

export const DEFAULT_PHASES: VideoPhase[] = [
  { id: 'logo',   label: 'Entrada do logo',           durationSeconds: 2,  enabled: true },
  { id: 'hook',   label: 'Hook (palavra por palavra)', durationSeconds: 4,  enabled: true },
  { id: 'points', label: 'Pontos principais',           durationSeconds: 10, enabled: true },
  { id: 'cta',    label: 'CTA final',                   durationSeconds: 4,  enabled: true },
]

export function buildDefaultVideoConfig(
  hook: string,
  caption: string,
  handle: string,
  templateId: string,
  title?: string,
  body?: string,
  videoQuery?: string,
  _reserved?: undefined,
  points?: string[],
): VideoConfig {
  const wordCount = hook.trim().split(/\s+/).filter(Boolean).length
  const hookDuration = Math.max(3, wordCount * 0.45)
  const resolvedPoints: VideoPoint[] =
    points && points.length ? points.map((text) => ({ text })) : extractPoints(caption)

  return {
    hook,
    points: resolvedPoints,
    cta: 'Comenta aqui "quero saber mais"',
    handle: handle || '@postcraft',
    phases: DEFAULT_PHASES.map((p) =>
      p.id === 'hook' ? { ...p, durationSeconds: hookDuration } : { ...p },
    ),
    templateId,
    fps: 30,
    style: 'points',
    backgroundVideoUrl: '',
    backgroundVideoCredit: '',
    backgroundVideoQuery:
      videoQuery?.trim() || (title && body ? detectSegmentQuery(title, body) : ''),
    backgroundVideoUrl2: '',
    backgroundVideoCredit2: '',
    backgroundVideoQuery2: '',
    transition: { type: 'fade', durationSeconds: 0.5 },
  }
}

function extractPoints(caption: string): VideoPoint[] {
  const lines = caption
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && l.length < 80 && !l.startsWith('#'))
    .slice(0, 3)

  return lines.length >= 2
    ? lines.map((text) => ({ text }))
    : [
        { text: 'Identifique onde está perdendo dinheiro' },
        { text: 'Use os dados do seu próprio negócio' },
        { text: 'Resultado visível em menos de 7 dias' },
      ]
}
