import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CachedArticle {
  id: string
  title: string
  body: string
  cachedAt: string
}

interface ArticleCacheStore {
  articles: CachedArticle[]
  lastFetchAt: string | null
  addArticles: (incoming: CachedArticle[]) => number
  clearCache: () => void
}

export const useArticleCache = create<ArticleCacheStore>()(
  persist(
    (set, get) => ({
      articles: [],
      lastFetchAt: null,
      addArticles: (incoming) => {
        const existing = new Set(get().articles.map((a) => a.id))
        const newOnes = incoming.filter((a) => !existing.has(a.id))
        set((s) => ({
          articles: newOnes.length > 0 ? [...s.articles, ...newOnes] : s.articles,
          lastFetchAt: new Date().toISOString(),
        }))
        return newOnes.length
      },
      clearCache: () => set({ articles: [], lastFetchAt: null }),
    }),
    { name: 'postcraft_articles_cache' }
  )
)
