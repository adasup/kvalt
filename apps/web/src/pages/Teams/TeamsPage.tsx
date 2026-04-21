import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import type { Team, User } from '@kvalt/shared'

interface TeamDetail extends Team {
  members: Array<{ userId: string; fullName: string; role: string; email: string; phone: string | null }>
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', FOREMAN: 'Parťák', WORKER: 'Dělník',
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
]

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export function TeamsPage() {
  const [teams, setTeams] = useState<TeamDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#2563EB')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newMemberEmail, setNewMemberEmail] = useState('')

  useEffect(() => {
    apiFetch<Team[]>('/api/teams')
      .then((ts) =>
        Promise.all(ts.map((t) => apiFetch<TeamDetail>(`/api/teams/${t.id}`))),
      )
      .then(setTeams)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const team = await apiFetch<TeamDetail>('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      setTeams((prev) => [...prev, { ...team, members: [] }])
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    await apiFetch(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? { ...t, members: t.members.filter((m) => m.userId !== userId) } : t,
      ),
    )
  }

  if (loading) return <div className="p-8 text-gray-400">Načítám…</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Týmy</h1>

      {/* Create form */}
      <form onSubmit={(e) => void handleCreate(e)} className="flex gap-3 mb-8 items-center">
        <input
          type="text"
          placeholder="Název nového týmu"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-9 w-9 rounded border border-gray-300 cursor-pointer"
          title="Barva týmu"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Vytvořit
        </button>
      </form>

      {teams.length === 0 ? (
        <p className="text-gray-400 text-center py-12">Žádné týmy</p>
      ) : (
        <div className="space-y-3">
          {teams.map((team, ti) => (
            <div key={team.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Team header */}
              <button
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left"
                onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: team.color ?? '#6B7280' }}
                />
                <span className="font-semibold flex-1">{team.name}</span>
                <span className="text-sm text-gray-400">{team.members.length} členů</span>
                <span className="text-gray-400 text-xs">{expandedId === team.id ? '▲' : '▼'}</span>
              </button>

              {/* Expanded members */}
              {expandedId === team.id && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-2">
                  <ul className="space-y-2 mb-3">
                    {team.members.map((m, i) => (
                      <li key={m.userId} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[(ti * 3 + i) % AVATAR_COLORS.length]}`}>
                          {initials(m.fullName)}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{m.fullName}</div>
                          <div className="text-xs text-gray-400">{ROLE_LABEL[m.role] ?? m.role}</div>
                        </div>
                        <button
                          onClick={() => void handleRemoveMember(team.id, m.userId)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                        >
                          Odebrat
                        </button>
                      </li>
                    ))}
                    {team.members.length === 0 && (
                      <li className="text-sm text-gray-400 py-2">Žádní členové</li>
                    )}
                  </ul>

                  {addingTo === team.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="UUID uživatele"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={async () => {
                          await apiFetch(`/api/teams/${team.id}/members`, {
                            method: 'POST',
                            body: JSON.stringify({ userId: newMemberEmail }),
                          })
                          setAddingTo(null)
                          setNewMemberEmail('')
                          const updated = await apiFetch<TeamDetail>(`/api/teams/${team.id}`)
                          setTeams((prev) => prev.map((t) => t.id === team.id ? updated : t))
                        }}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                      >
                        Přidat
                      </button>
                      <button
                        onClick={() => { setAddingTo(null); setNewMemberEmail('') }}
                        className="px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        Zrušit
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTo(team.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Přidat člena
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
