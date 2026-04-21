import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'

interface Stats {
  activeProjects: number
  pendingApprovals: number
  tomorrowAssignments: number
}

interface Project { id: string; name: string; status: string }
interface Notification { id: string; title: string; body: string; read: boolean }

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    void apiFetch<Project[]>('/api/projects').then((p) =>
      setProjects(p.filter((x) => x.status === 'IN_PROGRESS').slice(0, 5)),
    )
    void apiFetch<Notification[]>('/api/notifications/me').then((n) =>
      setNotifications(n.filter((x) => !x.read).slice(0, 5)),
    )
  }, [])

  const quickLinks = [
    { to: '/planning', label: 'Týdenní plán', icon: '📅', color: 'bg-blue-50 text-blue-700' },
    { to: '/attendance', label: 'Schválit docházku', icon: '✅', color: 'bg-green-50 text-green-700' },
    { to: '/invoices', label: 'Nová faktura', icon: '🧾', color: 'bg-purple-50 text-purple-700' },
    { to: '/reports', label: 'Reporty', icon: '📊', color: 'bg-orange-50 text-orange-700' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickLinks.map(({ to, label, icon, color }) => (
          <Link
            key={to}
            to={to}
            className={`${color} rounded-xl p-4 flex flex-col gap-1 hover:opacity-80 transition-opacity`}
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-sm font-semibold">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active projects */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Probíhající zakázky</h2>
            <Link to="/projects" className="text-sm text-blue-600 hover:underline">Vše →</Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-gray-400">Žádné aktivní zakázky</p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="text-sm text-gray-700 hover:text-blue-600 hover:underline"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Unread notifications */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Oznámení</h2>
            {notifications.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                {notifications.length}
              </span>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400">Žádná nová oznámení</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map((n) => (
                <li key={n.id} className="text-sm">
                  <p className="font-medium text-gray-800">{n.title}</p>
                  <p className="text-gray-500">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
