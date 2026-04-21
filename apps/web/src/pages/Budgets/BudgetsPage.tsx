import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import type { Budget } from '@kvalt/shared'

export function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    apiFetch<Budget[]>('/api/budgets')
      .then(setBudgets)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const budget = await apiFetch<Budget>('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      setBudgets((prev) => [budget, ...prev])
      setName('')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Načítám...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Rozpočty</h1>

      <form onSubmit={(e) => void handleCreate(e)} className="flex gap-3 mb-8">
        <input
          type="text"
          placeholder="Název nového rozpočtu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Vytvořit
        </button>
      </form>

      {budgets.length === 0 ? (
        <p className="text-gray-400 text-center py-12">Žádné rozpočty. Vytvořte první.</p>
      ) : (
        <ul className="space-y-2">
          {budgets.map((b) => (
            <li key={b.id}>
              <Link
                to={`/budgets/${b.id}`}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 transition-colors"
              >
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-sm text-gray-500">
                    {b.status === 'DRAFT' ? 'Rozpracovaný' : 'Hotový'} ·{' '}
                    {b.totalWithoutVat.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${b.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {b.status === 'DONE' ? 'Hotový' : 'Rozpracovaný'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
