import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import type { Budget } from '@kvalt/shared'
import { Plus, ArrowRight, Calculator } from 'lucide-react'

export function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    apiFetch<Budget[]>('/api/budgets').then(setBudgets).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const budget = await apiFetch<Budget>('/api/budgets', {
        method: 'POST', body: JSON.stringify({ name: name.trim() }),
      })
      setBudgets((prev) => [budget, ...prev])
      setName(''); setShowForm(false)
    } finally { setCreating(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Načítám…</div>

  const totalValue = budgets.reduce((s, b) => s + b.totalWithoutVat, 0)

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rozpočty</h1>
          <p className="text-sm text-gray-500 mt-0.5">{budgets.length} rozpočtů · {Math.round(totalValue).toLocaleString('cs-CZ')} Kč celkem</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
          <Plus size={16} /> Nový rozpočet
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => void handleCreate(e)}
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Nový rozpočet</h2>
          <div className="flex gap-3">
            <input type="text" placeholder="Název rozpočtu" value={name}
              onChange={(e) => setName(e.target.value)} autoFocus
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <button type="submit" disabled={creating || !name.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              Vytvořit
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm rounded-xl hover:bg-gray-100 transition-colors">
              Zrušit
            </button>
          </div>
        </form>
      )}

      {budgets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center gap-2">
          <Calculator size={32} className="text-gray-200" />
          <p className="text-sm text-gray-400">Žádné rozpočty. Vytvořte první.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => (
            <Link key={b.id} to={`/budgets/${b.id}`}
              className="flex items-center justify-between p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.status === 'DONE' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{b.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{Math.round(b.totalWithoutVat).toLocaleString('cs-CZ')} Kč bez DPH</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${b.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {b.status === 'DONE' ? 'Hotový' : 'Rozpracovaný'}
                </span>
                <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
