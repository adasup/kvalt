import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../lib/api.js'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Assignment {
  id: string
  projectId: string
  date: string
  teamId: string | null
  userId: string | null
  status: string
  startTime: string
  endTime: string
  description: string | null
  projectName: string
  projectAddress: string | null
  teamName: string | null
  teamColor: string | null
}

interface WeekBoard {
  week: string
  days: string[]
  assignments: Assignment[]
}

interface Team { id: string; name: string; color?: string | null }
interface Project { id: string; name: string }

// ─── Helpers ───────────────────────────────────────────────────────────────

function currentIsoWeek(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function shiftWeek(week: string, delta: number): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(week)!
  let y = parseInt(match[1]!)
  let w = parseInt(match[2]!) + delta
  if (w > 52) { w -= 52; y++ }
  if (w < 1) { w += 52; y-- }
  return `${y}-W${String(w).padStart(2, '0')}`
}

const DAY_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

// ─── Component ─────────────────────────────────────────────────────────────

export function WeekViewPage() {
  const [week, setWeek] = useState(currentIsoWeek)
  const [board, setBoard] = useState<WeekBoard | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dragSrc, setDragSrc] = useState<{ assignmentId: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiFetch<WeekBoard>(`/api/assignments?week=${week}`),
      apiFetch<Team[]>('/api/teams'),
      apiFetch<Project[]>('/api/projects'),
    ])
      .then(([b, t, p]) => { setBoard(b); setTeams(t); setProjects(p) })
      .finally(() => setLoading(false))
  }, [week])

  async function handleDrop(teamId: string, date: string) {
    if (!dragSrc) return
    await apiFetch(`/api/assignments/${dragSrc.assignmentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ teamId, date }),
    })
    const updated = await apiFetch<WeekBoard>(`/api/assignments?week=${week}`)
    setBoard(updated)
    setDragSrc(null)
  }

  async function handleQuickAssign(teamId: string, date: string) {
    if (projects.length === 0) return
    const projectId = projects[0]!.id
    await apiFetch('/api/assignments', {
      method: 'POST',
      body: JSON.stringify({ projectId, teamId, date, startTime: '07:00', endTime: '16:00' }),
    })
    const updated = await apiFetch<WeekBoard>(`/api/assignments?week=${week}`)
    setBoard(updated)
  }

  if (loading) return <div className="p-8 text-gray-400">Načítám…</div>
  if (!board) return null

  const assignByTeamDay = new Map<string, Assignment>()
  for (const a of board.assignments) {
    if (a.teamId) assignByTeamDay.set(`${a.teamId}|${a.date}`, a)
  }

  return (
    <div className="p-6 max-w-full overflow-x-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold">Plánování</h1>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setWeek((w) => shiftWeek(w, -1))} className="px-2 py-1 border rounded hover:bg-gray-50">‹</button>
          <span className="text-sm font-medium min-w-[100px] text-center">{week}</span>
          <button onClick={() => setWeek((w) => shiftWeek(w, 1))} className="px-2 py-1 border rounded hover:bg-gray-50">›</button>
          <button onClick={() => setWeek(currentIsoWeek())} className="text-xs px-3 py-1 border rounded hover:bg-gray-50 ml-2">Tento týden</button>
        </div>
      </div>

      {/* Board */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-500 min-w-[160px]">Tým</th>
            {board.days.map((day, i) => (
              <th key={day} className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-500 min-w-[140px]">
                <div>{DAY_CS[i]}</div>
                <div className="text-xs font-normal text-gray-400">{day.slice(5)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.length === 0 ? (
            <tr>
              <td colSpan={8} className="border border-gray-200 px-4 py-8 text-center text-gray-400">
                Nejsou žádné týmy — nejprve je vytvořte
              </td>
            </tr>
          ) : (
            teams.map((team) => (
              <tr key={team.id} className="hover:bg-gray-50/50">
                {/* Team label */}
                <td className="border border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color ?? '#6B7280' }} />
                    <span className="font-medium">{team.name}</span>
                  </div>
                </td>

                {/* Day cells */}
                {board.days.map((day) => {
                  const assignment = assignByTeamDay.get(`${team.id}|${day}`)
                  return (
                    <td
                      key={day}
                      className="border border-gray-200 px-2 py-1.5 align-top"
                      onDragOver={(e) => { e.preventDefault() }}
                      onDrop={() => void handleDrop(team.id, day)}
                    >
                      {assignment ? (
                        <div
                          draggable
                          onDragStart={() => setDragSrc({ assignmentId: assignment.id })}
                          className="rounded-lg p-2 cursor-grab active:cursor-grabbing text-xs"
                          style={{
                            backgroundColor: `${team.color ?? '#6B7280'}20`,
                            borderLeft: `3px solid ${team.color ?? '#6B7280'}`,
                          }}
                        >
                          <div className="font-semibold leading-tight">{assignment.projectName}</div>
                          {assignment.description && (
                            <div className="text-gray-500 mt-0.5 leading-tight">{assignment.description}</div>
                          )}
                          <div className="text-gray-400 mt-1">{assignment.startTime}–{assignment.endTime}</div>
                        </div>
                      ) : (
                        <button
                          onClick={() => void handleQuickAssign(team.id, day)}
                          className="w-full h-12 border-2 border-dashed border-gray-200 rounded-lg text-gray-300 hover:border-blue-300 hover:text-blue-300 transition-colors flex items-center justify-center text-lg"
                          title="Přidat přiřazení"
                        >
                          +
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
