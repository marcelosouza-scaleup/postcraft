import { create } from 'zustand'
import type { AppConfig } from '@/types'

const STORAGE_KEY = 'postcraft_config'

function loadFromStorage(): Partial<AppConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const envDefaults: Partial<AppConfig> = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  openaiKey: import.meta.env.VITE_OPENAI_KEY || '',
  geminiKey: import.meta.env.VITE_GEMINI_KEY || '',
  openrouterKey: import.meta.env.VITE_OPENROUTER_KEY || '',
  pexelsKey: import.meta.env.VITE_PEXELS_KEY || '',
}

const stored = loadFromStorage()

const defaults: AppConfig = {
  supabaseUrl: stored.supabaseUrl || envDefaults.supabaseUrl || '',
  supabaseAnonKey: stored.supabaseAnonKey || envDefaults.supabaseAnonKey || '',
  openaiKey: stored.openaiKey || envDefaults.openaiKey || '',
  geminiKey: stored.geminiKey || envDefaults.geminiKey || '',
  openrouterKey: stored.openrouterKey || envDefaults.openrouterKey || '',
  openrouterModel: stored.openrouterModel || 'google/gemini-flash-1.5',
  pexelsKey: stored.pexelsKey || envDefaults.pexelsKey || '',
  aiProvider: stored.aiProvider || 'openai',
  instagramHandle: stored.instagramHandle || '',
  driveConfig: stored.driveConfig,
}

const emptyConfig: AppConfig = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  openaiKey: '',
  geminiKey: '',
  openrouterKey: '',
  openrouterModel: 'google/gemini-flash-1.5',
  pexelsKey: '',
  aiProvider: 'openai',
  instagramHandle: '',
}

interface ConfigStore {
  config: AppConfig
  setConfig: (patch: Partial<AppConfig>) => void
  clearConfig: () => void
  isConfigured: () => boolean
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: defaults,
  setConfig: (patch) => {
    const next = { ...get().config, ...patch }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    set({ config: next })
  },
  clearConfig: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ config: emptyConfig })
  },
  isConfigured: () => {
    const { config } = get()
    return !!(config.supabaseUrl && config.supabaseAnonKey)
  },
}))
