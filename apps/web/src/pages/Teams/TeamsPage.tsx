import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import type { Team } from '@kvalt/shared'
import { Plus, ChevronDown, ChevronUp, UserMinus, UserPlus } from 'lucide-react'

interface TeamDetail extends Team {
  members: Array<{ userId: string; fullName: string; role: string; email: string; phone: string | null }>
}

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', FOREMAN: 'Parťák', WORKER: 'Dělník' }
const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'bg-violet-100 text-violet-700', FOREMAN: 'bg-blue-100 text-blue-700', WORKER: 'bg-gray-100 text-gray-600',
}
const AVATAR_BG = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-orange-500','bg-pink-500','bg-teal-500']

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

const inputCls = 'border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

export function TeamsPage() {
  const [teams, setTeams] = useState<TeamDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#2563EB')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newMemberId, setNewMemberId] = useState('')

  useEffect(() => {
    apiFetch<Team[]>('/api/teams')
      .then((ts) => Promise.all(ts.map((t) => apiFetch<TeamDetail>(`/api/teams/${t.id}`))))
      .then(setTeams).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const team = await apiFetch<TeamDetail>('/api/teams', {
        method: 'POST', body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      setTeams((prev) => [...prev, { ...team, members: [] }])
      setNewName(''); setShowForm(false)
    } finally { setCreating(false) }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    await apiFetch(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, members: t.members.filter((m) => m.userId !== userId) } : t))
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Načítám…</div>

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Týmy</h1>
          <p className="text-sm text-gray-500 mt-0.5">{teams.length} týmů celkem</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
          <Plus size={16} /> Nový tým
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => void handleCreate(e)}
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Nový tým</h2>
          <div className="flex gap-3">
            <input type="text" placeholder="Název týmu" value={newName} onChange={(e) => setNewName(e.target.value)}
              autoFocus className={`${inputCls} flex-1`} />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Barva</span>
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                className="h-10 w-10 rounded-xl border border-gray-200 cursor-pointer p-0.5" />
            </div>
          </div>
          <div className="flex gap-2">
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

      {teams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center shadow-sm">
          <p className="text-sm text-gray-400">Žádné týmy. Vytvořte první.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team, ti) => (
            <div key={team.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-gray-50/50 text-left transition-colors"
                onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}>
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: team.color ?? '#6B7280' }} />
                <span className="font-semibold text-gray-900 flex-1">{team.name}</span>
                <span className="text-sm text-gray-400 mr-2">{team.members.length} členů</span>
                {expandedId === team.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {expandedId === team.id && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                  {team.members.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Žádní členové</p>
                  ) : (
                    <ul className="space-y-2">
                      {team.members.map((m, i) => (
                        <li key={m.userId} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${AVATAR_BG[(ti * 3 + i) % AVATAR_BG.length]}`}>
                            {initials(m.fullName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{m.fullName}</div>
                            <div className="text-xs text-gray-400">{m.email}</div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${ROLE_COLOR[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABEL[m.role] ?? m.role}
                          </span>
                          <button onClick={() => void handleRemoveMember(team.id, m.userId)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <UserMinus size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {addingTo === team.id ? (
                    <div className="flex gap-2 pt-1">
                      <input type="text" placeholder="UUID uživatele" value={newMemberId}
                        onChange={(e) => setNewMemberId(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      <button onClick={async () => {
                        await apiFetch(`/api/teams/${team.id}/members`, { method: 'POST', body: JSON.stringify({ userId: newMemberId }) })
                        const updated = await apiFetch<TeamDetail>(`/api/teams/${team.id}`)
                        setTeams((prev) => prev.map((t) => t.id === team.id ? updated : t))
                        setAddingTo(null); setNewMemberId('')
                      }} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700">
                        Přidat
                      </button>
                      <button onClick={() => { setAddingTo(null); setNewMemberId('') }}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50">
                        Zrušit
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingTo(team.id)}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      <UserPlus size={14} /> Přidat člena
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
