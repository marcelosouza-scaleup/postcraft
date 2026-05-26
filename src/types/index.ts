export type TemplateTone = 'urgency' | 'energy' | 'tip' | 'story' | 'calm'
export type LayoutId = 'center' | 'left' | 'bold-single'
export type ElementId = 'none' | 'lines' | 'dots' | 'circle' | 'grid' | 'corner' | 'number'
export type SizeId = 'xl' | 'lg' | 'md'
export type FormatId = 'feed' | 'story'

export interface Template {
  id: string
  label: string
  bg1: string
  bg2: string
  accent: string
  text: string
  highlight: string
  logoBg: string
  logoText: string
  tone: TemplateTone
}

export type BackgroundType = 'none' | 'color' | 'photo' | 'video'

export interface PexelsPhoto {
  id: number
  url: string
  src: {
    large2x: string
    large: string
    medium: string
  }
  photographer: string
  alt: string
}

export interface PexelsVideo {
  id: number
  url: string
  duration: number
  user: string
  videoFiles: {
    link: string
    width: number
    height: number
    fileType: string
  }[]
}

export interface TemplateConfig {
  template: Template
  layout: LayoutId
  element: ElementId
  format: FormatId
  backgroundType?: BackgroundType
  backgroundQuery?: string
  backgroundMediaUrl?: string
  backgroundMediaCredit?: string
}

export interface GeneratedVariation {
  dataUrl: string
  config: TemplateConfig
  format: FormatId
}

// ── Video types ──────────────────────────────────────────────────────────────

export type TransitionType = 'cut' | 'fade' | 'crossfade' | 'wipe-left' | 'zoom'

export type VideoStyle =
  | 'points'
  | 'carousel'
  | 'bullets'
  | 'headline'
  | 'stats'

export interface VideoTransition {
  type: TransitionType
  durationSeconds: number
}

export interface VideoPhase {
  id: string
  label: string
  durationSeconds: number
  enabled: boolean
}

export interface VideoPoint {
  text: string
  emoji?: string
}

export interface VideoConfig {
  hook: string
  points: VideoPoint[]
  cta: string
  handle: string
  phases: VideoPhase[]
  templateId: string
  fps: 24 | 30
  style: VideoStyle
  backgroundVideoUrl?: string
  backgroundVideoCredit?: string
  backgroundVideoQuery?: string
  backgroundVideoUrl2?: string
  backgroundVideoCredit2?: string
  backgroundVideoQuery2?: string
  transition?: VideoTransition
}

export interface GeneratedVideo {
  blob: Blob
  url: string
  config: VideoConfig
  durationSeconds: number
}

// ── Drive ────────────────────────────────────────────────────────────────────

export interface DriveConfig {
  folderId: string
  folderName: string
  subfolderByDate: boolean
}

export interface DriveUploadResult {
  imageFileId: string
  imageUrl: string
  videoFileId?: string
  videoUrl?: string
  captionFileId: string
  folderUrl: string
}

// ── Instagram ────────────────────────────────────────────────────────────────

export interface InstagramPublishResult {
  mediaId: string
  permalink: string
}

// ── Queue ────────────────────────────────────────────────────────────────────

export interface QueuePost {
  id: string
  title: string
  body: string
  status: 'pending' | 'generating' | 'done' | 'error'
  caption: string
  imageUrl: string
  imagePrompt: string
  error: string
  variations: GeneratedVariation[]
  selectedVariation: number
  videoConfig: VideoConfig | null
  generatedVideo: GeneratedVideo | null
  driveResult?: DriveUploadResult
  instagramResult?: InstagramPublishResult
}

export type TextProvider = 'openai' | 'gemini' | 'openrouter'

export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  openaiKey: string
  geminiKey: string
  openrouterKey: string
  openrouterModel: string
  pexelsKey: string
  aiProvider: TextProvider
  instagramHandle: string
  driveConfig?: DriveConfig
}

export interface SupabaseConnection {
  url: string
  anonKey: string
  tables: string[]
}
