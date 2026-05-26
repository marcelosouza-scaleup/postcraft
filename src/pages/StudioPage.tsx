import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueueStore } from '@/stores/useQueueStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { generateCaption, generateVariations } from '@/services/ai'
import { buildDefaultVideoConfig } from '@/lib/videoDefaults'
import { downloadImage } from '@/utils/download'
import { Header } from '@/components/layout/Header'
import { VideoEditor } from '@/components/studio/VideoEditor'
import { VideoExportButton } from '@/components/studio/VideoExportButton'
import { ArrowLeft, RefreshCw, Copy, Check, Loader2, Download, X, Upload, ExternalLink, Send } from 'lucide-react'
import { searchVideo, getBestVideoUrl, detectSegmentQuery } from '@/lib/pexels'
import { cn } from '@/utils/cn'
import type { VideoConfig, DriveUploadResult, InstagramPublishResult } from '@/types'
import { savePostToDrive } from '@/lib/drive'
import { getGoogleAccessToken, isTokenValid, startGoogleAuth } from '@/lib/googleAuth'
import { publishToInstagram, checkPublishingLimit, type PublishType } from '@/lib/instagram'
import { uploadImageToStorage, uploadVideoToStorage, deleteFromStorage } from '@/lib/storage'

function getInitials(handle: string): string {
  const clean = handle.replace('@', '')
  return clean.slice(0, 2).toUpperCase() || 'PC'
}

type Tab = 'image' | 'video'

export function StudioPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { posts, updatePost } = useQueueStore()
  const { config } = useConfigStore()

  const post = posts.find((p) => p.id === id)

  useEffect(() => {
    if (!post) navigate('/queue')
  }, [post, navigate])

  const [caption, setCaption] = useState(post?.caption ?? '')
  const [copied, setCopied] = useState(false)
  const [regeneratingCaption, setRegeneratingCaption] = useState(false)
  const [regeneratingImages, setRegeneratingImages] = useState(false)
  const [tab, setTab] = useState<Tab>('image')
  const [editHook, setEditHook] = useState(post?.imagePrompt ?? '')
  const [bgQuery, setBgQuery] = useState(
    post?.variations[0]?.config.backgroundQuery ?? '',
  )
  const [videoQuery, setVideoQuery] = useState(
    post?.videoConfig?.backgroundVideoQuery ||
      (post ? detectSegmentQuery(post.title, post.body) : ''),
  )
  const [videoQuery2, setVideoQuery2] = useState(
    post?.videoConfig?.backgroundVideoQuery2 || '',
  )
  const [searchingVideo, setSearchingVideo] = useState<1 | 2 | null>(null)
  const [savingToDrive, setSavingToDrive] = useState(false)
  const [driveStep, setDriveStep] = useState('')
  const [driveProgress, setDriveProgress] = useState(0)
  const [driveResult, setDriveResult] = useState<DriveUploadResult | null>(
    post?.driveResult ?? null,
  )
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishStep, setPublishStep] = useState('')
  const [publishResult, setPublishResult] = useState<InstagramPublishResult | null>(
    post?.instagramResult ?? null,
  )
  const [publishType, setPublishType] = useState<'image' | 'reel'>('image')

  useEffect(() => {
    setDriveResult(post?.driveResult ?? null)
  }, [post?.id, post?.driveResult])

  useEffect(() => {
    setPublishResult(post?.instagramResult ?? null)
  }, [post?.id, post?.instagramResult])

  useEffect(() => {
    if (post?.caption) setCaption(post.caption)
  }, [post?.caption])

  useEffect(() => {
    setEditHook(post?.imagePrompt ?? '')
  }, [post?.id, post?.imagePrompt])

  if (!post) return null

  const feedVariations = post.variations.filter((v) => v.format === 'feed')
  const storyVariations = post.variations.filter((v) => v.format === 'story')
  const selectedFeedIdx = Math.floor(post.selectedVariation / 2)
  const selectedFeed = feedVariations[selectedFeedIdx] ?? feedVariations[0]
  const matchingStory = storyVariations[selectedFeedIdx] ?? storyVariations[0]

  const videoConfig: VideoConfig = post.videoConfig ?? buildDefaultVideoConfig(
    post.imagePrompt || post.title,
    post.caption,
    config.instagramHandle,
    post.variations[0]?.config.template.id ?? 'dark',
  )

  async function handleRegenerateCaption() {
    if (!post) return
    setRegeneratingCaption(true)
    try {
      const { hook, caption: newCaption, photoQuery, videoQuery, points } = await generateCaption(
        post.title,
        post.body,
        config,
      )
      setCaption(newCaption)
      const variations = await generateVariations(
        hook || post.title,
        config.instagramHandle,
        config.pexelsKey,
        photoQuery,
        post.title,
        post.body,
      )
      const templateId = variations[0]?.config.template.id ?? 'dark'
      const newVideoConfig = buildDefaultVideoConfig(
        hook || post.title,
        newCaption,
        config.instagramHandle,
        templateId,
        post.title,
        post.body,
        videoQuery,
        undefined,
        points,
      )
      updatePost(post.id, {
        caption: newCaption,
        imagePrompt: hook,
        imageUrl: variations[0].dataUrl,
        variations,
        selectedVariation: 0,
        videoConfig: newVideoConfig,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao regerar legenda')
    } finally {
      setRegeneratingCaption(false)
    }
  }

  async function handleRegenerateImages(overrideBgQuery?: string) {
    if (!post) return
    setRegeneratingImages(true)
    try {
      const variations = await generateVariations(
        post.imagePrompt || post.title,
        config.instagramHandle,
        config.pexelsKey,
        overrideBgQuery,
        post.title,
        post.body,
      )
      updatePost(post.id, {
        variations,
        imageUrl: variations[0].dataUrl,
        selectedVariation: 0,
      })
    } finally {
      setRegeneratingImages(false)
    }
  }

  async function applyHook() {
    if (!post) return
    const next = editHook.trim()
    if (!next || next === post.imagePrompt) return
    setRegeneratingImages(true)
    try {
      const variations = await generateVariations(
        next,
        config.instagramHandle,
        config.pexelsKey,
        undefined,
        post.title,
        post.body,
      )
      updatePost(post.id, {
        imagePrompt: next,
        variations,
        imageUrl: variations[0].dataUrl,
        selectedVariation: 0,
      })
    } finally {
      setRegeneratingImages(false)
    }
  }

  async function searchNewBackground() {
    const query = bgQuery.trim()
    if (!query || !config.pexelsKey) return
    await handleRegenerateImages(query)
  }

  async function searchBgVideo(slot: 1 | 2 = 1) {
    if (!post || !config.pexelsKey) return
    const query = (slot === 1 ? videoQuery : videoQuery2).trim()
    if (!query) return
    setSearchingVideo(slot)
    try {
      const video = await searchVideo(query, config.pexelsKey)
      if (!video) return
      const url = getBestVideoUrl(video)
      if (!url) return
      const credit = video.user || 'Pexels'
      handleVideoConfigChange(slot === 1
        ? { ...videoConfig, backgroundVideoUrl: url, backgroundVideoCredit: credit, backgroundVideoQuery: query }
        : { ...videoConfig, backgroundVideoUrl2: url, backgroundVideoCredit2: credit, backgroundVideoQuery2: query },
      )
    } finally {
      setSearchingVideo(null)
    }
  }

  function removeBgVideo(slot: 1 | 2 = 1) {
    handleVideoConfigChange(slot === 1
      ? { ...videoConfig, backgroundVideoUrl: '', backgroundVideoCredit: '' }
      : { ...videoConfig, backgroundVideoUrl2: '', backgroundVideoCredit2: '' },
    )
  }

  function handleCopy() {
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function selectFeedVariation(feedIndex: number) {
    const flatIdx = feedIndex * 2
    const v = feedVariations[feedIndex]
    if (!v) return
    updatePost(post!.id, { selectedVariation: flatIdx, imageUrl: v.dataUrl })
  }

  function handleVideoConfigChange(cfg: VideoConfig) {
    updatePost(post!.id, { videoConfig: cfg })
  }

  async function handlePublishToInstagram() {
    if (!post) return
    setPublishing(true)
    setPublishStep('Preparando...')

    const timestamp = Date.now()
    let uploadedFilename = ''

    try {
      const limit = await checkPublishingLimit()
      if (limit.quota_usage >= 95) {
        throw new Error(
          `Limite de publicações quase atingido (${limit.quota_usage}/100 hoje)`,
        )
      }

      let mediaUrl = ''
      let mediaType: PublishType = 'IMAGE'

      if (publishType === 'reel' && lastVideoBlob) {
        setPublishStep('Enviando vídeo para hospedagem...')
        uploadedFilename = `reels/${timestamp}-reel.mp4`
        mediaUrl = await uploadVideoToStorage(lastVideoBlob, uploadedFilename)
        mediaType = 'REELS'
      } else {
        setPublishStep('Enviando imagem para hospedagem...')
        const imageDataUrl = selectedFeed?.dataUrl ?? post.imageUrl
        if (!imageDataUrl) throw new Error('Sem imagem selecionada para publicar.')
        uploadedFilename = `images/${timestamp}-feed.jpg`
        mediaUrl = await uploadImageToStorage(imageDataUrl, uploadedFilename)
        mediaType = 'IMAGE'
      }

      const result = await publishToInstagram(
        { type: mediaType, mediaUrl, caption },
        setPublishStep,
      )

      const stored: InstagramPublishResult = {
        mediaId: result.mediaId,
        permalink: result.permalink ?? '',
      }
      setPublishResult(stored)
      updatePost(post.id, { instagramResult: stored })
    } catch (e) {
      alert(`Erro ao publicar: ${e instanceof Error ? e.message : String(e)}`)
      if (uploadedFilename) {
        deleteFromStorage(uploadedFilename).catch(() => {})
      }
    } finally {
      setPublishing(false)
      setPublishStep('')
    }
  }

  async function handleSaveToDrive() {
    if (!post) return
    if (!isTokenValid()) {
      startGoogleAuth()
      return
    }
    const token = getGoogleAccessToken()
    if (!token) {
      startGoogleAuth()
      return
    }

    setSavingToDrive(true)
    setDriveProgress(0)
    setDriveStep('Preparando...')

    try {
      const imageDataUrl = selectedFeed?.dataUrl ?? post.imageUrl
      if (!imageDataUrl) throw new Error('Sem imagem selecionada para salvar.')

      const result = await savePostToDrive(
        {
          title: post.title,
          caption,
          imageDataUrl,
          videoBlob: lastVideoBlob ?? undefined,
        },
        config.driveConfig ?? {
          folderId: '',
          folderName: 'PostCraft',
          subfolderByDate: true,
        },
        token,
        (step, pct) => {
          setDriveStep(step)
          setDriveProgress(pct)
        },
      )

      setDriveResult(result)
      updatePost(post.id, { driveResult: result })
    } catch (e) {
      alert(`Erro ao salvar no Drive: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSavingToDrive(false)
    }
  }

  const handle = config.instagramHandle || '@postcraft'
  const initials = getInitials(handle)
  const previewCaption = caption.slice(0, 140)

  return (
    <div className="flex flex-col h-full">
      <Header
        actions={
          <Link
            to="/queue"
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar à fila
          </Link>
        }
      />

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-bold text-neutral-900 mb-1 line-clamp-1">{post.title}</h1>
          <p className="text-sm text-neutral-400 mb-6">Edite e exporte o post gerado.</p>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-neutral-200">
            {(['image', 'video'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-2 text-sm font-semibold transition border-b-2 -mb-px',
                  tab === t
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                )}
              >
                {t === 'image' ? 'Imagem' : 'Vídeo / Reel'}
              </button>
            ))}
          </div>

          {tab === 'image' && (
            <div className="grid grid-cols-2 gap-8 mb-10">
              {/* Left — Images */}
              <div className="space-y-5">
                {/* Hook editor */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
                    Texto da imagem
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editHook}
                      onChange={(e) => setEditHook(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          applyHook()
                        }
                      }}
                      placeholder="Digite o texto que aparece na imagem..."
                      className="flex-1 border border-neutral-200 rounded-md px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                    />
                    <button
                      onClick={applyHook}
                      disabled={
                        regeneratingImages ||
                        !editHook.trim() ||
                        editHook.trim() === post.imagePrompt
                      }
                      className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-md transition flex items-center gap-1.5"
                    >
                      {regeneratingImages && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Aplicar
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Enter ou "Aplicar" para regerar todas as variações com o novo texto.
                  </p>
                </div>

                {/* Pexels background search */}
                {config.pexelsKey && (
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">
                      Busca de fundo (Pexels)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={bgQuery}
                        onChange={(e) => setBgQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            searchNewBackground()
                          }
                        }}
                        placeholder="ex: restaurant kitchen, small business office..."
                        className="flex-1 border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                      />
                      <button
                        onClick={searchNewBackground}
                        disabled={regeneratingImages || !bgQuery.trim()}
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-md transition flex items-center gap-1.5"
                      >
                        {regeneratingImages && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Nova foto
                      </button>
                    </div>
                    {selectedFeed?.config.backgroundMediaCredit && (
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Foto por {selectedFeed.config.backgroundMediaCredit} · Pexels
                      </p>
                    )}
                  </div>
                )}

                {feedVariations.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                      Feed 1:1 — escolha uma variação
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {feedVariations.map((v, i) => (
                        <button
                          key={i}
                          onClick={() => selectFeedVariation(i)}
                          className={cn(
                            'aspect-square w-full rounded-lg overflow-hidden border-2 transition-all',
                            selectedFeedIdx === i
                              ? 'border-orange-500 opacity-100'
                              : 'border-transparent opacity-60 hover:opacity-80'
                          )}
                        >
                          <img src={v.dataUrl} alt={`Variação ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square w-full rounded-2xl bg-neutral-100 flex items-center justify-center">
                    <p className="text-sm text-neutral-400">Sem imagens geradas</p>
                  </div>
                )}

                {storyVariations.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                      Stories 9:16
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {storyVariations.map((v, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-full rounded-lg overflow-hidden border transition-all',
                            selectedFeedIdx === i ? 'border-orange-400' : 'border-neutral-200'
                          )}
                          style={{ aspectRatio: '9/16' }}
                        >
                          <img src={v.dataUrl} alt={`Story ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => downloadImage(selectedFeed?.dataUrl ?? post.imageUrl, `${post.title}-feed`)}
                    disabled={!selectedFeed}
                    className="flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 transition"
                  >
                    <Download className="w-4 h-4" />
                    Baixar feed
                  </button>
                  <button
                    onClick={() => downloadImage(matchingStory?.dataUrl ?? post.imageUrl, `${post.title}-story`)}
                    disabled={!matchingStory}
                    className="flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 transition"
                  >
                    <Download className="w-4 h-4" />
                    Baixar story
                  </button>
                </div>

                <button
                  onClick={() => handleRegenerateImages()}
                  disabled={regeneratingImages}
                  className="w-full flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 transition"
                >
                  {regeneratingImages ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {regeneratingImages ? 'Regerando...' : 'Regerar todas as variações'}
                </button>

                {/* Instagram publish */}
                <div className="pt-4 border-t border-neutral-200">
                  {publishResult ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-purple-700 flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> Publicado no Instagram
                        </p>
                        <p className="text-[11px] text-neutral-500 mt-0.5 font-mono truncate">
                          ID: {publishResult.mediaId}
                        </p>
                      </div>
                      {publishResult.permalink && (
                        <a
                          href={publishResult.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-purple-700 hover:text-purple-800 transition flex items-center gap-1 shrink-0"
                        >
                          Ver post <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-1.5 mb-2">
                        {(['image', 'reel'] as const).map((t) => {
                          const disabled = t === 'reel' && !lastVideoBlob
                          const active = publishType === t
                          return (
                            <button
                              key={t}
                              onClick={() => setPublishType(t)}
                              disabled={disabled}
                              className={cn(
                                'flex-1 text-xs font-semibold px-3 py-1.5 rounded-md border transition',
                                active
                                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                                  : 'border-neutral-200 text-neutral-500 hover:border-neutral-300',
                                disabled && 'opacity-40 cursor-not-allowed',
                              )}
                            >
                              {t === 'image' ? 'Foto' : 'Reel'}
                            </button>
                          )
                        })}
                      </div>
                      {publishType === 'reel' && !lastVideoBlob && (
                        <p className="text-[11px] font-mono text-neutral-400 mb-1.5">
                          Exporte o Reel na aba Vídeo antes de publicar
                        </p>
                      )}

                      <button
                        onClick={handlePublishToInstagram}
                        disabled={publishing || (publishType === 'reel' && !lastVideoBlob)}
                        className="w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg py-2 transition"
                      >
                        {publishing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {publishing ? publishStep || 'Publicando...' : 'Publicar no Instagram'}
                      </button>

                      {publishing && (
                        <div className="mt-2 h-1 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full w-full animate-pulse" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Google Drive */}
                <div className="pt-4 border-t border-neutral-200">
                  {driveResult ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> Salvo no Drive
                        </p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {driveResult.videoFileId
                            ? 'Imagem + legenda + vídeo salvos'
                            : 'Imagem + legenda salvos — exporte o Reel antes de salvar para incluir o vídeo'}
                        </p>
                      </div>
                      <a
                        href={driveResult.folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-green-700 hover:text-green-800 transition flex items-center gap-1 shrink-0"
                      >
                        Abrir pasta <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <>
                      {!lastVideoBlob && !savingToDrive && (
                        <p className="text-[11px] font-mono text-neutral-400 mb-1.5">
                          Dica: exporte o Reel na aba Vídeo antes de salvar para incluir o .mp4
                        </p>
                      )}
                      <button
                        onClick={handleSaveToDrive}
                        disabled={savingToDrive}
                        className="w-full flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 transition"
                      >
                        {savingToDrive ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {savingToDrive ? driveStep || 'Salvando...' : 'Salvar no Drive'}
                      </button>
                      {savingToDrive && (
                        <div className="mt-2 h-1 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all duration-300"
                            style={{ width: `${driveProgress}%` }}
                          />
                        </div>
                      )}
                      {lastVideoBlob && !savingToDrive && (
                        <p className="text-[11px] text-neutral-400 mt-1.5 text-center">
                          Vídeo exportado nesta sessão será incluído.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Right — Caption */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                      Legenda
                    </label>
                    <span className="text-xs text-neutral-400">{caption.length} chars</span>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => {
                      setCaption(e.target.value)
                      updatePost(post.id, { caption: e.target.value })
                    }}
                    className="w-full border border-neutral-200 rounded-xl p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition"
                    style={{ minHeight: 240 }}
                    rows={12}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar legenda
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRegenerateCaption}
                    disabled={regeneratingCaption}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 transition"
                  >
                    {regeneratingCaption ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Regerar legenda
                  </button>
                </div>

                {/* Instagram Preview */}
                <div className="border border-neutral-200 rounded-2xl p-5 bg-white">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-4">
                    Preview Instagram
                  </p>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-orange-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">{handle}</p>
                      <p className="text-sm text-neutral-700 mt-1 leading-relaxed">
                        {previewCaption}
                        {caption.length > 140 && (
                          <span className="text-neutral-400 cursor-pointer hover:text-neutral-600"> ... mais</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'video' && (
            <div className="space-y-6">
              {config.pexelsKey && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-4">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                    Vídeos de fundo (Pexels)
                  </label>

                  {/* Cena 1 */}
                  <div>
                    <p className="text-xs font-semibold text-neutral-700 mb-2">
                      Cena 1 <span className="font-normal text-neutral-400">— logo + hook</span>
                    </p>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={videoQuery}
                        onChange={(e) => setVideoQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchBgVideo(1) } }}
                        placeholder="ex: busy restaurant kitchen..."
                        className="flex-1 border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                      />
                      <button
                        onClick={() => searchBgVideo(1)}
                        disabled={searchingVideo === 1 || !videoQuery.trim()}
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-md transition flex items-center gap-1.5"
                      >
                        {searchingVideo === 1 && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {videoConfig.backgroundVideoUrl ? 'Trocar' : 'Buscar'}
                      </button>
                    </div>
                    {videoConfig.backgroundVideoUrl ? (
                      <div className="flex items-center gap-3">
                        <video src={videoConfig.backgroundVideoUrl} autoPlay muted loop playsInline
                          className="w-[54px] h-[96px] object-cover rounded border border-neutral-200 shrink-0" />
                        <div>
                          {videoConfig.backgroundVideoCredit && (
                            <p className="text-[11px] text-neutral-500">Por {videoConfig.backgroundVideoCredit} · Pexels</p>
                          )}
                          <button onClick={() => removeBgVideo(1)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-red-600 transition">
                            <X className="w-3 h-3" /> Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400">Sem vídeo — exporta com cor sólida do template.</p>
                    )}
                  </div>

                  {/* Cena 2 */}
                  <div className="pt-4 border-t border-neutral-200">
                    <p className="text-xs font-semibold text-neutral-700 mb-2">
                      Cena 2 <span className="font-normal text-neutral-400">— pontos + CTA</span>
                      <span className="ml-2 text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">opcional</span>
                    </p>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={videoQuery2}
                        onChange={(e) => setVideoQuery2(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchBgVideo(2) } }}
                        placeholder="ex: team meeting office success..."
                        className="flex-1 border border-neutral-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                      />
                      <button
                        onClick={() => searchBgVideo(2)}
                        disabled={searchingVideo === 2 || !videoQuery2.trim()}
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-md transition flex items-center gap-1.5"
                      >
                        {searchingVideo === 2 && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {videoConfig.backgroundVideoUrl2 ? 'Trocar' : 'Buscar'}
                      </button>
                    </div>
                    {videoConfig.backgroundVideoUrl2 ? (
                      <div className="flex items-center gap-3">
                        <video src={videoConfig.backgroundVideoUrl2} autoPlay muted loop playsInline
                          className="w-[54px] h-[96px] object-cover rounded border border-neutral-200 shrink-0" />
                        <div>
                          {videoConfig.backgroundVideoCredit2 && (
                            <p className="text-[11px] text-neutral-500">Por {videoConfig.backgroundVideoCredit2} · Pexels</p>
                          )}
                          <button onClick={() => removeBgVideo(2)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-red-600 transition">
                            <X className="w-3 h-3" /> Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400">Sem segunda cena — vídeo 1 é usado durante todo o reel.</p>
                    )}
                  </div>

                  {/* Seletor de transição — só aparece com os 2 vídeos */}
                  {videoConfig.backgroundVideoUrl && videoConfig.backgroundVideoUrl2 && (
                    <div className="pt-4 border-t border-neutral-200">
                      <p className="text-xs font-semibold text-neutral-700 mb-2">Transição</p>
                      <div className="flex gap-2 flex-wrap mb-3">
                        {([
                          { id: 'cut',       label: 'Corte seco' },
                          { id: 'fade',      label: 'Fade' },
                          { id: 'crossfade', label: 'Dissolve' },
                          { id: 'wipe-left', label: 'Wipe' },
                          { id: 'zoom',      label: 'Zoom' },
                        ] as const).map((t) => {
                          const active = (videoConfig.transition?.type ?? 'fade') === t.id
                          return (
                            <button key={t.id}
                              onClick={() => handleVideoConfigChange({
                                ...videoConfig,
                                transition: { type: t.id, durationSeconds: videoConfig.transition?.durationSeconds ?? 0.5 },
                              })}
                              className={cn(
                                'text-xs px-3 py-1 rounded-full border transition font-mono',
                                active
                                  ? 'border-orange-400 bg-orange-50 text-orange-600'
                                  : 'border-neutral-200 text-neutral-500 hover:border-neutral-300',
                              )}
                            >
                              {t.label}
                            </button>
                          )
                        })}
                      </div>
                      {(videoConfig.transition?.type ?? 'fade') !== 'cut' && (
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-neutral-400 font-mono whitespace-nowrap">Duração</span>
                          <input
                            type="range" min="0.2" max="1.5" step="0.1"
                            value={videoConfig.transition?.durationSeconds ?? 0.5}
                            onChange={(e) => handleVideoConfigChange({
                              ...videoConfig,
                              transition: { type: videoConfig.transition?.type ?? 'fade', durationSeconds: parseFloat(e.target.value) },
                            })}
                            className="flex-1 accent-orange-600"
                          />
                          <span className="text-xs font-mono text-neutral-600 w-8 text-right">
                            {(videoConfig.transition?.durationSeconds ?? 0.5).toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <VideoEditor videoConfig={videoConfig} onChange={handleVideoConfigChange} />
              <VideoExportButton
                videoConfig={videoConfig}
                postTitle={post.title}
                onVideoExported={setLastVideoBlob}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
