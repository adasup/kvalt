import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, Pressable,
  TextInput, ActivityIndicator, StyleSheet, Alert,
} from 'react-native'
import type { Budget } from '@kvalt/shared'
import { apiFetch } from '../../../lib/auth.js'

export default function BudgetScreen() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [parsing, setParsing] = useState(false)
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<Budget[]>('/api/budgets')
      .then(setBudgets)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleParse() {
    if (!activeBudgetId || !transcript.trim()) return
    setParsing(true)
    try {
      await apiFetch(`/api/budgets/${activeBudgetId}/parse`, {
        method: 'POST',
        body: JSON.stringify({ text: transcript }),
      })
      setTranscript('')
      Alert.alert('Hotovo', 'Položky byly zpracovány')
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se zpracovat text')
    } finally {
      setParsing(false)
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rozpočty</Text>

      {activeBudgetId ? (
        <View style={styles.parseBox}>
          <Text style={styles.label}>Diktát pro {budgets.find((b) => b.id === activeBudgetId)?.name}</Text>
          <TextInput
            style={styles.textArea}
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Napište nebo nadiktujte položky…"
            multiline
            numberOfLines={4}
          />
          <View style={styles.row}>
            <Pressable style={styles.cancelBtn} onPress={() => setActiveBudgetId(null)}>
              <Text style={styles.cancelText}>Zrušit</Text>
            </Pressable>
            <Pressable style={[styles.parseBtn, parsing && styles.disabled]} onPress={() => void handleParse()} disabled={parsing}>
              <Text style={styles.parseText}>{parsing ? 'Zpracování…' : 'Zpracovat AI'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setActiveBudgetId(item.id)}>
              <View>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardSub}>{item.totalWithoutVat.toLocaleString('cs-CZ')} Kč bez DPH</Text>
              </View>
              <Text style={[styles.badge, item.status === 'DONE' ? styles.badgeDone : styles.badgeDraft]}>
                {item.status === 'DONE' ? 'Hotový' : 'Rozpracovaný'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Žádné rozpočty</Text>}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', padding: 20, paddingBottom: 8 },
  list: { padding: 16, gap: 8 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  badge: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeDone: { backgroundColor: '#D1FAE5', color: '#065F46' },
  badgeDraft: { backgroundColor: '#FEF3C7', color: '#92400E' },
  empty: { textAlign: 'center', color: '#9CA3AF', padding: 40 },
  parseBox: { margin: 16, backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' },
  textArea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, minHeight: 100, textAlignVertical: 'top', fontSize: 14 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cancelBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  cancelText: { color: '#374151', fontWeight: '600' },
  parseBtn: { flex: 2, padding: 10, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center' },
  parseText: { color: '#FFF', fontWeight: '600' },
  disabled: { opacity: 0.5 },
})
