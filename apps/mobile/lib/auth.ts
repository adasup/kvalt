import * as SecureStore from 'expo-secure-store'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:8787'
const ZITADEL_DOMAIN = process.env['EXPO_PUBLIC_ZITADEL_DOMAIN'] ?? ''
const CLIENT_ID = process.env['EXPO_PUBLIC_ZITADEL_CLIENT_ID'] ?? ''

const KEY_ACCESS_TOKEN = 'kvalt_access_token'
const KEY_REFRESH_TOKEN = 'kvalt_refresh_token'

export async function saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, accessToken)
  if (refreshToken) {
    await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, refreshToken)
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_ACCESS_TOKEN)
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN)
  await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN)
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(KEY_REFRESH_TOKEN)
  if (!refreshToken) return null

  const res = await fetch(`https://${ZITADEL_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!res.ok) return null

  const data = await res.json() as { access_token: string; refresh_token?: string }
  await saveTokens(data.access_token, data.refresh_token)
  return data.access_token
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init?.headers,
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })

  if (res.status === 401) {
    // Try to refresh
    const newToken = await refreshAccessToken()
    if (!newToken) {
      await clearTokens()
      throw new Error('Unauthorized — session expired')
    }

    const retryHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${newToken}`,
      ...init?.headers,
    }
    const retryRes = await fetch(`${API_URL}${path}`, { ...init, headers: retryHeaders })
    if (retryRes.status === 401) {
      await clearTokens()
      throw new Error('Unauthorized — session expired')
    }
    if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status}`)
    return retryRes.json() as Promise<T>
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}
