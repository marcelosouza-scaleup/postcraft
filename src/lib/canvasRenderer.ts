import type { Template, LayoutId, ElementId, FormatId } from '../types'

const HIGHLIGHT_PATTERNS = [
  /\d+[x%]?/i, /perd/i, /vermelho/i, /sumiu/i, /dobr/i,
  /agora/i, /noite/i, /mais/i, /nunca/i, /sempre/i, /hoje/i,
]

function drawBackground(ctx: CanvasRenderingContext2D, tmpl: Template, W: number, H: number) {
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, tmpl.bg1)
  grad.addColorStop(1, tmpl.bg2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
}

function drawAccentBars(ctx: CanvasRenderingContext2D, tmpl: Template, W: number, H: number) {
  const barH = Math.max(3, Math.floor(H * 0.007))
  ctx.fillStyle = tmpl.accent
  ctx.fillRect(0, 0, W, barH)
  ctx.fillRect(0, H - barH, W, barH)
}

function drawLogo(ctx: CanvasRenderingContext2D, tmpl: Template, W: number, H: number) {
  const r = Math.floor(W * 0.075)
  const x = r + W * 0.04
  const y = r + H * 0.04
  ctx.fillStyle = tmpl.logoBg
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = tmpl.logoText
  ctx.font = `bold ${Math.floor(r * 0.85)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('n.', x, y + r * 0.06)
}

function drawHandle(ctx: CanvasRenderingContext2D, tmpl: Template, W: number, H: number, handle: string) {
  ctx.fillStyle = tmpl.text
  ctx.globalAlpha = 0.35
  ctx.font = `${Math.floor(W * 0.042)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(handle || '@postcraft', W / 2, H - H * 0.03)
  ctx.globalAlpha = 1
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  elId: ElementId,
  tmpl: Template,
  W: number,
  H: number,
  numberText: string | null,
) {
  ctx.save()
  if (elId === 'number' && numberText) {
    ctx.globalAlpha = 0.08
    ctx.fillStyle = tmpl.highlight
    const nfs = Math.floor(W * 0.55)
    ctx.font = `bold ${nfs}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(numberText, W * 0.65, H * 0.55)
  } else if (elId === 'lines') {
    ctx.globalAlpha = 0.08
    ctx.strokeStyle = tmpl.accent
    ctx.lineWidth = 1.5
    for (let i = 0; i < 14; i++) {
      ctx.beginPath()
      ctx.moveTo(0, i * H / 10)
      ctx.lineTo(W, i * H / 10 + H * 0.1)
      ctx.stroke()
    }
  } else if (elId === 'dots') {
    ctx.globalAlpha = 0.15
    ctx.fillStyle = tmpl.accent
    for (let x = W * 0.1; x < W; x += W * 0.12)
      for (let y = H * 0.1; y < H; y += H * 0.12) {
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
  } else if (elId === 'circle') {
    ctx.globalAlpha = 0.08
    ctx.strokeStyle = tmpl.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(W * 0.75, H * 0.25, W * 0.42, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(W * 0.75, H * 0.25, W * 0.27, 0, Math.PI * 2)
    ctx.stroke()
  } else if (elId === 'grid') {
    ctx.globalAlpha = 0.07
    ctx.strokeStyle = tmpl.accent
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += W * 0.12) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = 0; y < H; y += H * 0.12) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
  } else if (elId === 'corner') {
    ctx.globalAlpha = 0.12
    ctx.fillStyle = tmpl.accent
    ctx.beginPath()
    ctx.moveTo(W, 0); ctx.lineTo(W, H * 0.35); ctx.lineTo(W * 0.65, 0)
    ctx.closePath(); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, H); ctx.lineTo(0, H * 0.65); ctx.lineTo(W * 0.35, H)
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}

function drawText(
  ctx: CanvasRenderingContext2D,
  hook: string,
  layout: LayoutId,
  tmpl: Template,
  W: number,
  H: number,
) {
  const words = hook.split(' ')

  if (layout === 'bold-single') {
    const bigWord = words.reduce((a, b) =>
      b.replace(/[^a-záéíóúâêôãõç]/gi, '').length >
      a.replace(/[^a-záéíóúâêôãõç]/gi, '').length ? b : a, '')
    const bfs = Math.floor(W * 0.19)
    ctx.font = `bold ${bfs}px Inter, system-ui, sans-serif`
    ctx.fillStyle = tmpl.highlight
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(bigWord.toUpperCase(), W / 2, H / 2 - bfs * 0.3)
    const rest = words.filter((w) => w !== bigWord).join(' ')
    ctx.font = `bold ${Math.floor(W * 0.055)}px Inter, system-ui, sans-serif`
    ctx.fillStyle = tmpl.text
    ctx.globalAlpha = 0.85
    ctx.fillText(rest, W / 2, H / 2 + bfs * 0.55)
    ctx.globalAlpha = 1
    return
  }

  const isLeft = layout === 'left'
  const fs = Math.floor(W * 0.1)
  ctx.font = `bold ${fs}px Inter, system-ui, sans-serif`
  const maxW = W * (isLeft ? 0.8 : 0.86)

  const lines: string[][] = []
  let cur: string[] = []
  for (const w of words) {
    if (ctx.measureText([...cur, w].join(' ')).width > maxW && cur.length > 0) {
      lines.push(cur); cur = [w]
    } else {
      cur.push(w)
    }
  }
  if (cur.length) lines.push(cur)

  const lh = fs * 1.28
  const totalH = lines.length * lh
  let y = (H - totalH) / 2

  lines.forEach((lineWords, li) => {
    const lineText = lineWords.join(' ')
    const lineW = ctx.measureText(lineText).width
    let x = isLeft ? W * 0.08 : (W - lineW) / 2

    lineWords.forEach((word, wi) => {
      const isLast = li === lines.length - 1 && wi === lineWords.length - 1
      const isHL = isLast || HIGHLIGHT_PATTERNS.some((p) => p.test(word))
      ctx.fillStyle = isHL ? tmpl.highlight : tmpl.text
      ctx.font = `bold ${fs}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(word, x, y)
      x += ctx.measureText(word + ' ').width
    })
    y += lh
  })
}

export function renderToCanvas(
  canvas: HTMLCanvasElement,
  tmpl: Template,
  layout: LayoutId,
  element: ElementId,
  hook: string,
  format: FormatId,
  handle?: string,
): void {
  const W = 1080
  const H = format === 'story' ? 1920 : 1080
  canvas.width = W
  canvas.height = H

  const ctx = canvas.getContext('2d')!
  const numText = hook.match(/\d+[x%]?/)?.[0] ?? null

  drawBackground(ctx, tmpl, W, H)
  drawElement(ctx, element, tmpl, W, H, numText)
  drawAccentBars(ctx, tmpl, W, H)
  drawLogo(ctx, tmpl, W, H)
  drawText(ctx, hook, layout, tmpl, W, H)
  drawHandle(ctx, tmpl, W, H, handle ?? '@postcraft')
}

export function renderToDataUrl(
  tmpl: Template,
  layout: LayoutId,
  element: ElementId,
  hook: string,
  format: FormatId,
  handle?: string,
): string {
  const canvas = document.createElement('canvas')
  renderToCanvas(canvas, tmpl, layout, element, hook, format, handle)
  return canvas.toDataURL('image/jpeg', 0.95)
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function renderToDataUrlWithBg(
  tmpl: Template,
  layout: LayoutId,
  element: ElementId,
  hook: string,
  format: FormatId,
  handle: string | undefined,
  bgImageUrl?: string,
): Promise<string> {
  const W = 1080
  const H = format === 'story' ? 1920 : 1080
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const numText = hook.match(/\d+[x%]?/)?.[0] ?? null

  const bgImg = bgImageUrl ? await loadImage(bgImageUrl) : null

  if (bgImg) {
    // Cover: preserva proporção e preenche o canvas
    const scale = Math.max(W / bgImg.width, H / bgImg.height)
    const sw = bgImg.width * scale
    const sh = bgImg.height * scale
    ctx.drawImage(bgImg, (W - sw) / 2, (H - sh) / 2, sw, sh)

    const overlay = ctx.createLinearGradient(0, 0, 0, H)
    overlay.addColorStop(0, 'rgba(0,0,0,0.55)')
    overlay.addColorStop(0.5, 'rgba(0,0,0,0.45)')
    overlay.addColorStop(1, 'rgba(0,0,0,0.70)')
    ctx.fillStyle = overlay
    ctx.fillRect(0, 0, W, H)

    const photoTmpl: Template = { ...tmpl, text: '#ffffff', highlight: '#ff6b35' }
    drawElement(ctx, element, photoTmpl, W, H, numText)
    drawAccentBars(ctx, photoTmpl, W, H)
    drawLogo(ctx, photoTmpl, W, H)
    drawText(ctx, hook, layout, photoTmpl, W, H)
    drawHandle(ctx, photoTmpl, W, H, handle ?? '@postcraft')
  } else {
    drawBackground(ctx, tmpl, W, H)
    drawElement(ctx, element, tmpl, W, H, numText)
    drawAccentBars(ctx, tmpl, W, H)
    drawLogo(ctx, tmpl, W, H)
    drawText(ctx, hook, layout, tmpl, W, H)
    drawHandle(ctx, tmpl, W, H, handle ?? '@postcraft')
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}
