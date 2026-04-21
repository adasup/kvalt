import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, Pressable,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { Project, ProjectStatus } from '@kvalt/shared'
import { apiFetch } from '../../../lib/auth.js'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  OFFER: 'Nabídka', APPROVED: 'Schváleno', IN_PROGRESS: 'Probíhá',
  HANDOVER: 'Předání', INVOICED: 'Fakturováno', PAID: 'Zaplaceno', CANCELLED: 'Zrušeno',
}

const STATUS_BG: Record<ProjectStatus, string> = {
  OFFER: '#F3F4F6', APPROVED: '#DBEAFE', IN_PROGRESS: '#FEF3C7',
  HANDOVER: '#FFEDD5', INVOICED: '#EDE9FE', PAID: '#D1FAE5', CANCELLED: '#FEE2E2',
}

const STATUS_TEXT: Record<ProjectStatus, string> = {
  OFFER: '#374151', APPROVED: '#1D4ED8', IN_PROGRESS: '#92400E',
  HANDOVER: '#C2410C', INVOICED: '#6D28D9', PAID: '#065F46', CANCELLED: '#991B1B',
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    apiFetch<Project[]>('/api/projects')
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Zakázky</Text>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/projects/${item.id}`)}
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{item.name}</Text>
              {item.clientName ? <Text style={styles.cardSub}>{item.clientName}</Text> : null}
              {item.address ? <Text style={styles.cardAddress}>{item.address}</Text> : null}
            </View>
            <View style={[styles.badge, { backgroundColor: STATUS_BG[item.status as ProjectStatus] }]}>
              <Text style={[styles.badgeText, { color: STATUS_TEXT[item.status as ProjectStatus] }]}>
                {STATUS_LABEL[item.status as ProjectStatus]}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Žádné zakázky</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', padding: 20, paddingBottom: 8 },
  list: { padding: 16, gap: 8 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderWidth: 1, borderColor: '#E5E7EB' },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  cardAddress: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, marginLeft: 8, flexShrink: 0 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9CA3AF', padding: 40 },
})
