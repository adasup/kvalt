import { View, Text, StyleSheet } from 'react-native'

interface Member {
  userId: string
  fullName: string
  role: string
}

interface Props {
  name: string
  color?: string | null
  members: Member[]
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', FOREMAN: 'Parťák', WORKER: 'Dělník',
}

export function TeamCard({ name, color, members }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: color ?? '#6B7280' }]} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.count}>{members.length} členů</Text>
      </View>
      {members.map((m) => (
        <View key={m.userId} style={styles.member}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {m.fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <View>
            <Text style={styles.memberName}>{m.fullName}</Text>
            <Text style={styles.memberRole}>{ROLE_LABEL[m.role] ?? m.role}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  count: { fontSize: 12, color: '#9CA3AF' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  memberName: { fontSize: 13, fontWeight: '600', color: '#374151' },
  memberRole: { fontSize: 11, color: '#9CA3AF' },
})
