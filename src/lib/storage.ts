import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'postcraft-media'

export async function uploadImageToStorage(
  dataUrl: string,
  filename: string,
): Promise<string> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (error) throw new Error(`Storage upload error: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return data.publicUrl
}

export async function uploadVideoToStorage(
  blob: Blob,
  filename: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, blob, {
      contentType: 'video/mp4',
      upsert: true,
    })

  if (error) throw new Error(`Storage upload error: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return data.publicUrl
}

export async function deleteFromStorage(filename: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([filename])
}
