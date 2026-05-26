import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setGoogleAccessToken } from '@/lib/googleAuth'

export function GoogleAuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const token = params.get('access_token')
    const expiresIn = parseInt(params.get('expires_in') || '3600')

    if (token) {
      setGoogleAccessToken(token, expiresIn)
      navigate('/setup', { replace: true })
    } else {
      navigate('/setup?error=google_auth', { replace: true })
    }
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-sm text-neutral-500">Conectando com Google Drive...</p>
    </div>
  )
}
