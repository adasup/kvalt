import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { apiFetch } from '../lib/auth.js'

export function EarningsCard() {
  const [earnings, setEarnings] = useState<number | null>(null)

  useEffect(() => {
    const now = new Date()
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const to = now.toISOString().slice(0, 10)
    void apiFetch<{ total: number }>(`/api/attendance/me/earnings?from=${from}&to=${to}`)
      .then((data) => setEarnings(data.total))
      .catch(() => null)
  }, [])

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Výdělek tento měsíc</Text>
      <Text style={styles.amount}>
        {earnings === null ? '...' : `${Math.round(earnings).toLocaleString('cs-CZ')} Kč`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  amount: { fontSize: 28, fontWeight: '700', color: '#111827' },
})
