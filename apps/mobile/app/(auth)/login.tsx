import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { saveTokens } from '../../lib/auth'
import { registerForPushNotifications } from '../../lib/pushNotifications'

WebBrowser.maybeCompleteAuthSession()

const ZITADEL_DOMAIN = process.env['EXPO_PUBLIC_ZITADEL_DOMAIN']!
const CLIENT_ID = process.env['EXPO_PUBLIC_ZITADEL_CLIENT_ID']!

const discovery = {
  authorizationEndpoint: `https://${ZITADEL_DOMAIN}/oauth/v2/authorize`,
  tokenEndpoint: `https://${ZITADEL_DOMAIN}/oauth/v2/token`,
  revocationEndpoint: `https://${ZITADEL_DOMAIN}/oauth/v2/revoke`,
}

export default function LoginScreen() {
  const router = useRouter()
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kvalt' })

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      usePKCE: true,
    },
    discovery,
  )

  // Handle response
  if (response?.type === 'success') {
    const { code } = response.params
    void AuthSession.exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        redirectUri,
        code,
        extraParams: { code_verifier: request?.codeVerifier ?? '' },
      },
      discovery,
    ).then(async (tokens) => {
      await saveTokens(tokens.accessToken, tokens.refreshToken ?? undefined)
      await registerForPushNotifications(tokens.accessToken)
      router.replace('/(tabs)/')
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kvalt</Text>
      <Text style={styles.subtitle}>Řízení stavební firmy</Text>
      <Pressable
        style={styles.button}
        disabled={!request}
        onPress={() => void promptAsync()}
      >
        <Text style={styles.buttonText}>Přihlásit se</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  title: { fontSize: 32, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4, marginBottom: 32 },
  button: { backgroundColor: '#2563EB', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10, width: '100%', alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
})
