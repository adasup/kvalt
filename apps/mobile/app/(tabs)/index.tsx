import { ScrollView, Text, StyleSheet } from 'react-native'
import { TomorrowCard } from '../../components/TomorrowCard.js'
import { EarningsCard } from '../../components/EarningsCard.js'

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Dobrý den</Text>
      <TomorrowCard />
      <EarningsCard />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingTop: 16, paddingBottom: 32 },
  greeting: { fontSize: 26, fontWeight: '700', color: '#111827', paddingHorizontal: 20, marginBottom: 4 },
})
