import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { apiFetch } from '../lib/auth'

interface TomorrowAssignment {
  id: string
  date: string
  startTime: string
  endTime: string
  description: string | null
  projectName: string
  projectAddress: string | null
  teamName: string | null
  teamColor: string | null
}

export function TomorrowCard({ refreshKey }: { refreshKey?: number }) {
  const [assignment, setAssignment] = useState<TomorrowAssignment | null | undefined>(undefined)

  useEffect(() => {
    apiFetch<TomorrowAssignment | null>('/api/assignments/me/tomorrow')
      .then(setAssignment)
      .catch(() => setAssignment(null))
  }, [refreshKey])

  if (assignment === undefined) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#6B7280" />
      </View>
    )
  }

  if (!assignment) {
    return (
      <View style={[styles.card, styles.empty]}>
        <Text style={styles.emptyText}>Zítra nemáš žádné přiřazení</Text>
        <Text style={styles.emptySubText}>Užij si volno 🎉</Text>
      </View>
    )
  }

  return (
    <View style={[styles.card, { borderLeftColor: assignment.teamColor ?? '#2563EB' }]}>
      <Text style={styles.label}>Zítra</Text>
      <Text style={styles.projectName}>{assignment.projectName}</Text>
      {assignment.projectAddress ? (
        <Text style={styles.address}>{assignment.projectAddress}</Text>
      ) : null}

      <View style={styles.row}>
        <View style={styles.timeChip}>
          <Text style={styles.timeText}>⏰ {assignment.startTime} – {assignment.endTime}</Text>
        </View>
        {assignment.teamName ? (
          <View style={[styles.teamChip, { backgroundColor: `${assignment.teamColor ?? '#2563EB'}20` }]}>
            <Text style={[styles.teamText, { color: assignment.teamColor ?? '#2563EB' }]}>
              {assignment.teamName}
            </Text>
          </View>
        ) : null}
      </View>

      {assignment.description ? (
        <Text style={styles.desc}>{assignment.description}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  empty: {
    borderLeftColor: '#D1D5DB',
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  emptySubText: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  label: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  projectName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  address: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  timeChip: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  timeText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  teamChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  teamText: { fontSize: 13, fontWeight: '600' },
  desc: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 },
})
