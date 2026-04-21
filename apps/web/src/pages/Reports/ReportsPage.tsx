import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'

interface Profitability {
  revenue: number
  labourCost: number
  profit: number
  margin: number
}

interface EmployeeEarnings {
  userId: string
  fullName: string
  totalHours: number
  totalEarnings: number
}

export function ReportsPage() {
  const today = new Date()
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
  )
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [profitability, setProfitability] = useState<Profitability | null>(null)
  const [earnings, setEarnings] = useState<EmployeeEarnings[]>([])

  useEffect(() => {
    void apiFetch<{ id: string; name: string }[]>('/api/projects').then(setProjects)
  }, [])

  useEffect(() => {
    void apiFetch<EmployeeEarnings[]>(`/api/reports/earnings/${yearMonth}`).then(setEarnings)
  }, [yearMonth])

  useEffect(() => {
    if (!projectId) return
    void apiFetch<Profitability>(`/api/reports/projects/${projectId}/profitability`).then(setProfitability)
  }, [projectId])

  const totalEarnings = earnings.reduce((s, e) => s + e.totalEarnings, 0)
  const totalHours = earnings.reduce((s, e) => s + e.totalHours, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reporty</h1>

      {/* Monthly earnings */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Měsíční výdělky zaměstnanců</h2>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Celkové výdělky" value={`${Math.round(totalEarnings).toLocaleString('cs-CZ')} Kč`} />
          <Stat label="Celkové hodiny" value={`${totalHours.toFixed(1)} h`} />
          <Stat label="Zaměstnanců" value={String(earnings.length)} />
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Zaměstnanec</th>
              <th className="px-3 py-2 text-right">Hodiny</th>
              <th className="px-3 py-2 text-right">Výdělek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {earnings.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">Žádné záznamy</td></tr>
            ) : (
              earnings.map((e) => (
                <tr key={e.userId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{e.fullName}</td>
                  <td className="px-3 py-2 text-right">{e.totalHours.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{Math.round(e.totalEarnings).toLocaleString('cs-CZ')} Kč</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Project profitability */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Ziskovost zakázky</h2>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">— Vyberte zakázku —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {profitability && projectId ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Tržby" value={`${Math.round(profitability.revenue).toLocaleString('cs-CZ')} Kč`} />
            <Stat label="Náklady práce" value={`${Math.round(profitability.labourCost).toLocaleString('cs-CZ')} Kč`} accent="red" />
            <Stat label="Zisk" value={`${Math.round(profitability.profit).toLocaleString('cs-CZ')} Kč`} accent={profitability.profit >= 0 ? 'green' : 'red'} />
            <Stat label="Marže" value={`${profitability.margin.toFixed(1)} %`} accent={profitability.margin >= 20 ? 'green' : 'yellow'} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">Vyberte zakázku</p>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' | 'yellow' }) {
  const color = accent === 'green' ? 'text-green-600' : accent === 'red' ? 'text-red-600' : accent === 'yellow' ? 'text-yellow-600' : 'text-gray-900'
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
