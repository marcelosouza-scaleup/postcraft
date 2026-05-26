import { useState } from 'react'
import { exportVideo } from '@/lib/videoExporter'
import { getTotalSeconds } from '@/lib/videoRenderer'
import type { VideoConfig } from '@/types'
import { Download, Loader2 } from 'lucide-react'

interface Props {
  videoConfig: VideoConfig
  postTitle: string
  onVideoExported?: (blob: Blob) => void
}

export function VideoExportButton({ videoConfig, postTitle, onVideoExported }: Props) {
  const [progress, setProgress] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [firstRun, setFirstRun] = useState(
    () => localStorage.getItem('postcraft_ffmpeg_loaded') !== 'true',
  )

  async function handleExport() {
    setExporting(true)
    setProgress(0)
    try {
      const blob = await exportVideo(videoConfig, setProgress)
      localStorage.setItem('postcraft_ffmpeg_loaded', 'true')
      setFirstRun(false)
      onVideoExported?.(blob)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${postTitle.slice(0, 50).replace(/\s+/g, '-')}-reel.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao exportar vídeo')
    } finally {
      setExporting(false)
      setProgress(0)
    }
  }

  const totalSec = getTotalSeconds(videoConfig)

  return (
    <div className="space-y-2">
      {firstRun && !exporting && (
        <p className="text-[11px] text-neutral-400 text-center">
          Primeira exportação carrega o conversor (~30MB). As próximas são mais rápidas.
        </p>
      )}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition w-full"
      >
        {exporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {progress < 85
              ? `Renderizando... ${progress}%`
              : progress < 92
              ? `Analisando vídeo... ${progress}%`
              : `Comprimindo MP4... ${progress}%`}
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Exportar Reel ({totalSec}s)
          </>
        )}
      </button>
      {exporting && (
        <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-orange-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
