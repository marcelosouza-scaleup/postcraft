import { create } from 'zustand'
import type { QueuePost } from '@/types'

interface QueueStore {
  posts: QueuePost[]
  addPosts: (posts: Omit<QueuePost, 'status' | 'caption' | 'imageUrl' | 'imagePrompt' | 'error' | 'variations' | 'selectedVariation' | 'videoConfig' | 'generatedVideo'>[]) => void
  updatePost: (id: string, patch: Partial<QueuePost>) => void
  removePost: (id: string) => void
  clearDone: () => void
}

export const useQueueStore = create<QueueStore>((set) => ({
  posts: [],
  addPosts: (incoming) =>
    set((state) => {
      const existingIds = new Set(state.posts.map((p) => p.id))
      const newPosts: QueuePost[] = incoming
        .filter((p) => !existingIds.has(p.id))
        .map((p) => ({
          ...p,
          status: 'pending',
          caption: '',
          imageUrl: '',
          imagePrompt: '',
          error: '',
          variations: [],
          selectedVariation: 0,
          videoConfig: null,
          generatedVideo: null,
        }))
      return { posts: [...state.posts, ...newPosts] }
    }),
  updatePost: (id, patch) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  removePost: (id) =>
    set((state) => ({ posts: state.posts.filter((p) => p.id !== id) })),
  clearDone: () =>
    set((state) => ({ posts: state.posts.filter((p) => p.status !== 'done') })),
}))
