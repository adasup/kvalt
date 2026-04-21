import { useEffect, useState } from 'react'
import { Stack, useRouter } from 'expo-router'
import { getAccessToken } from '../lib/auth.js'

export default function RootLayout() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    void getAccessToken().then((token) => {
      setChecked(true)
      if (token) {
        router.replace('/(tabs)/')
      } else {
        router.replace('/(auth)/login')
      }
    })
  }, [])

  if (!checked) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}
