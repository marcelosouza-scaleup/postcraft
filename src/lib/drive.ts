import type { DriveConfig, DriveUploadResult } from '@/types'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function createFolder(
  name: string,
  parentId: string | null,
  accessToken: string,
): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [],
    }),
  })
  if (!res.ok) throw new Error(`Drive createFolder error ${res.status}`)
  const data = await res.json()
  return data.id
}

export async function getOrCreateFolder(
  name: string,
  parentId: string | null,
  accessToken: string,
): Promise<string> {
  const safeName = escapeQueryValue(name)
  const query = parentId
    ? `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`

  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) throw new Error(`Drive search error ${res.status}`)
  const data = await res.json()

  if (data.files?.length > 0) return data.files[0].id
  return createFolder(name, parentId, accessToken)
}

export async function uploadFile(
  name: string,
  blob: Blob,
  _mimeType: string,
  folderId: string,
  accessToken: string,
  onProgress?: (pct: number) => void,
): Promise<{ id: string; webViewLink: string }> {
  return new Promise((resolve, reject) => {
    const metadata = JSON.stringify({
      name,
      parents: [folderId],
    })

    const formData = new FormData()
    formData.append('metadata', new Blob([metadata], { type: 'application/json' }))
    formData.append('file', blob, name)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        reject(new Error(`Drive upload error ${xhr.status}: ${xhr.responseText}`))
      }
    }

    xhr.onerror = () => reject(new Error('Drive upload network error'))
    xhr.send(formData)
  })
}

export async function uploadText(
  name: string,
  content: string,
  folderId: string,
  accessToken: string,
): Promise<{ id: string; webViewLink: string }> {
  const blob = new Blob([content], { type: 'text/plain' })
  return uploadFile(name, blob, 'text/plain', folderId, accessToken)
}

export async function makeFilePublic(
  fileId: string,
  accessToken: string,
): Promise<string> {
  await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  })
  return `https://drive.google.com/uc?id=${fileId}`
}

export async function savePostToDrive(
  post: {
    title: string
    caption: string
    imageDataUrl: string
    videoBlob?: Blob
  },
  driveConfig: DriveConfig,
  accessToken: string,
  onProgress: (step: string, pct: number) => void,
): Promise<DriveUploadResult> {
  onProgress('Preparando pasta...', 0)

  const today = new Date().toISOString().slice(0, 10)
  const safeTitle =
    post.title.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'post'

  const rootFolderId = await getOrCreateFolder(
    driveConfig.folderName || 'PostCraft',
    null,
    accessToken,
  )

  const parentId = driveConfig.subfolderByDate
    ? await getOrCreateFolder(today, rootFolderId, accessToken)
    : rootFolderId

  const postFolderId = await getOrCreateFolder(safeTitle, parentId, accessToken)

  onProgress('Salvando imagem...', 20)

  const imageRes = await fetch(post.imageDataUrl)
  const imageBlob = await imageRes.blob()

  const imageFile = await uploadFile(
    `${safeTitle}-feed.jpg`,
    imageBlob,
    'image/jpeg',
    postFolderId,
    accessToken,
    (pct) => onProgress('Salvando imagem...', 20 + pct * 0.3),
  )

  onProgress('Salvando legenda...', 55)

  const captionContent = `LEGENDA:\n\n${post.caption}\n\nGerado por PostCraft em ${new Date().toLocaleString('pt-BR')}`
  const captionFile = await uploadText(
    `${safeTitle}-legenda.txt`,
    captionContent,
    postFolderId,
    accessToken,
  )

  let videoFileId: string | undefined
  let videoUrl: string | undefined

  if (post.videoBlob) {
    onProgress('Salvando vídeo...', 65)
    const videoFile = await uploadFile(
      `${safeTitle}-reel.mp4`,
      post.videoBlob,
      'video/mp4',
      postFolderId,
      accessToken,
      (pct) => onProgress('Salvando vídeo...', 65 + Math.round(pct * 0.3)),
    )
    videoFileId = videoFile.id
    videoUrl = videoFile.webViewLink
  }

  onProgress('Finalizando...', 95)

  const folderUrl = `https://drive.google.com/drive/folders/${postFolderId}`

  return {
    imageFileId: imageFile.id,
    imageUrl: imageFile.webViewLink,
    videoFileId,
    videoUrl,
    captionFileId: captionFile.id,
    folderUrl,
  }
}
