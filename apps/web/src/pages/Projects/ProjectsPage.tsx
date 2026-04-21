import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import type { Project, ProjectStatus } from '@kvalt/shared'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  OFFER: 'Nabídka',
  APPROVED: 'Schváleno',
  IN_PROGRESS: 'Probíhá',
  HANDOVER: 'Předání',
  INVOICED: 'Fakturováno',
  PAID: 'Zaplaceno',
  CANCELLED: 'Zrušeno',
}

const STATUS_COLOR: Record<ProjectStatus, string> = {
  OFFER: 'bg-gray-100 text-gray-600',
  APPROVED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  HANDOVER: 'bg-orange-100 text-orange-700',
  INVOICED: 'bg-purple-100 text-purple-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

const ALL_STATUSES: ProjectStatus[] = ['OFFER', 'APPROVED', 'IN_PROGRESS', 'HANDOVER', 'INVOICED', 'PAID', 'CANCELLED']

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProjectStatus | 'ALL'>('ALL')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    const q = filter !== 'ALL' ? `?status=${filter}` : ''
    apiFetch<Project[]>(`/api/projects${q}`)
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [filter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const project = await apiFetch<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      })
      setProjects((prev) => [project, ...prev])
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Zakázky</h1>
      </div>

      <form onSubmit={(e) => void handleCreate(e)} className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Název nové zakázky"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Vytvořit
        </button>
      </form>

      {/* Status filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Vše
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === s ? 'bg-gray-800 text-white' : `${STATUS_COLOR[s]} hover:opacity-80`}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-12">Načítám…</div>
      ) : projects.length === 0 ? (
        <div className="text-gray-400 text-center py-12">Žádné zakázky</div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 transition-colors"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                {p.clientName && (
                  <div className="text-sm text-gray-500">{p.clientName}</div>
                )}
                {p.address && (
                  <div className="text-xs text-gray-400 mt-0.5">{p.address}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[p.status as ProjectStatus]}`}>
                  {STATUS_LABEL[p.status as ProjectStatus]}
                </span>
                {p.plannedStart && (
                  <span className="text-xs text-gray-400">{p.plannedStart} – {p.plannedEnd ?? '?'}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
