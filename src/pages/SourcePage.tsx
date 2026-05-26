import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/stores/useConfigStore'
import { useQueueStore } from '@/stores/useQueueStore'
import { useArticleCache, type CachedArticle } from '@/stores/useArticleCache'
import { Header } from '@/components/layout/Header'
import { Search } from 'lucide-react'

const ARTICLES_TABLE = 'articles'

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  return `há ${Math.floor(hrs / 24)}d`
}

export function SourcePage() {
  const navigate = useNavigate()
  const { config, isConfigured } = useConfigStore()
  const { posts, addPosts } = useQueueStore()
  const { articles, lastFetchAt, addArticles, clearCache } = useArticleCache()

  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [lastResult, setLastResult] = useState<{ added: number } | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isConfigured()) {
      navigate('/setup')
    }
  }, [isConfigured, navigate])

  async function fetchArticles() {
    setLoading(true)
    setFetchError('')
    setLastResult(null)
    try {
      const baseUrl = config.supabaseUrl.replace(/\/$/, '')
      const res = await fetch(
        `${baseUrl}/rest/v1/${ARTICLES_TABLE}?select=*&limit=200&order=created_at.desc`,
        {
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${config.supabaseAnonKey}`,
            Accept: 'application/json',
          },
        }
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Erro ${res.status}: ${body || res.statusText}`)
      }
      const data: Array<Record<string, unknown>> = await res.json()
      const now = new Date().toISOString()
      const mapped: CachedArticle[] = data.map((r) => ({
        id: String(r.id ?? r.slug ?? r.uuid ?? JSON.stringify(r).slice(0, 40)),
        title: String(r.title ?? r.titulo ?? r.name ?? 'Sem título'),
        body: String(r.content ?? r.body ?? r.conteudo ?? r.description ?? ''),
        cachedAt: now,
      }))
      const added = addArticles(mapped)
      setLastResult({ added })
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(visibleIds: string[]) {
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
    setSelectedIds(() => (allSelected ? new Set() : new Set(visibleIds)))
  }

  function handleAddToQueue() {
    const toAdd = articles
      .filter((a) => selectedIds.has(a.id))
      .map((a) => ({ id: a.id, title: a.title, body: a.body }))
    addPosts(toAdd)
    navigate('/queue')
  }

  function handleClearCache() {
    clearCache()
    setSelectedIds(new Set())
    setLastResult(null)
  }

  const queuedIds = new Set(posts.map((p) => p.id))
  const filtered = search.trim()
    ? articles.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    : articles
  const filteredIds = filtered.map((a) => a.id)
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))

  return (
    <div className="flex flex-col h-full">
      <Header
        actions={
          selectedIds.size > 0 && (
            <button
              onClick={handleAddToQueue}
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              Adicionar {selectedIds.size} artigo{selectedIds.size !== 1 ? 's' : ''} à fila
            </button>
          )
        }
      />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Fonte de Conteúdo</h1>
              <p className="text-neutral-500 text-sm mt-0.5">
                {articles.length} {articles.length === 1 ? 'artigo' : 'artigos'} em cache
                {lastFetchAt && ` · atualizado ${formatRelative(lastFetchAt)}`}
              </p>
            </div>
            <div className="flex gap-2">
              {articles.length > 0 && (
                <button
                  onClick={handleClearCache}
                  className="text-sm border border-neutral-200 rounded-lg px-3 py-2 hover:border-neutral-300 transition"
                >
                  Limpar cache
                </button>
              )}
              <button
                onClick={fetchArticles}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                {loading ? 'Buscando...' : 'Buscar novos artigos'}
              </button>
            </div>
          </div>

          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
              {fetchError}
            </div>
          )}

          {lastResult && !fetchError && (
            <div
              className={
                lastResult.added > 0
                  ? 'border border-green-200 bg-green-50 text-green-700 rounded-lg px-4 py-2.5 text-sm mb-4'
                  : 'border border-neutral-200 bg-neutral-50 text-neutral-500 rounded-lg px-4 py-2.5 text-sm mb-4'
              }
            >
              {lastResult.added > 0
                ? lastResult.added === 1
                  ? '✓ 1 novo artigo adicionado ao cache'
                  : `✓ ${lastResult.added} novos artigos adicionados ao cache`
                : 'Nenhum artigo novo encontrado — tudo já está em cache'}
            </div>
          )}

          {articles.length > 0 && (
            <>
              {/* Local search filter */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar artigos por título..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                />
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-neutral-600">
                  {filtered.length} de {articles.length}{' '}
                  {articles.length === 1 ? 'artigo' : 'artigos'}
                  {search.trim() && ` correspondem a "${search}"`}
                </span>
                {filtered.length > 0 && (
                  <button
                    onClick={() => toggleAll(filteredIds)}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {filtered.map((article) => {
                  const inQueue = queuedIds.has(article.id)
                  const checked = selectedIds.has(article.id)
                  return (
                    <label
                      key={article.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                        checked
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(article.id)}
                        className="mt-0.5 accent-orange-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-900 truncate">
                            {article.title}
                          </span>
                          {inQueue && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">
                              na fila
                            </span>
                          )}
                        </div>
                        {article.body && (
                          <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                            {article.body.slice(0, 160)}
                          </p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>

              {search.trim() && filtered.length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-10">
                  Nenhum artigo corresponde a "{search}".
                </p>
              )}

              {selectedIds.size > 0 && (
                <div className="sticky bottom-6 mt-6">
                  <button
                    onClick={handleAddToQueue}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold py-3 rounded-xl shadow-lg transition"
                  >
                    Adicionar {selectedIds.size} artigo{selectedIds.size !== 1 ? 's' : ''} à fila →
                  </button>
                </div>
              )}
            </>
          )}

          {articles.length === 0 && !loading && !fetchError && (
            <div className="text-center py-16">
              <p className="text-sm text-neutral-500">
                Nenhum artigo em cache ainda.
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Clique em "Buscar novos artigos" para carregar a tabela{' '}
                <span className="font-mono">{ARTICLES_TABLE}</span>.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
