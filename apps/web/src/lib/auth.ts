// PKCE OAuth flow for Zitadel Cloud

const ZITADEL_DOMAIN = import.meta.env['VITE_ZITADEL_DOMAIN'] as string
const CLIENT_ID = import.meta.env['VITE_ZITADEL_CLIENT_ID'] as string
const REDIRECT_URI = `${window.location.origin}/auth/callback`

function base64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function generatePkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  )
  return { verifier, challenge }
}

export async function startLogin() {
  const { verifier, challenge } = await generatePkce()
  sessionStorage.setItem('pkce_verifier', verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `https://${ZITADEL_DOMAIN}/oauth/v2/authorize?${params}`
}

export async function handleCallback(code: string): Promise<string> {
  const verifier = sessionStorage.getItem('pkce_verifier')
  if (!verifier) throw new Error('Missing PKCE verifier')

  const res = await fetch(`https://${ZITADEL_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: verifier,
    }),
  })

  if (!res.ok) throw new Error('Token exchange failed')
  const data = await res.json() as { access_token: string }
  sessionStorage.removeItem('pkce_verifier')
  return data.access_token
}

export async function refreshToken(refreshTkn: string): Promise<string> {
  const res = await fetch(`https://${ZITADEL_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshTkn,
    }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export function logout() {
  localStorage.removeItem('access_token')
  sessionStorage.clear()
  window.location.href = `https://${ZITADEL_DOMAIN}/oidc/v1/end_session?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`
}

export function getToken(): string | null {
  return localStorage.getItem('access_token')
}

export function saveToken(token: string) {
  localStorage.setItem('access_token', token)
}
