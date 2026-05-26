const TOKEN_KEY = 'postcraft_google_token'
const EXPIRY_KEY = 'postcraft_google_token_expiry'

export function getGoogleAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setGoogleAccessToken(token: string, expiresIn: number) {
  localStorage.setItem(TOKEN_KEY, token)
  const expiry = Date.now() + expiresIn * 1000
  localStorage.setItem(EXPIRY_KEY, String(expiry))
}

export function clearGoogleAccessToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
}

export function isTokenValid(): boolean {
  const token = getGoogleAccessToken()
  const expiry = localStorage.getItem(EXPIRY_KEY)
  if (!token || !expiry) return false
  return Date.now() < parseInt(expiry) - 60000
}

export function startGoogleAuth() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    alert('VITE_GOOGLE_CLIENT_ID não configurado no .env')
    return
  }
  const redirectUri = `${window.location.origin}/auth/google`
  const scope = 'https://www.googleapis.com/auth/drive.file'

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope,
    prompt: 'consent',
    include_granted_scopes: 'true',
  })

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}
