import { ScrollView, Text, StyleSheet, RefreshControl, Linking, Pressable } from 'react-native'
import { useState } from 'react'
import { TomorrowCard } from '../../../components/TomorrowCard.js'

export default function PlanningScreen() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  async function onRefresh() {
    setRefreshing(true)
    setRefreshKey((k) => k + 1)
    // small delay so TomorrowCard re-mounts with new key
    await new Promise((r) => setTimeout(r, 500))
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={styles.title}>Zítřejší plán</Text>
      <TomorrowCard key={refreshKey} refreshKey={refreshKey} />
      <Pressable
        style={styles.mapsBtn}
        onPress={() => {
          void Linking.openURL('https://maps.google.com')
        }}
      >
        <Text style={styles.mapsBtnText}>Otevřít v Mapách</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827', paddingHorizontal: 20, paddingTop: 16, marginBottom: 4 },
  mapsBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  mapsBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
})
