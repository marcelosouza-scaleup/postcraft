import type { Template, TemplateTone } from '../types'

export const TEMPLATES: Template[] = [
  {
    id: 'dark', label: 'Dark',
    bg1: '#0a0e1a', bg2: '#0d1635',
    accent: '#ff6b35', text: '#ffffff', highlight: '#ff6b35',
    logoBg: '#ff6b35', logoText: '#ffffff',
    tone: 'urgency',
  },
  {
    id: 'orange', label: 'Orange',
    bg1: '#e85d2a', bg2: '#c04a1a',
    accent: '#ffffff', text: '#ffffff', highlight: '#ffffff',
    logoBg: '#ffffff', logoText: '#e85d2a',
    tone: 'energy',
  },
  {
    id: 'light', label: 'Light',
    bg1: '#ffffff', bg2: '#f5f0ea',
    accent: '#e85d2a', text: '#0a0e1a', highlight: '#e85d2a',
    logoBg: '#e85d2a', logoText: '#ffffff',
    tone: 'calm',
  },
  {
    id: 'navy', label: 'Navy',
    bg1: '#1a1a2e', bg2: '#0f0f23',
    accent: '#ff6b35', text: '#ffffff', highlight: '#ff6b35',
    logoBg: '#ff6b35', logoText: '#ffffff',
    tone: 'story',
  },
  {
    id: 'cream', label: 'Cream',
    bg1: '#fdf6ec', bg2: '#f0e6d0',
    accent: '#e85d2a', text: '#1a0800', highlight: '#e85d2a',
    logoBg: '#e85d2a', logoText: '#ffffff',
    tone: 'tip',
  },
]

export function detectTone(hook: string): TemplateTone {
  if (/perd|vermelho|erro|falh|quebr|sumiu|agora|urgente|\d+%|2x|3x|4x|5x/i.test(hook))
    return 'urgency'
  if (/dobr|tripl|lucr|fatur|vend|ganh|aument/i.test(hook))
    return 'energy'
  if (/como|dica|tátic|passo|segredo|aprend/i.test(hook))
    return 'tip'
  if (/cliente|sócio|funcionário|história|minha|meu|eu|caso/i.test(hook))
    return 'story'
  return 'calm'
}

export function chooseTemplates(hook: string): Template[] {
  const tone = detectTone(hook)
  const byTone = TEMPLATES.filter((t) => t.tone === tone)
  const rest = TEMPLATES.filter((t) => t.tone !== tone)
  const pool = [...byTone, ...rest]
  return [pool[0], pool[1] ?? rest[0], pool[2] ?? TEMPLATES[2]]
}

export function extractNumber(hook: string): string | null {
  const m = hook.match(/\d+[x%]?/)
  return m ? m[0] : null
}
