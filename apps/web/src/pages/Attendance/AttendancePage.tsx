import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import { Download, CheckCircle, Clock } from 'lucide-react'

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
  REGULAR: 'Řádná', OVERTIME: 'Přesčas', WEEKEND: 'Víkend', HOLIDAY: 'Svátek', TRAVEL: 'Cestovné',
}

const inputCls = 'border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

export function AttendancePage() {
  const today = new Date()
  const [yearMonth, setYearMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  const [projectId, setProjectId] = useState('')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { void apiFetch<{ id: string; name: string }[]>('/api/projects').then(setProjects) }, [])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    const from = `${yearMonth}-01`
    const to = `${yearMonth}-31`
    void apiFetch<AttendanceRecord[]>(`/api/attendance/project/${projectId}?from=${from}&to=${to}`)
      .then(setRecords).finally(() => setLoading(false))
  }, [projectId, yearMonth])

  async function approve(id: string) {
    await apiFetch(`/api/attendance/${id}/approve`, { method: 'PATCH' })
    setRecords((rs) => rs.map((r) => r.id === id ? { ...r, approved: true } : r))
  }

  const totalHours = records.reduce((s, r) => s + (r.hoursWorked ?? 0), 0)
  const totalEarnings = records.reduce((s, r) => s + (r.earnings ?? 0), 0)
  const pending = records.filter((r) => !r.approved && r.checkOut).length

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Docházka</h1>
          <p className="text-sm text-gray-500 mt-0.5">Přehled a schvalování docházky</p>
        </div>
        {projectId && (
          <a href={`/api/attendance/export/${yearMonth}`} download
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors bg-white">
            <Download size={15} /> Export CSV
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
          <option value="">— Vyberte zakázku —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className={inputCls} />
      </div>

      {/* Summary cards */}
      {projectId && !loading && records.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Celkem hodin', value: `${totalHours.toFixed(1)} h`, icon: Clock, color: 'bg-blue-500' },
            { label: 'Celkem výdělky', value: `${Math.round(totalEarnings).toLocaleString('cs-CZ')} Kč`, icon: CheckCircle, color: 'bg-emerald-500' },
            { label: 'Čeká na schválení', value: String(pending), icon: Clock, color: pending > 0 ? 'bg-amber-500' : 'bg-gray-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center mb-3`}>
                <Icon size={16} className="text-white" />
              </div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Načítám…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Datum', 'Příchod', 'Odchod', 'Hodiny', 'Výdělek', 'Typ', 'Stav', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-sm text-gray-400">
                  {projectId ? 'Žádné záznamy za tento měsíc' : 'Vyberte zakázku'}
                </td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{r.date}</td>
                  <td className="px-5 py-3.5 text-gray-600">{r.checkIn}</td>
                  <td className="px-5 py-3.5 text-gray-600">{r.checkOut ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600">{r.hoursWorked?.toFixed(1) ?? '—'}</td>
                  <td className="px-5 py-3.5 font-medium">{r.earnings ? `${Math.round(r.earnings).toLocaleString('cs-CZ')} Kč` : '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-medium">{TYPE_LABEL[r.type] ?? r.type}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.approved
                      ? <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"><CheckCircle size={13} />Schváleno</span>
                      : <span className="text-xs text-amber-600 font-medium">Čeká</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {!r.approved && r.checkOut && (
                      <button onClick={() => void approve(r.id)}
                        className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                        Schválit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
