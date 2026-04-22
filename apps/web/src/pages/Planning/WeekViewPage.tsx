import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

interface Assignment {
  id: string; projectId: string; date: string; teamId: string | null; userId: string | null
  status: string; startTime: string; endTime: string; description: string | null
  projectName: string; projectAddress: string | null; teamName: string | null; teamColor: string | null
}
interface WeekBoard { week: string; days: string[]; assignments: Assignment[] }
interface Team { id: string; name: string; color?: string | null }
interface Project { id: string; name: string }

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
  let y = parseInt(match[1]!), w = parseInt(match[2]!) + delta
  if (w > 52) { w -= 52; y++ }
  if (w < 1) { w += 52; y-- }
  return `${y}-W${String(w).padStart(2, '0')}`
}

const DAY_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

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
    ]).then(([b, t, p]) => { setBoard(b); setTeams(t); setProjects(p) })
      .finally(() => setLoading(false))
  }, [week])

  async function handleDrop(teamId: string, date: string) {
    if (!dragSrc) return
    await apiFetch(`/api/assignments/${dragSrc.assignmentId}`, {
      method: 'PATCH', body: JSON.stringify({ teamId, date }),
    })
    setBoard(await apiFetch<WeekBoard>(`/api/assignments?week=${week}`))
    setDragSrc(null)
  }

  async function handleQuickAssign(teamId: string, date: string) {
    if (!projects[0]) return
    await apiFetch('/api/assignments', {
      method: 'POST',
      body: JSON.stringify({ projectId: projects[0].id, teamId, date, startTime: '07:00', endTime: '16:00' }),
    })
    setBoard(await apiFetch<WeekBoard>(`/api/assignments?week=${week}`))
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Načítám…</div>
  if (!board) return null

  const assignByTeamDay = new Map<string, Assignment>()
  for (const a of board.assignments) {
    if (a.teamId) assignByTeamDay.set(`${a.teamId}|${a.date}`, a)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plánování</h1>
          <p className="text-sm text-gray-500 mt-0.5">Týdenní přehled přiřazení</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeek(currentIsoWeek())}
            className="px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 bg-white transition-colors text-gray-600">
            Tento týden
          </button>
          <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setWeek((w) => shiftWeek(w, -1))}
              className="px-3 py-2 hover:bg-gray-50 transition-colors border-r border-gray-200">
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <span className="px-4 text-sm font-medium text-gray-700 min-w-[110px] text-center">{week}</span>
            <button onClick={() => setWeek((w) => shiftWeek(w, 1))}
              className="px-3 py-2 hover:bg-gray-50 transition-colors border-l border-gray-200">
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-44">Tým</th>
              {board.days.map((day, i) => (
                <th key={day} className="px-3 py-4 text-center min-w-[150px]">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{DAY_CS[i]}</div>
                  <div className="text-xs text-gray-300 mt-0.5">{day.slice(5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <CalendarDays size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Nejsou žádné týmy</p>
                </td>
              </tr>
            ) : teams.map((team) => (
              <tr key={team.id} className="border-t border-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color ?? '#6B7280' }} />
                    <span className="font-medium text-gray-800 text-sm">{team.name}</span>
                  </div>
                </td>
                {board.days.map((day) => {
                  const a = assignByTeamDay.get(`${team.id}|${day}`)
                  return (
                    <td key={day} className="px-2 py-2 align-top border-l border-gray-50"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => void handleDrop(team.id, day)}>
                      {a ? (
                        <div draggable onDragStart={() => setDragSrc({ assignmentId: a.id })}
                          className="rounded-xl p-2.5 cursor-grab active:cursor-grabbing text-xs select-none"
                          style={{ backgroundColor: `${team.color ?? '#6B7280'}18`, borderLeft: `3px solid ${team.color ?? '#6B7280'}` }}>
                          <div className="font-semibold text-gray-800 leading-tight truncate">{a.projectName}</div>
                          {a.description && <div className="text-gray-500 mt-0.5 leading-tight line-clamp-2">{a.description}</div>}
                          <div className="text-gray-400 mt-1.5 font-medium">{a.startTime}–{a.endTime}</div>
                        </div>
                      ) : (
                        <button onClick={() => void handleQuickAssign(team.id, day)}
                          className="w-full h-14 rounded-xl border-2 border-dashed border-gray-100 text-gray-200 hover:border-blue-200 hover:text-blue-300 hover:bg-blue-50/50 transition-all flex items-center justify-center text-xl font-light">
                          +
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
