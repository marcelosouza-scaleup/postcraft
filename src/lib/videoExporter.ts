import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { drawFrame, getTotalFrames, getTotalSeconds } from './videoRenderer'
import type { VideoConfig } from '../types'

// Vídeo 9:16 nativo (Reels/Stories/TikTok).
const VIDEO_WIDTH = 1080
const VIDEO_HEIGHT = 1920
const WEBM_BITRATE = 8_000_000
const OUTPUT_WIDTH = 540
const OUTPUT_HEIGHT = 960

// Limite de tamanho do arquivo final. Two-pass com bitrate alvo deixa o
// resultado bem próximo do alvo (precisão típica ±5%), e o retry com bitrate
// corrigido cobre o caso patológico em que o primeiro encode estoura.
const TARGET_SIZE_MB = 5
const TARGET_OUTPUT_BYTES = TARGET_SIZE_MB * 1024 * 1024
const MAX_OUTPUT_BYTES = (TARGET_SIZE_MB + 1) * 1024 * 1024
const MIN_BITRATE_KBPS = 400

async function convertToMp4(
  webmBlob: Blob,
  durationSeconds: number,
  fps: number,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const ffmpeg = new FFmpeg()

  await ffmpeg.load({
    coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm'),
  })

  // Pass 1: progresso 85-92. Pass 2: progresso 92-99.
  // Trackeamos qual passada estamos via contador de exec.
  let passCount = 0
  ffmpeg.on('progress', ({ progress, time }) => {
    const ratio = Number.isFinite(progress) && progress > 0
      ? progress
      : Number.isFinite(time) && durationSeconds > 0
        ? Math.min(time / durationSeconds, 1)
        : -1
    if (ratio < 0) return
    const base = passCount === 0 ? 85 : 92
    const range = 7
    onProgress(base + Math.round(ratio * range))
  })

  // Ticker simulado: avança o progresso lentamente (85→98) enquanto o FFmpeg
  // não reporta progresso real, para o usuário não ver travar.
  let simulatedPct = 85
  const ticker = setInterval(() => {
    if (simulatedPct < 98) {
      simulatedPct += 1
      onProgress(simulatedPct)
    }
  }, 800)

  try {
    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob))

    // Bitrate alvo calculado da duração: garante arquivo final ~TARGET_SIZE_MB
    // independente da complexidade do vídeo.
    const targetBitsPerSecond = Math.floor((TARGET_OUTPUT_BYTES * 8) / durationSeconds)
    const targetKbps = Math.max(MIN_BITRATE_KBPS, Math.floor(targetBitsPerSecond / 1000))

    // Flags de formato/playback que NÃO podem mudar (comprovadas em produção):
    //   -profile:v main -level 4.0
    //   -vf scale=W:H,fps=N,setsar=1:1
    //   -aspect 9:16 -brand mp42 -movflags +faststart
    //   -fps_mode cfr -vsync cfr -video_track_timescale 30000
    //   -r fps -g fps*2 -keyint_min fps
    //
    // Two-pass:
    //   pass 1 = análise (sem output, escreve stats em ffmpeg2pass-*.log)
    //   pass 2 = encode final usando os stats para distribuir bits de forma
    //            mais inteligente entre cenas estáticas e movimento.
    const pass1Args = (bitrateKbps: number, scaleW: number, scaleH: number) => [
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-b:v', `${bitrateKbps}k`,
      '-pass', '1',
      '-passlogfile', 'ffmpeg2pass',
      '-fps_mode', 'cfr',
      '-vsync', 'cfr',
      '-r', String(fps),
      '-vf', `scale=${scaleW}:${scaleH},fps=${fps},setsar=1:1`,
      '-f', 'null',
      '-an',
      '-y',
      '-',
    ]

    const pass2Args = (bitrateKbps: number, scaleW: number, scaleH: number) => [
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-b:v', `${bitrateKbps}k`,
      '-maxrate', `${Math.floor(bitrateKbps * 1.5)}k`,
      '-bufsize', `${bitrateKbps * 2}k`,
      '-pass', '2',
      '-passlogfile', 'ffmpeg2pass',
      '-profile:v', 'main',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p',
      '-fps_mode', 'cfr',
      '-vsync', 'cfr',
      '-r', String(fps),
      '-g', String(fps * 2),
      '-keyint_min', String(fps),
      '-vf', `scale=${scaleW}:${scaleH},fps=${fps},setsar=1:1`,
      '-aspect', '9:16',
      '-video_track_timescale', '30000',
      '-movflags', '+faststart',
      '-brand', 'mp42',
      '-an',
      '-y',
      'output.mp4',
    ]

    passCount = 0
    await ffmpeg.exec(pass1Args(targetKbps, OUTPUT_WIDTH, OUTPUT_HEIGHT))
    passCount = 1
    await ffmpeg.exec(pass2Args(targetKbps, OUTPUT_WIDTH, OUTPUT_HEIGHT))
    let data = await ffmpeg.readFile('output.mp4')
    let bytes = (data as Uint8Array).byteLength

    // Retry two-pass com bitrate proporcional ao excesso + downscale extra
    // se mesmo o primeiro two-pass estourar o limite. Raro, acontece em
    // vídeos longos com fundo de alto movimento.
    if (bytes > MAX_OUTPUT_BYTES) {
      const correctionFactor = (TARGET_OUTPUT_BYTES * 0.9) / bytes
      const retryKbps = Math.max(250, Math.floor(targetKbps * correctionFactor))
      passCount = 0
      await ffmpeg.exec(pass1Args(retryKbps, 480, 854))
      passCount = 1
      await ffmpeg.exec(pass2Args(retryKbps, 480, 854))
      data = await ffmpeg.readFile('output.mp4')
      bytes = (data as Uint8Array).byteLength
    }

    return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'video/mp4' })
  } finally {
    clearInterval(ticker)
    onProgress(100)
  }
}

function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'

    const timeout = setTimeout(() => reject(new Error('Timeout ao carregar vídeo')), 15000)

    video.oncanplaythrough = () => {
      clearTimeout(timeout)
      resolve(video)
    }
    video.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Erro ao carregar vídeo de fundo'))
    }

    video.src = url
    video.load()
  })
}

export async function exportVideo(
  cfg: VideoConfig,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  // Carregar vídeo de fundo (fora da Promise principal para usar await com
  // fallback silencioso em caso de erro).
  const [bgVideo1, bgVideo2] = await Promise.all([
    cfg.backgroundVideoUrl
      ? loadVideoElement(cfg.backgroundVideoUrl)
          .then((v) => { v.play().catch(() => {}); return v })
          .catch(() => undefined)
      : Promise.resolve(undefined),
    cfg.backgroundVideoUrl2
      ? loadVideoElement(cfg.backgroundVideoUrl2)
          .then((v) => { v.play().catch(() => {}); return v })
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ])

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = VIDEO_WIDTH
    canvas.height = VIDEO_HEIGHT
    const ctx = canvas.getContext('2d')!
    // Filtragem de alta qualidade para drawImage de vídeos. Padrão do canvas
    // é 'low' (bilinear básico), que causa aliasing em downscale agressivo
    // de vídeos 4K do Pexels. 'high' usa filtro melhor (próximo a lanczos).
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // VP9 quando disponível (qualidade muito melhor que VP8 no mesmo bitrate),
    // com VP8 e webm genérico como fallbacks.
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm'

    const stream = canvas.captureStream(cfg.fps)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: WEBM_BITRATE,
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = async () => {
      for (const v of [bgVideo1, bgVideo2]) {
        if (v) { v.pause(); v.removeAttribute('src'); v.load() }
      }
      try {
        onProgress(85)
        const webmBlob = new Blob(chunks, { type: mimeType })
        const mp4Blob = await convertToMp4(
          webmBlob,
          getTotalSeconds(cfg),
          cfg.fps,
          onProgress,
        )
        resolve(mp4Blob)
      } catch (e) {
        console.error('Conversão MP4 falhou, entregando webm:', e)
        resolve(new Blob(chunks, { type: mimeType }))
      }
    }
    recorder.onerror = () => reject(new Error('MediaRecorder error'))

    const totalFrames = getTotalFrames(cfg)
    const msPerFrame = 1000 / cfg.fps
    let frame = 0
    let lastProgressReport = -1
    const startTime = performance.now()

    recorder.start()

    function renderNext() {
      if (frame >= totalFrames) {
        recorder.stop()
        return
      }

      drawFrame(ctx, cfg, frame, totalFrames, bgVideo1, bgVideo2)

      // Escalar renderização para 0–84% para reservar 85–100% para conversão
      const pct = Math.round((frame / totalFrames) * 84)
      if (pct !== lastProgressReport) {
        lastProgressReport = pct
        onProgress(pct)
      }

      frame++

      // Pace by wall-clock so MediaRecorder receives frames at the right rate.
      // If we're ahead of schedule, wait; if behind, fire immediately.
      const targetTime = startTime + frame * msPerFrame
      const delay = Math.max(0, targetTime - performance.now())
      setTimeout(renderNext, delay)
    }

    renderNext()
  })
}
