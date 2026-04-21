import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback, saveToken } from '../lib/auth.js'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      setError('Chybí autorizační kód')
      return
    }

    handleCallback(code)
      .then((token) => {
        saveToken(token)
        navigate('/', { replace: true })
      })
      .catch((e: Error) => setError(e.message))
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Přihlášení selhalo: {error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Přihlašování...</p>
    </div>
  )
}
