const IG_API = 'https://graph.instagram.com/v21.0'
const ACCOUNT_ID = import.meta.env.VITE_INSTAGRAM_ACCOUNT_ID
const ACCESS_TOKEN = import.meta.env.VITE_INSTAGRAM_ACCESS_TOKEN

export type PublishType = 'IMAGE' | 'REELS'

export interface PublishOptions {
  type: PublishType
  mediaUrl: string
  caption: string
}

export interface PublishResult {
  mediaId: string
  permalink?: string
}

async function createContainer(opts: PublishOptions): Promise<string> {
  const body: Record<string, string> = {
    caption: opts.caption,
    access_token: ACCESS_TOKEN,
  }

  if (opts.type === 'IMAGE') {
    body.image_url = opts.mediaUrl
  } else {
    body.media_type = 'REELS'
    body.video_url = opts.mediaUrl
  }

  const res = await fetch(`${IG_API}/${ACCOUNT_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (data.error) throw new Error(`IG container error: ${data.error.message}`)
  return data.id
}

async function waitForContainer(
  containerId: string,
  onStatus?: (status: string) => void,
): Promise<void> {
  const maxAttempts = 30
  const interval = 4000

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval))

    const res = await fetch(
      `${IG_API}/${containerId}?fields=status_code&access_token=${ACCESS_TOKEN}`,
    )
    const data = await res.json()
    const status = data.status_code

    onStatus?.(status)

    if (status === 'FINISHED') return
    if (status === 'ERROR') throw new Error('Container falhou no processamento da Meta')
    if (status === 'EXPIRED') throw new Error('Container expirou — tente novamente')
  }

  throw new Error('Timeout: container não ficou pronto em 2 minutos')
}

async function publishContainer(containerId: string): Promise<string> {
  const res = await fetch(`${IG_API}/${ACCOUNT_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: ACCESS_TOKEN,
    }),
  })

  const data = await res.json()
  if (data.error) throw new Error(`IG publish error: ${data.error.message}`)
  return data.id
}

async function getPermalink(mediaId: string): Promise<string> {
  const res = await fetch(
    `${IG_API}/${mediaId}?fields=permalink&access_token=${ACCESS_TOKEN}`,
  )
  const data = await res.json()
  return data.permalink || ''
}

export async function publishToInstagram(
  opts: PublishOptions,
  onStep: (step: string) => void,
): Promise<PublishResult> {
  onStep('Criando container de mídia...')
  const containerId = await createContainer(opts)

  onStep('Aguardando processamento da Meta...')
  await waitForContainer(containerId, (status) => {
    onStep(`Processando: ${status.toLowerCase().replace('_', ' ')}...`)
  })

  onStep('Publicando...')
  const mediaId = await publishContainer(containerId)

  onStep('Buscando link do post...')
  const permalink = await getPermalink(mediaId)

  return { mediaId, permalink }
}

export interface PublishingLimit {
  quota_usage: number
  config: { quota_total: number; quota_duration: number }
}

export async function checkPublishingLimit(): Promise<PublishingLimit> {
  const res = await fetch(
    `${IG_API}/${ACCOUNT_ID}/content_publishing_limit?fields=quota_usage,config&access_token=${ACCESS_TOKEN}`,
  )
  const data = await res.json()
  return (
    data.data?.[0] || {
      quota_usage: 0,
      config: { quota_total: 100, quota_duration: 86400 },
    }
  )
}
