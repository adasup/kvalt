import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import type { Project, ProjectStatus } from '@kvalt/shared'
import { Plus, MapPin, User, ArrowRight } from 'lucide-react'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  OFFER: 'Nabídka', APPROVED: 'Schváleno', IN_PROGRESS: 'Probíhá',
  HANDOVER: 'Předání', INVOICED: 'Fakturováno', PAID: 'Zaplaceno', CANCELLED: 'Zrušeno',
}

const STATUS_COLOR: Record<ProjectStatus, string> = {
  OFFER:       'bg-gray-100 text-gray-600',
  APPROVED:    'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  HANDOVER:    'bg-orange-100 text-orange-700',
  INVOICED:    'bg-violet-100 text-violet-700',
  PAID:        'bg-emerald-100 text-emerald-700',
  CANCELLED:   'bg-red-100 text-red-600',
}

const STATUS_DOT: Record<ProjectStatus, string> = {
  OFFER: 'bg-gray-400', APPROVED: 'bg-blue-500', IN_PROGRESS: 'bg-amber-500',
  HANDOVER: 'bg-orange-500', INVOICED: 'bg-violet-500', PAID: 'bg-emerald-500', CANCELLED: 'bg-red-500',
}

const ALL_STATUSES: ProjectStatus[] = ['OFFER','APPROVED','IN_PROGRESS','HANDOVER','INVOICED','PAID','CANCELLED']

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProjectStatus | 'ALL'>('ALL')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    setLoading(true)
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
      setShowForm(false)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zakázky</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} zakázek celkem</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nová zakázka
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => void handleCreate(e)}
          className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">Název zakázky</label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="např. Rekonstrukce koupelny Novák"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button type="submit" disabled={creating || !newName.trim()}
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

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${filter === 'ALL' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}>
          Vše
        </button>
        {ALL_STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors border ${filter === s ? 'bg-gray-900 text-white border-gray-900' : `${STATUS_COLOR[s]} border-transparent hover:opacity-80`}`}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Načítám…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <HardHatEmpty />
          <p className="text-sm mt-3">Žádné zakázky</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const status = p.status as ProjectStatus
            return (
              <Link key={p.id} to={`/projects/${p.id}`}
                className="flex items-center justify-between p-5 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">{p.name}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {p.clientName && (
                        <span className="flex items-center gap-1"><User size={11} />{p.clientName}</span>
                      )}
                      {p.address && (
                        <span className="flex items-center gap-1"><MapPin size={11} />{p.address}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {p.plannedStart && (
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {p.plannedStart} – {p.plannedEnd ?? '?'}
                    </span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${STATUS_COLOR[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HardHatEmpty() {
  return (
    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
        <path d="M2 20h20M5 20v-4a7 7 0 0 1 14 0v4"/>
        <path d="M12 4v4M8.5 6.5A5 5 0 0 1 17 10"/>
      </svg>
    </div>
  )
}
