import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { apiFetch } from '../lib/auth.js'

interface Props {
  projectId: string
  date: string
  onCheckedIn?: (attendanceId: string) => void
  onCheckedOut?: () => void
}

type State = 'idle' | 'checked_in' | 'loading'

export function CheckInButton({ projectId, date, onCheckedIn, onCheckedOut }: Props) {
  const [state, setState] = useState<State>('idle')
  const [attendanceId, setAttendanceId] = useState<string | null>(null)

  async function handleCheckIn() {
    setState('loading')
    try {
      const now = new Date()
      const checkIn = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const record = await apiFetch<{ id: string }>('/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ projectId, date, checkIn, type: 'REGULAR' }),
      })
      setAttendanceId(record.id)
      setState('checked_in')
      onCheckedIn?.(record.id)
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Nepodařilo se zaznamenat příchod')
      setState('idle')
    }
  }

  async function handleCheckOut() {
    if (!attendanceId) return
    setState('loading')
    try {
      const now = new Date()
      const checkOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      await apiFetch(`/api/attendance/check-out/${attendanceId}`, {
        method: 'POST',
        body: JSON.stringify({ checkOut }),
      })
      setState('idle')
      setAttendanceId(null)
      onCheckedOut?.()
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se zaznamenat odchod')
      setState('checked_in')
    }
  }

  if (state === 'loading') {
    return (
      <View style={[styles.button, styles.loading]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  if (state === 'checked_in') {
    return (
      <Pressable style={[styles.button, styles.checkOut]} onPress={() => void handleCheckOut()}>
        <Text style={styles.buttonText}>Odhlásit se</Text>
        <Text style={styles.subText}>Zaznamenat odchod</Text>
      </Pressable>
    )
  }

  return (
    <Pressable style={[styles.button, styles.checkIn]} onPress={() => void handleCheckIn()}>
      <Text style={styles.buttonText}>Přihlásit se</Text>
      <Text style={styles.subText}>Zaznamenat příchod</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 8,
  },
  checkIn: { backgroundColor: '#16A34A' },
  checkOut: { backgroundColor: '#DC2626' },
  loading: { backgroundColor: '#9CA3AF' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
})
