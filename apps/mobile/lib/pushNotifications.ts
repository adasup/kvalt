import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { apiFetch } from './auth'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(_token?: string): Promise<void> {
  if (!Device.isDevice) return

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return

  const pushToken = await Notifications.getExpoPushTokenAsync({
    projectId: process.env['EXPO_PUBLIC_PROJECT_ID'],
  })

  await apiFetch('/api/notifications/register-push', {
    method: 'POST',
    body: JSON.stringify({ pushToken: pushToken.data }),
  })
}
