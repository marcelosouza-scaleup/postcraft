import { useEffect, useRef } from 'react'
import { drawFrame, getTotalFrames } from '@/lib/videoRenderer'
import type { VideoConfig } from '@/types'

interface Props {
  videoConfig: VideoConfig
  onChange: (cfg: VideoConfig) => void
}

export function VideoEditor({ videoConfig, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const bgVideoRef = useRef<HTMLVideoElement | null>(null)
  const bgVideo2Ref = useRef<HTMLVideoElement | null>(null)

  function makeVideoEl(url: string): HTMLVideoElement {
    const v = document.createElement('video')
    v.src = url
    v.crossOrigin = 'anonymous'
    v.muted = true
    v.loop = true
    v.playsInline = true
    v.preload = 'auto'
    v.play().catch(() => {})
    return v
  }

  useEffect(() => {
    const url = videoConfig.backgroundVideoUrl
    if (!url) { bgVideoRef.current = null; return }
    const v = makeVideoEl(url)
    bgVideoRef.current = v
    return () => { v.pause(); v.removeAttribute('src'); v.load(); bgVideoRef.current = null }
  }, [videoConfig.backgroundVideoUrl])

  useEffect(() => {
    const url = videoConfig.backgroundVideoUrl2
    if (!url) { bgVideo2Ref.current = null; return }
    const v = makeVideoEl(url)
    bgVideo2Ref.current = v
    return () => { v.pause(); v.removeAttribute('src'); v.load(); bgVideo2Ref.current = null }
  }, [videoConfig.backgroundVideoUrl2])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const total = getTotalFrames(videoConfig)
    const msPerFrame = 1000 / videoConfig.fps

    function tick(ts: number) {
      if (ts - lastTimeRef.current >= msPerFrame) {
        drawFrame(
          ctx,
          videoConfig,
          frameRef.current % Math.max(1, total),
          total,
          bgVideoRef.current ?? undefined,
          bgVideo2Ref.current ?? undefined,
        )
        frameRef.current++
        lastTimeRef.current = ts
      }
      animRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = 0
    lastTimeRef.current = 0
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [videoConfig])

  function updatePhase(id: string, patch: Partial<{ durationSeconds: number; enabled: boolean }>) {
    onChange({
      ...videoConfig,
      phases: videoConfig.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })
  }

  function updatePoint(i: number, text: string) {
    const points = videoConfig.points.map((pt, idx) => (idx === i ? { ...pt, text } : pt))
    onChange({ ...videoConfig, points })
  }

  function addPoint() {
    if (videoConfig.points.length >= 5) return
    onChange({ ...videoConfig, points: [...videoConfig.points, { text: '' }] })
  }

  function removePoint(i: number) {
    onChange({ ...videoConfig, points: videoConfig.points.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-6">
      {/* Live preview */}
      <div className="shrink-0">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
          Pré-visualização
        </p>
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="rounded-xl border border-neutral-200 shadow-sm"
          style={{ width: 270, height: 480 }}
        />
      </div>

      {/* Controls */}
      <div className="space-y-5 min-w-0">
        {/* Style */}
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
            Estilo do vídeo
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                { id: 'points',   label: '① Pontos',    desc: 'números animados' },
                { id: 'carousel', label: '◎ Carrossel', desc: 'uma frase por vez' },
                { id: 'bullets',  label: '• Bullets',   desc: 'lista com ponto' },
                { id: 'headline', label: 'H1 Headline', desc: 'hook gigante' },
                { id: 'stats',    label: '% Stats',     desc: 'número em destaque' },
              ] as const
            ).map((s) => {
              const active = (videoConfig.style ?? 'points') === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ ...videoConfig, style: s.id })}
                  title={s.desc}
                  className={
                    'px-3 py-1.5 rounded-md text-xs font-mono border transition ' +
                    (active
                      ? 'border-orange-400 bg-orange-50 text-orange-600'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300')
                  }
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Phases */}
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
            Fases
          </p>
          <div className="space-y-2">
            {videoConfig.phases.map((phase) => (
              <div key={phase.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`phase-${phase.id}`}
                  checked={phase.enabled}
                  onChange={(e) => updatePhase(phase.id, { enabled: e.target.checked })}
                  className="accent-orange-600"
                />
                <label htmlFor={`phase-${phase.id}`} className="text-sm text-neutral-700 flex-1">
                  {phase.label}
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={phase.durationSeconds}
                  onChange={(e) => updatePhase(phase.id, { durationSeconds: Number(e.target.value) || 1 })}
                  className="w-16 border border-neutral-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-xs text-neutral-400">s</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hook */}
        <div>
          <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide block mb-1">
            Hook
          </label>
          <textarea
            value={videoConfig.hook}
            onChange={(e) => onChange({ ...videoConfig, hook: e.target.value })}
            rows={2}
            className="w-full border border-neutral-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        {/* Points */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
              Pontos
            </label>
            <button
              onClick={addPoint}
              disabled={videoConfig.points.length >= 5}
              className="text-xs text-orange-600 hover:text-orange-700 disabled:opacity-40 font-semibold"
            >
              + Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {videoConfig.points.map((pt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 w-4 shrink-0">{i + 1}.</span>
                <input
                  value={pt.text}
                  onChange={(e) => updatePoint(i, e.target.value)}
                  className="flex-1 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={() => removePoint(i)}
                  className="text-neutral-300 hover:text-red-500 transition text-sm"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div>
          <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide block mb-1">
            CTA
          </label>
          <input
            value={videoConfig.cta}
            onChange={(e) => onChange({ ...videoConfig, cta: e.target.value })}
            className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* FPS + Handle */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide block mb-1">
              FPS
            </label>
            <select
              value={videoConfig.fps}
              onChange={(e) => onChange({ ...videoConfig, fps: Number(e.target.value) as 24 | 30 })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide block mb-1">
              Handle
            </label>
            <input
              value={videoConfig.handle}
              onChange={(e) => onChange({ ...videoConfig, handle: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
