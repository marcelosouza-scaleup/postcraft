import type { VideoConfig, Template, VideoPoint } from '../types'
import { TEMPLATES } from './templates'

const HL_PATTERNS = [
  /\d+[x%]?/i,
  /perd/i,
  /agora/i,
  /dobr/i,
  /lucr/i,
  /erro/i,
  /nunca/i,
  /hoje/i,
  /vermelho/i,
  /sumiu/i,
]

function easeOut(t: number) {
  return 1 - (1 - Math.min(1, t)) ** 2
}

export function getTotalFrames(cfg: VideoConfig): number {
  return cfg.phases
    .filter((p) => p.enabled)
    .reduce((a, p) => a + Math.round(p.durationSeconds * cfg.fps), 0)
}

export function getTotalSeconds(cfg: VideoConfig): number {
  return cfg.phases.filter((p) => p.enabled).reduce((a, p) => a + p.durationSeconds, 0)
}

export function getTransitionFrame(cfg: VideoConfig): number {
  const enabledPhases = cfg.phases.filter((p) => p.enabled)
  let acc = 0
  for (const phase of enabledPhases) {
    if (phase.id === 'points') return acc
    acc += Math.round(phase.durationSeconds * cfg.fps)
  }
  return Math.floor(getTotalFrames(cfg) / 2)
}

function drawVideoBackground(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | undefined,
  tmpl: Template,
  W: number,
  H: number,
) {
  if (!video || video.readyState < 2) {
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, tmpl.bg1)
    grad.addColorStop(1, tmpl.bg2)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    return
  }
  const vw = video.videoWidth || W
  const vh = video.videoHeight || H
  const scale = Math.max(W / vw, H / vh)
  const sw = vw * scale
  const sh = vh * scale
  ctx.drawImage(video, (W - sw) / 2, (H - sh) / 2, sw, sh)

  const overlay = ctx.createLinearGradient(0, 0, 0, H)
  overlay.addColorStop(0, 'rgba(0,0,0,0.65)')
  overlay.addColorStop(0.4, 'rgba(0,0,0,0.50)')
  overlay.addColorStop(0.7, 'rgba(0,0,0,0.55)')
  overlay.addColorStop(1, 'rgba(0,0,0,0.75)')
  ctx.fillStyle = overlay
  ctx.fillRect(0, 0, W, H)
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  cfg: VideoConfig,
  frameIndex: number,
  totalFrames: number,
  bgVideo1?: HTMLVideoElement,
  bgVideo2?: HTMLVideoElement,
) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const baseTmpl: Template = TEMPLATES.find((t) => t.id === cfg.templateId) ?? TEMPLATES[0]

  const hasAnyVideo = !!(bgVideo1 || bgVideo2)
  const effectiveTmpl: Template = hasAnyVideo
    ? { ...baseTmpl, text: '#ffffff', highlight: '#ff6b35', logoBg: '#ff6b35', logoText: '#ffffff' }
    : baseTmpl

  if (!hasAnyVideo) {
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, baseTmpl.bg1)
    grad.addColorStop(1, baseTmpl.bg2)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    drawFrameContent(ctx, cfg, frameIndex, totalFrames, effectiveTmpl, false, W, H)
    return
  }

  // Se há apenas 1 vídeo ou nenhum vídeo2, comportamento original
  if (!bgVideo2 || !cfg.backgroundVideoUrl2) {
    drawVideoBackground(ctx, bgVideo1, baseTmpl, W, H)
    drawFrameContent(ctx, cfg, frameIndex, totalFrames, effectiveTmpl, true, W, H)
    return
  }

  const transition = cfg.transition ?? { type: 'fade', durationSeconds: 0.5 }
  const transitionFrame = getTransitionFrame(cfg)
  const transitionFrames = Math.max(1, Math.round(transition.durationSeconds * cfg.fps))

  const inTransition = frameIndex >= transitionFrame && frameIndex < transitionFrame + transitionFrames
  const afterTransition = frameIndex >= transitionFrame + transitionFrames
  const transProgress = inTransition
    ? (frameIndex - transitionFrame) / transitionFrames
    : afterTransition ? 1 : 0
  // easeInOutQuad
  const eased = transProgress < 0.5
    ? 2 * transProgress * transProgress
    : 1 - Math.pow(-2 * transProgress + 2, 2) / 2

  const activeVideo = afterTransition ? bgVideo2 : bgVideo1

  if (transition.type === 'cut') {
    drawVideoBackground(ctx, frameIndex >= transitionFrame ? bgVideo2 : bgVideo1, baseTmpl, W, H)

  } else if (transition.type === 'fade') {
    if (inTransition) {
      if (eased < 0.5) {
        drawVideoBackground(ctx, bgVideo1, baseTmpl, W, H)
        ctx.fillStyle = `rgba(0,0,0,${eased * 2})`
        ctx.fillRect(0, 0, W, H)
      } else {
        drawVideoBackground(ctx, bgVideo2, baseTmpl, W, H)
        ctx.fillStyle = `rgba(0,0,0,${(1 - eased) * 2})`
        ctx.fillRect(0, 0, W, H)
      }
    } else {
      drawVideoBackground(ctx, activeVideo, baseTmpl, W, H)
    }

  } else if (transition.type === 'crossfade') {
    if (inTransition) {
      ctx.save()
      ctx.globalAlpha = 1 - eased
      drawVideoBackground(ctx, bgVideo1, baseTmpl, W, H)
      ctx.restore()
      ctx.save()
      ctx.globalAlpha = eased
      drawVideoBackground(ctx, bgVideo2, baseTmpl, W, H)
      ctx.restore()
    } else {
      drawVideoBackground(ctx, activeVideo, baseTmpl, W, H)
    }

  } else if (transition.type === 'wipe-left') {
    if (inTransition) {
      drawVideoBackground(ctx, bgVideo1, baseTmpl, W, H)
      const wipeX = W * (1 - eased)
      ctx.save()
      ctx.beginPath()
      ctx.rect(wipeX, 0, W, H)
      ctx.clip()
      drawVideoBackground(ctx, bgVideo2, baseTmpl, W, H)
      ctx.restore()
      ctx.fillStyle = 'rgba(255,107,53,0.8)'
      ctx.fillRect(wipeX - 2, 0, 4, H)
    } else {
      drawVideoBackground(ctx, activeVideo, baseTmpl, W, H)
    }

  } else if (transition.type === 'zoom') {
    if (inTransition) {
      if (eased < 0.5) {
        const scale = 1 + eased * 0.3
        ctx.save()
        ctx.translate(W / 2, H / 2)
        ctx.scale(scale, scale)
        ctx.translate(-W / 2, -H / 2)
        drawVideoBackground(ctx, bgVideo1, baseTmpl, W, H)
        ctx.restore()
        ctx.fillStyle = `rgba(0,0,0,${eased * 1.5})`
        ctx.fillRect(0, 0, W, H)
      } else {
        const scale = 1.3 - eased * 0.3
        ctx.save()
        ctx.translate(W / 2, H / 2)
        ctx.scale(scale, scale)
        ctx.translate(-W / 2, -H / 2)
        drawVideoBackground(ctx, bgVideo2, baseTmpl, W, H)
        ctx.restore()
        ctx.fillStyle = `rgba(0,0,0,${(1 - eased) * 1.5})`
        ctx.fillRect(0, 0, W, H)
      }
    } else {
      drawVideoBackground(ctx, activeVideo, baseTmpl, W, H)
    }

  } else {
    drawVideoBackground(ctx, activeVideo, baseTmpl, W, H)
  }

  drawFrameContent(ctx, cfg, frameIndex, totalFrames, effectiveTmpl, true, W, H)
}

function drawFrameContent(
  ctx: CanvasRenderingContext2D,
  cfg: VideoConfig,
  frameIndex: number,
  totalFrames: number,
  tmpl: Template,
  hasVideoBg: boolean,
  W: number,
  H: number,
) {
  const s = W / 1080 // scale factor relative to reference 1080-wide canvas

  // Background particles — desabilitadas com vídeo (já tem muito movimento)
  if (!hasVideoBg) {
    ctx.save()
    ctx.globalAlpha = 0.04
    ctx.fillStyle = tmpl.accent
    for (let i = 0; i < 10; i++) {
      const px = (i * W * 0.13 + frameIndex * 0.4) % W
      const py = (i * H * 0.11 + frameIndex * 0.25) % H
      ctx.beginPath()
      ctx.arc(px, py, (80 + i * 30) * s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Progress bar at top
  ctx.fillStyle = tmpl.accent
  ctx.fillRect(0, 0, W * (frameIndex / totalFrames), 8 * s)

  // Determine current phase
  const enabledPhases = cfg.phases.filter((p) => p.enabled)
  const fpsList = enabledPhases.map((p) => Math.round(p.durationSeconds * cfg.fps))
  const totalF = fpsList.reduce((a, b) => a + b, 0)
  const f = frameIndex % Math.max(1, totalF)

  let acc = 0
  let phaseId = enabledPhases[0]?.id ?? 'hook'
  let phaseProgress = 0
  for (let i = 0; i < enabledPhases.length; i++) {
    if (f < acc + fpsList[i]) {
      phaseId = enabledPhases[i].id
      phaseProgress = fpsList[i] > 0 ? (f - acc) / fpsList[i] : 1
      break
    }
    acc += fpsList[i]
  }

  if (phaseId === 'logo') {
    drawLogoPhase(ctx, tmpl, phaseProgress, cfg.handle, W, H)
  } else if (phaseId === 'hook') {
    drawLogoSmall(ctx, tmpl, W)
    drawHookPhase(ctx, tmpl, cfg.hook, phaseProgress, W, H)
  } else if (phaseId === 'points') {
    drawLogoSmall(ctx, tmpl, W)
    const style = cfg.style ?? 'points'
    if (style === 'carousel') {
      drawCarouselPhase(ctx, tmpl, cfg.points, phaseProgress, W, H)
    } else if (style === 'bullets') {
      drawBulletsPhase(ctx, tmpl, cfg.points, phaseProgress, W, H)
    } else if (style === 'headline') {
      drawHeadlinePhase(ctx, tmpl, cfg.hook, phaseProgress, W, H)
    } else if (style === 'stats') {
      drawStatsPhase(ctx, tmpl, cfg.hook, phaseProgress, W, H)
    } else {
      drawPointsPhase(ctx, tmpl, cfg.points, phaseProgress, W, H)
    }
  } else if (phaseId === 'cta') {
    drawCtaPhase(ctx, tmpl, cfg.cta, cfg.handle, phaseProgress, W, H)
  }

  // Footer bar
  ctx.fillStyle = tmpl.accent
  ctx.fillRect(0, H - 8 * s, W, 8 * s)
}

function drawLogoSmall(ctx: CanvasRenderingContext2D, tmpl: Template, W: number) {
  const s = W / 1080
  const r = 80 * s
  ctx.fillStyle = tmpl.logoBg
  ctx.beginPath()
  ctx.arc(120 * s, 130 * s, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = tmpl.logoText
  ctx.font = `bold ${66 * s}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('n.', 120 * s, 134 * s)
}

function drawLogoPhase(
  ctx: CanvasRenderingContext2D,
  tmpl: Template,
  progress: number,
  handle: string,
  W: number,
  H: number,
) {
  const sc = W / 1080
  const s = easeOut(Math.min(progress * 2, 1))
  const r = 180 * s * sc
  ctx.save()
  ctx.globalAlpha = s
  ctx.fillStyle = tmpl.logoBg
  ctx.beginPath()
  ctx.arc(W / 2, H / 2 - 80 * sc, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = tmpl.logoText
  ctx.font = `bold ${Math.floor(r * 0.55)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('n.', W / 2, H / 2 - 78 * sc)
  if (progress > 0.5) {
    const s2 = easeOut((progress - 0.5) * 2)
    ctx.globalAlpha = s2 * 0.6
    ctx.fillStyle = tmpl.text
    ctx.font = `${Math.floor(W * 0.05)}px Inter, system-ui, sans-serif`
    ctx.fillText(handle || '@postcraft', W / 2, H / 2 + 140 * sc)
  }
  ctx.restore()
}

function drawHookPhase(
  ctx: CanvasRenderingContext2D,
  tmpl: Template,
  hook: string,
  progress: number,
  W: number,
  H: number,
) {
  const sc = W / 1080
  const words = hook.split(' ')
  const totalWords = words.length
  if (totalWords === 0) return

  // Each word gets its own slice of the phase timeline.
  // Entry animation runs over the first 40% of that slice; afterwards the
  // word stays fully visible until the phase ends.
  const timePerWord = 1 / totalWords
  const entryWindow = timePerWord * 0.4

  const fsBase = hook.length < 25 ? 120 : hook.length < 40 ? 96 : 80
  const fs = fsBase * sc
  ctx.font = `bold ${fs}px Inter, system-ui, sans-serif`

  // Break into lines
  const maxW = W * 0.82
  const lines: string[][] = []
  let cur: string[] = []
  for (const w of words) {
    if (ctx.measureText([...cur, w].join(' ')).width > maxW && cur.length) {
      lines.push(cur)
      cur = [w]
    } else {
      cur.push(w)
    }
  }
  if (cur.length) lines.push(cur)

  const lh = fs * 1.3
  const totalH = lines.length * lh
  let y = (H - totalH) / 2
  let wordIndex = 0

  lines.forEach((lineWords) => {
    const lineText = lineWords.join(' ')
    const lineW = ctx.measureText(lineText).width
    let x = (W - lineW) / 2

    lineWords.forEach((word) => {
      const wordStart = wordIndex * timePerWord
      const wordProgress = Math.max(
        0,
        Math.min(1, (progress - wordStart) / entryWindow),
      )

      if (wordProgress > 0) {
        // easeInOutCubic — snappy entry that settles cleanly
        const t = wordProgress
        const eased =
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

        const alpha = eased
        const yOff = (1 - eased) * 28 * sc // drops in from above
        const scale = 0.85 + eased * 0.15 // starts at 85% size

        const isHL = HL_PATTERNS.some((p) => p.test(word))

        ctx.save()
        ctx.globalAlpha = alpha

        // Scale around the word's center
        const wW = ctx.measureText(word).width
        ctx.translate(x + wW / 2, y + yOff + fs / 2)
        ctx.scale(scale, scale)
        ctx.translate(-(x + wW / 2), -(y + yOff + fs / 2))

        ctx.fillStyle = isHL ? tmpl.highlight : tmpl.text
        ctx.font = `bold ${isHL ? Math.floor(fs * 1.08) : fs}px Inter, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(word, x, y + yOff)
        ctx.restore()
      }

      x += ctx.measureText(word + ' ').width
      wordIndex++
    })
    y += lh
  })
}

function drawPointsPhase(
  ctx: CanvasRenderingContext2D,
  tmpl: Template,
  points: VideoPoint[],
  progress: number,
  W: number,
  H: number,
) {
  const sc = W / 1080
  const visible = Math.min(points.length, Math.ceil(progress * (points.length + 0.5)))
  const fs = 60 * sc
  const startY = H * 0.32

  points.slice(0, visible).forEach((pt, i) => {
    const ptProgress = easeOut(Math.min(1, progress * (points.length + 1) - i))
    if (ptProgress <= 0) return
    const y = startY + i * (H * 0.14)

    ctx.save()
    ctx.globalAlpha = ptProgress
    const xOff = (1 - ptProgress) * 60 * sc

    ctx.fillStyle = tmpl.accent
    ctx.beginPath()
    ctx.arc(140 * sc - xOff, y, 55 * sc, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = tmpl.logoBg === '#ffffff' ? tmpl.bg1 : '#fff'
    ctx.font = `bold ${52 * sc}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), 140 * sc - xOff, y + 2 * sc)

    ctx.fillStyle = tmpl.text
    ctx.font = `${fs}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const maxW = W * 0.72
    const full = pt.text
    if (ctx.measureText(full).width > maxW) {
      const mid = full.lastIndexOf(' ', Math.floor(full.length * 0.55))
      ctx.fillText(full.slice(0, mid), 225 * sc - xOff, y - 30 * sc)
      ctx.globalAlpha = ptProgress * 0.85
      ctx.fillText(full.slice(mid + 1), 225 * sc - xOff, y + 34 * sc)
    } else {
      ctx.fillText(full, 225 * sc - xOff, y)
    }
    ctx.restore()
  })
}

function drawCarouselPhase(
  ctx: CanvasRenderingContext2D,
  tmpl: Template,
  points: VideoPoint[],
  progress: number,
  W: number,
  H: number,
) {
  if (!points.length) return
  const sc = W / 1080
  const total = points.length
  const idx = Math.min(total - 1, Math.floor(progress * total))
  const localProgress = (progress * total) % 1
  const s = easeOut(Math.min(localProgress * 3, 1))
  const point = points[idx]
  if (!point) return

  ctx.save()
  ctx.globalAlpha = s
  ctx.fillStyle = tmpl.text
  const fs = Math.floor(W * 0.085)
  ctx.font = `bold ${fs}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const words = point.text.split(' ')
  const maxW = W * 0.8
  const lines: string[][] = []
  let cur: string[] = []
  for (const w of words) {
    if (ctx.measureText([...cur, w].join(' ')).width > maxW && cur.length) {
      lines.push(cur)
      cur = [w]
    } else {
      cur.push(w)
    }
  }
  if (cur.length) lines.push(cur)

  const lh = fs * 1.3
  let y = H / 2 - (lines.length * lh) / 2
  lines.forEach((lw) => {
    ctx.fillText(lw.join(' '), W / 2, y)
    y += lh
  })

  // Indicator dots
  const dotY = H * 0.72
  const dotSpacing = 40 * sc
  const startX = W / 2 - ((total - 1) * dotSpacing) / 2
  points.forEach((_, i) => {
    ctx.fillStyle = i === idx ? tmpl.highlight : 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.arc(startX + i * dotSpacing, dotY, (i === idx ? 8 : 5) * sc, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}

function drawBulletsPhase(
  ctx: CanvasRenderingContext2D,
  tmpl: Template,
  points: VideoPoint[],
  progress: number,
  W: number,
  H: number,
) {
  if (!points.length) return
  const visible = Math.min(points.length, Math.ceil(progress * (points.length + 0.5)))
  const fs = Math.floor(W * 0.065)
  const startY = H * 0.35

  points.slice(0, visible).forEach((pt, i) => {
    const ptProgress = easeOut(Math.min(1, progress * (points.length + 1) - i))
    if (ptProgress <= 0) return
    const y = startY + i * (H * 0.13)

    ctx.save()
    ctx.globalAlpha = ptProgress

    ctx.fillStyle = tmpl.highlight
    ctx.font = `bold ${Math.floor(W * 0.08)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('•', W * 0.08, y)

    ctx.fillStyle = tmpl.text
    ctx.font = `${fs}px Inter, system-ui, sans-serif`
    const maxW = W * 0.78
    let label = pt.text
    if (ctx.measureText(label).width > maxW) {
      while (label.length > 4 && ctx.measureText(label + '…').width > maxW) {
        label = label.slice(0, -1)
      }
      label = label.trimEnd() + '…'
    }
    ctx.fillText(label, W * 0.16, y)
    ctx.restore()
  })
}

function drawHeadlinePhase(
  ctx: CanvasRenderingContext2D,
  tmpl: Template,
  hook: string,
  progress: number,
  W: number,
  H: number,
) {
  if (!hook) return
  const s = easeOut(progress)
  const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.02
  const fs = hook.length < 20 ? Math.floor(W * 0.14) : Math.floor(W * 0.1)

  ctx.save()
  ctx.globalAlpha = s
  ctx.translate(W / 2, H / 2)
  ctx.scale(pulse, pulse)
  ctx.translate(-W / 2, -H / 2)

  ctx.font = `bold ${fs}px Inter, system-ui, sans-serif`
  const words = hook.split(' ')
  const maxW = W * 0.85
  const lines: string[][] = []
  let cur: string[] = []
  for (const w of words) {
    if (ctx.measureText([...cur, w].join(' ')).width > maxW && cur.length) {
      lines.push(cur)
      cur = [w]
    } else {
      cur.push(w)
    }
  }
  if (cur.length) lines.push(cur)

  const lh = fs * 1.25
  let y = H / 2 - (lines.length * lh) / 2
  lines.forEach((lw, li) => {
    const isLast = li === lines.length - 1
    ctx.fillStyle = isLast ? tmpl.highlight : tmpl.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(lw.join(' '), W / 2, y)
    y += lh
  })
  ctx.restore()
}

function drawStatsPhase(
  ctx: CanvasRenderingContext2D,
  tmpl: Template,
  hook: string,
  progress: number,
  W: number,
  H: number,
) {
  const s = easeOut(progress)
  const numMatch = hook.match(/\d+[x%]?|\d+/)
  const bigNum = numMatch ? numMatch[0] : '3x'
  const rest = hook.replace(bigNum, '').trim()

  ctx.save()
  ctx.globalAlpha = s

  const numFs = Math.floor(W * 0.35)
  ctx.font = `bold ${numFs}px Inter, system-ui, sans-serif`
  ctx.fillStyle = tmpl.highlight
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(bigNum, W / 2, H * 0.42)

  ctx.font = `${Math.floor(W * 0.065)}px Inter, system-ui, sans-serif`
  ctx.fillStyle = tmpl.text
  ctx.globalAlpha = s * 0.85
  ctx.fillText(rest, W / 2, H * 0.62)
  ctx.restore()
}

function drawCtaPhase(
  ctx: CanvasRenderingContext2D,
  tmpl: Template,
  cta: string,
  handle: string,
  progress: number,
  W: number,
  H: number,
) {
  const sc = W / 1080
  const s = easeOut(progress)
  ctx.save()
  ctx.globalAlpha = s * 0.1
  ctx.fillStyle = tmpl.accent
  ctx.beginPath()
  ctx.arc(W / 2, H * 0.42, W * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = s
  const lines = cta.split('\n').filter(Boolean)
  const fs = 72 * sc
  ctx.font = `bold ${fs}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = tmpl.text

  if (lines.length === 1) {
    const maxW = W * 0.8
    if (ctx.measureText(cta).width > maxW) {
      const mid = cta.lastIndexOf(' ', Math.floor(cta.length * 0.5))
      ctx.fillText(cta.slice(0, mid), W / 2, H * 0.38)
      ctx.fillStyle = tmpl.highlight
      ctx.fillText(cta.slice(mid + 1), W / 2, H * 0.38 + fs * 1.3)
    } else {
      ctx.fillText(cta, W / 2, H * 0.38)
    }
  } else {
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 1 ? tmpl.highlight : tmpl.text
      ctx.fillText(line, W / 2, H * 0.36 + i * (fs * 1.4))
    })
  }

  ctx.fillStyle = tmpl.logoBg
  ctx.beginPath()
  ctx.arc(W / 2, H * 0.62, 100 * sc, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = tmpl.logoText
  ctx.font = `bold ${86 * sc}px Inter, system-ui, sans-serif`
  ctx.fillText('n.', W / 2, H * 0.622)

  ctx.fillStyle = tmpl.text
  ctx.globalAlpha = s * 0.55
  ctx.font = `${Math.floor(W * 0.048)}px Inter, system-ui, sans-serif`
  ctx.fillText(handle || '@postcraft', W / 2, H * 0.73)
  ctx.restore()
}
