import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueueStore } from '@/stores/useQueueStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { generateCaption, generateVariations, CAPTION_PROMPT } from '@/services/ai'
import { buildDefaultVideoConfig } from '@/lib/videoDefaults'
import { Header } from '@/components/layout/Header'
import { ImageIcon, Trash2, ArrowRight, Loader2, Send } from 'lucide-react'
import { cn } from '@/utils/cn'

function QueueThumbnail({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  return (
    <div className="relative w-full h-full">
      {!loaded && !errored && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
        </div>
      )}
      {errored ? (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-neutral-300" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { setErrored(true); setLoaded(true) }}
          className={cn('w-full h-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'pendente',
  generating: 'gerando...',
  done: 'pronto',
  error: 'erro',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-neutral-100 text-neutral-600',
  generating: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

export function QueuePage() {
  const navigate = useNavigate()
  const { posts, updatePost, removePost, clearDone } = useQueueStore()
  const { config } = useConfigStore()

  const doneCount = posts.filter((p) => p.status === 'done').length
  const isGenerating = posts.some((p) => p.status === 'generating')

  const pendingIds = useMemo(
    () => posts.filter((p) => p.status === 'pending').map((p) => p.id),
    [posts]
  )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(pendingIds))
  // Track which pending posts we've already auto-selected, so we don't override deselections.
  const [seenPending, setSeenPending] = useState<Set<string>>(() => new Set(pendingIds))

  const [customPrompt, setCustomPrompt] = useState(() =>
    CAPTION_PROMPT('[TÍTULO]', '[CONTEÚDO]'),
  )

  const hasPending = pendingIds.length > 0

  // Auto-select newly-arrived pending posts (e.g. when added from Source).
  useEffect(() => {
    const fresh = pendingIds.filter((id) => !seenPending.has(id))
    if (fresh.length === 0) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      fresh.forEach((id) => next.add(id))
      return next
    })
    setSeenPending((prev) => {
      const next = new Set(prev)
      fresh.forEach((id) => next.add(id))
      return next
    })
  }, [pendingIds, seenPending])

  const selectedPending = posts.filter(
    (p) => selectedIds.has(p.id) && p.status === 'pending'
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllPending() {
    setSelectedIds(new Set(pendingIds))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  async function generateSelected() {
    for (const post of selectedPending) {
      updatePost(post.id, { status: 'generating', error: '' })
      try {
        const { hook, caption, photoQuery, videoQuery, points } = await generateCaption(
          post.title,
          post.body,
          config,
          customPrompt,
        )
        const variations = await generateVariations(
          hook || post.title,
          config.instagramHandle,
          config.pexelsKey,
          photoQuery,
          post.title,
          post.body,
        )
        const templateId = variations[0]?.config.template.id ?? 'dark'
        const videoConfig = buildDefaultVideoConfig(
          hook || post.title,
          caption,
          config.instagramHandle,
          templateId,
          post.title,
          post.body,
          videoQuery,
          undefined,
          points,
        )
        updatePost(post.id, {
          status: 'done',
          caption,
          imagePrompt: hook,
          imageUrl: variations[0].dataUrl,
          variations,
          selectedVariation: 0,
          videoConfig,
        })
      } catch (err) {
        updatePost(post.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      }
    }
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto">
              <ImageIcon className="w-8 h-8 text-neutral-400" />
            </div>
            <div>
              <p className="text-neutral-700 font-medium">Fila vazia</p>
              <p className="text-sm text-neutral-400 mt-1">Adicione artigos para começar a gerar posts.</p>
            </div>
            <button
              onClick={() => navigate('/source')}
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              Ir para Fonte
            </button>
          </div>
        </main>
      </div>
    )
  }

  const generateDisabled = isGenerating || selectedPending.length === 0

  return (
    <div className="flex flex-col h-full">
      <Header
        actions={
          <div className="flex items-center gap-3">
            {doneCount > 0 && (
              <button
                onClick={clearDone}
                className="text-sm text-neutral-500 hover:text-neutral-700 transition"
              >
                Limpar prontos
              </button>
            )}
            <button
              onClick={generateSelected}
              disabled={generateDisabled}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
              {isGenerating
                ? 'Gerando...'
                : `Gerar selecionados (${selectedPending.length})`}
            </button>
          </div>
        }
      />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 flex-wrap mb-6">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Fila de geração</h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                {doneCount}/{posts.length} prontos · {selectedPending.length} selecionados para gerar
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={selectAllPending}
                disabled={pendingIds.length === 0}
                className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 hover:border-neutral-300 disabled:opacity-50 transition"
              >
                Selecionar pendentes
              </button>
              <button
                onClick={deselectAll}
                disabled={selectedIds.size === 0}
                className="text-sm border border-neutral-200 rounded-lg px-3 py-1.5 hover:border-neutral-300 disabled:opacity-50 transition"
              >
                Desmarcar todos
              </button>
            </div>
          </div>

          {hasPending && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-[10px] p-4 mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-neutral-900">
                    Prompt de geração
                  </span>
                  <span className="text-xs text-neutral-500">
                    Edite antes de gerar — vale para todos os selecionados
                  </span>
                </div>
                <button
                  onClick={() => setCustomPrompt(CAPTION_PROMPT('[TÍTULO]', '[CONTEÚDO]'))}
                  className="text-[11px] text-neutral-500 hover:text-neutral-900 transition shrink-0"
                >
                  ↺ Restaurar padrão
                </button>
              </div>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                spellCheck={false}
                className="w-full min-h-[220px] font-mono text-xs leading-relaxed px-3 py-2.5 border border-neutral-200 rounded-md bg-white text-neutral-800 resize-y outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              />
              <p className="text-[11px] text-neutral-500 mt-1.5">
                Variáveis disponíveis:{' '}
                <code className="font-mono text-neutral-700">[TÍTULO]</code> e{' '}
                <code className="font-mono text-neutral-700">[CONTEÚDO]</code> — substituídas
                automaticamente por cada artigo.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {posts.map((post) => {
              const checkboxDisabled = post.status === 'done' || post.status === 'generating'
              const checked = selectedIds.has(post.id)
              return (
                <div
                  key={post.id}
                  className={cn(
                    'flex items-start gap-4 p-4 bg-white rounded-xl border transition',
                    checked && !checkboxDisabled
                      ? 'border-orange-300'
                      : 'border-neutral-200'
                  )}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={checkboxDisabled}
                    onChange={() => toggleSelect(post.id)}
                    className="mt-1 accent-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`Selecionar ${post.title}`}
                  />

                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-neutral-100 flex items-center justify-center">
                    {post.imageUrl ? (
                      <QueueThumbnail src={post.imageUrl} alt={post.title} />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-neutral-300" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-900 line-clamp-1">
                        {post.title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {post.instagramResult && (
                          <span
                            title="Publicado no Instagram"
                            className="inline-flex items-center text-purple-600"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[11px] font-semibold',
                            STATUS_COLORS[post.status]
                          )}
                        >
                          {STATUS_LABELS[post.status]}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                      {post.status === 'generating' && 'Gerando conteúdo com IA...'}
                      {post.status === 'error' && (
                        <span className="text-red-500">{post.error}</span>
                      )}
                      {post.status === 'done' && post.caption.slice(0, 160)}
                      {post.status === 'pending' && post.body.slice(0, 160)}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      {post.status === 'done' && (
                        <button
                          onClick={() => navigate(`/studio/${post.id}`)}
                          className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 transition"
                        >
                          Studio <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {post.status === 'pending' && (
                        <button
                          onClick={() => removePost(post.id)}
                          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
