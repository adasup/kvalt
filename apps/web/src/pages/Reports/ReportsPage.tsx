import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import { TrendingUp, TrendingDown, Users, Clock } from 'lucide-react'

interface Profitability { revenue: number; labourCost: number; profit: number; margin: number }
interface EmployeeEarnings { userId: string; fullName: string; totalHours: number; totalEarnings: number }

const inputCls = 'border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'green' | 'red' | 'yellow' | 'blue' }) {
  const colors = { green: 'text-emerald-600', red: 'text-red-600', yellow: 'text-amber-600', blue: 'text-blue-600' }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ? colors[accent] : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export function ReportsPage() {
  const today = new Date()
  const [yearMonth, setYearMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [profitability, setProfitability] = useState<Profitability | null>(null)
  const [earnings, setEarnings] = useState<EmployeeEarnings[]>([])

  useEffect(() => { void apiFetch<{ id: string; name: string }[]>('/api/projects').then(setProjects) }, [])
  useEffect(() => { void apiFetch<EmployeeEarnings[]>(`/api/reports/earnings/${yearMonth}`).then(setEarnings) }, [yearMonth])
  useEffect(() => {
    if (!projectId) return
    void apiFetch<Profitability>(`/api/reports/projects/${projectId}/profitability`).then(setProfitability)
  }, [projectId])

  const totalEarnings = earnings.reduce((s, e) => s + e.totalEarnings, 0)
  const totalHours = earnings.reduce((s, e) => s + e.totalHours, 0)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reporty</h1>
        <p className="text-sm text-gray-500 mt-0.5">Přehledy výdělků a ziskovosti</p>
      </div>

      {/* Monthly earnings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Měsíční výdělky zaměstnanců</h2>
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className={inputCls} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Celkové výdělky" value={`${Math.round(totalEarnings).toLocaleString('cs-CZ')} Kč`} accent="blue" />
          <StatCard label="Celkové hodiny" value={`${totalHours.toFixed(1)} h`} />
          <StatCard label="Zaměstnanců" value={String(earnings.length)} sub="s aktivní docházkou" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Zaměstnanec</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Hodiny</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Výdělek</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Průměr/h</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {earnings.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">
                  <Users size={28} className="mx-auto mb-2 text-gray-200" />
                  Žádné záznamy za tento měsíc
                </td></tr>
              ) : earnings.map((e) => (
                <tr key={e.userId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{e.fullName}</td>
                  <td className="px-5 py-3.5 text-right text-gray-600">
                    <span className="flex items-center justify-end gap-1.5"><Clock size={12} className="text-gray-400" />{e.totalHours.toFixed(1)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{Math.round(e.totalEarnings).toLocaleString('cs-CZ')} Kč</td>
                  <td className="px-5 py-3.5 text-right text-gray-500 text-xs">
                    {e.totalHours > 0 ? `${Math.round(e.totalEarnings / e.totalHours)} Kč` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Project profitability */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Ziskovost zakázky</h2>
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setProfitability(null) }} className={inputCls}>
            <option value="">— Vyberte zakázku —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {profitability ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Tržby" value={`${Math.round(profitability.revenue).toLocaleString('cs-CZ')} Kč`} accent="blue" />
            <StatCard label="Náklady práce" value={`${Math.round(profitability.labourCost).toLocaleString('cs-CZ')} Kč`} accent="red" />
            <StatCard label="Zisk" value={`${Math.round(profitability.profit).toLocaleString('cs-CZ')} Kč`}
              accent={profitability.profit >= 0 ? 'green' : 'red'} />
            <StatCard label="Marže" value={`${profitability.margin.toFixed(1)} %`}
              sub={profitability.margin >= 20 ? 'Zdravá marže' : 'Pod 20 %'}
              accent={profitability.margin >= 20 ? 'green' : profitability.margin >= 10 ? 'yellow' : 'red'} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 flex flex-col items-center gap-2">
            {profitability === null && projectId ? (
              <p className="text-sm text-gray-400">Načítám…</p>
            ) : (
              <>
                <TrendingUp size={28} className="text-gray-200" />
                <p className="text-sm text-gray-400">Vyberte zakázku pro zobrazení ziskovosti</p>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
