import { useEffect, useState } from 'react'
import { ScrollView, View, Text, StyleSheet, RefreshControl, Pressable } from 'react-native'
import { EarningsCard } from '../../../components/EarningsCard.js'
import { CheckInButton } from '../../../components/CheckInButton.js'
import { apiFetch } from '../../../lib/auth.js'

interface AttendanceRecord {
  id: string
  date: string
  checkIn: string
  checkOut: string | null
  hoursWorked: number | null
  earnings: number | null
  type: string
  approved: boolean
}

interface Project {
  id: string
  name: string
  clientName?: string | null
}

interface TomorrowAssignment {
  projectId: string
}

export default function AttendanceScreen() {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const monthStart = `${today.slice(0, 7)}-01`

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [showPicker, setShowPicker] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const res = await apiFetch<AttendanceRecord[]>(`/api/attendance/me?from=${monthStart}&to=${today}`)
      setRecords(res)
    } catch {}
  }

  async function loadProjects() {
    try {
      const res = await apiFetch<Project[]>('/api/projects')
      setProjects(res)
    } catch {}
  }

  async function loadTomorrow() {
    try {
      const assignment = await apiFetch<TomorrowAssignment | null>('/api/assignments/me/tomorrow')
      if (assignment?.projectId) {
        setSelectedProjectId(assignment.projectId)
      }
    } catch {}
  }

  useEffect(() => {
    void Promise.all([load(), loadProjects(), loadTomorrow()])
  }, [])

  async function onRefresh() {
    setRefreshing(true)
    await Promise.all([load(), loadProjects()])
    setRefreshing(false)
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={styles.title}>Docházka</Text>
      <EarningsCard />

      {/* Project picker */}
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Zakázka</Text>
        <Pressable style={styles.pickerButton} onPress={() => setShowPicker((v) => !v)}>
          <Text style={styles.pickerButtonText}>
            {selectedProject ? selectedProject.name : 'Vyberte zakázku…'}
          </Text>
          <Text style={styles.pickerChevron}>{showPicker ? '▲' : '▼'}</Text>
        </Pressable>
        {showPicker && (
          <View style={styles.pickerList}>
            {projects.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.pickerItem, p.id === selectedProjectId && styles.pickerItemSelected]}
                onPress={() => {
                  setSelectedProjectId(p.id)
                  setShowPicker(false)
                }}
              >
                <Text style={[styles.pickerItemText, p.id === selectedProjectId && styles.pickerItemTextSelected]}>
                  {p.name}
                </Text>
                {p.clientName ? <Text style={styles.pickerItemSub}>{p.clientName}</Text> : null}
              </Pressable>
            ))}
            {projects.length === 0 && (
              <Text style={styles.pickerEmpty}>Žádné zakázky</Text>
            )}
          </View>
        )}
      </View>

      {selectedProjectId ? (
        <CheckInButton
          projectId={selectedProjectId}
          date={today}
          onCheckedOut={() => void load()}
        />
      ) : (
        <View style={styles.noProjectHint}>
          <Text style={styles.noProjectText}>Vyberte zakázku pro zaznamenání docházky</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Tento měsíc</Text>
      {records.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.date}>{r.date}</Text>
            <Text style={styles.time}>{r.checkIn} – {r.checkOut ?? '…'}</Text>
          </View>
          <View style={styles.rowRight}>
            {r.hoursWorked !== null && (
              <Text style={styles.hours}>{r.hoursWorked.toFixed(1)} h</Text>
            )}
            {r.earnings !== null && (
              <Text style={styles.earnings}>{Math.round(r.earnings).toLocaleString('cs-CZ')} Kč</Text>
            )}
            {r.approved && <Text style={styles.approved}>✓</Text>}
          </View>
        </View>
      ))}
      {records.length === 0 && (
        <Text style={styles.empty}>Žádné záznamy tento měsíc.</Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827', paddingHorizontal: 20, paddingTop: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', paddingHorizontal: 20, marginTop: 16, marginBottom: 8 },
  pickerContainer: { marginHorizontal: 20, marginVertical: 8 },
  pickerLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  pickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  pickerButtonText: { fontSize: 15, color: '#111827', flex: 1 },
  pickerChevron: { fontSize: 12, color: '#6B7280', marginLeft: 8 },
  pickerList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerItemSelected: { backgroundColor: '#EFF6FF' },
  pickerItemText: { fontSize: 15, color: '#111827' },
  pickerItemTextSelected: { color: '#2563EB', fontWeight: '600' },
  pickerItemSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  pickerEmpty: { padding: 14, color: '#9CA3AF', textAlign: 'center' },
  noProjectHint: { marginHorizontal: 20, marginVertical: 8, padding: 16, backgroundColor: '#FEF9C3', borderRadius: 10 },
  noProjectText: { color: '#92400E', fontSize: 14, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 8, padding: 14, borderRadius: 10 },
  rowLeft: {},
  rowRight: { alignItems: 'flex-end' },
  date: { fontSize: 14, fontWeight: '600', color: '#111827' },
  time: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  hours: { fontSize: 15, fontWeight: '600', color: '#2563EB' },
  earnings: { fontSize: 13, color: '#374151' },
  approved: { fontSize: 12, color: '#16A34A', marginTop: 2 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 32 },
})
