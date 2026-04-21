import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'

interface AttendanceRecord {
  id: string
  userId: string
  projectId: string
  date: string
  checkIn: string
  checkOut: string | null
  type: string
  hoursWorked: number | null
  earnings: number | null
  approved: boolean
}

const TYPE_LABEL: Record<string, string> = {
  REGULAR: 'Řádná', OVERTIME: 'Přesčas', WEEKEND: 'Víkend',
  HOLIDAY: 'Svátek', TRAVEL: 'Cestovné',
}

export function AttendancePage() {
  const today = new Date()
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
  )
  const [projectId, setProjectId] = useState('')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void apiFetch<{ id: string; name: string }[]>('/api/projects').then(setProjects)
  }, [])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    const from = `${yearMonth}-01`
    const to = `${yearMonth}-31`
    void apiFetch<AttendanceRecord[]>(`/api/attendance/project/${projectId}?from=${from}&to=${to}`)
      .then(setRecords)
      .finally(() => setLoading(false))
  }, [projectId, yearMonth])

  async function approve(id: string) {
    await apiFetch(`/api/attendance/${id}/approve`, { method: 'PATCH' })
    setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, approved: true } : r)))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Docházka</h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">— Vyberte zakázku —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <a
          href={`/api/attendance/export/${yearMonth}`}
          className="ml-auto px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          download
        >
          Export CSV
        </a>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Načítám…</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Datum</th>
                <th className="px-4 py-3 text-left">Příchod</th>
                <th className="px-4 py-3 text-left">Odchod</th>
                <th className="px-4 py-3 text-left">Hodiny</th>
                <th className="px-4 py-3 text-left">Výdělek</th>
                <th className="px-4 py-3 text-left">Typ</th>
                <th className="px-4 py-3 text-left">Stav</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    {projectId ? 'Žádné záznamy' : 'Vyberte zakázku'}
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.date}</td>
                    <td className="px-4 py-3">{r.checkIn}</td>
                    <td className="px-4 py-3">{r.checkOut ?? '—'}</td>
                    <td className="px-4 py-3">{r.hoursWorked?.toFixed(1) ?? '—'}</td>
                    <td className="px-4 py-3">{r.earnings ? `${Math.round(r.earnings).toLocaleString('cs-CZ')} Kč` : '—'}</td>
                    <td className="px-4 py-3">{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="px-4 py-3">
                      {r.approved ? (
                        <span className="text-green-600 font-medium">✓ Schváleno</span>
                      ) : (
                        <span className="text-yellow-600">Čeká</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!r.approved && r.checkOut && (
                        <button
                          onClick={() => void approve(r.id)}
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Schválit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
