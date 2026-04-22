import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import { HardHat, CalendarDays, Clock, ArrowRight, Bell } from 'lucide-react'

interface Project { id: string; name: string; status: string; clientName?: string; address?: string }
interface Notification { id: string; title: string; body: string; read: boolean }

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    void apiFetch<Project[]>('/api/projects').then(setProjects)
    void apiFetch<Notification[]>('/api/notifications/me').then(setNotifications)
  }, [])

  const active = projects.filter((p) => p.status === 'IN_PROGRESS')
  const pending = projects.filter((p) => p.status === 'OFFER' || p.status === 'APPROVED')
  const unread = notifications.filter((n) => !n.read)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Přehled vaší stavební firmy</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={HardHat}     label="Aktivní zakázky"   value={active.length}  color="bg-blue-500" />
        <StatCard icon={CalendarDays} label="Čekající zakázky" value={pending.length} color="bg-amber-500" />
        <StatCard icon={Bell}         label="Oznámení"          value={unread.length}  color="bg-violet-500" />
        <StatCard icon={Clock}        label="Celkem zakázek"    value={projects.length} color="bg-emerald-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active projects */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Probíhající zakázky</h2>
            <Link to="/projects?status=IN_PROGRESS" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Vše <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {active.length === 0 ? (
              <p className="text-sm text-gray-400 px-6 py-8 text-center">Žádné aktivní zakázky</p>
            ) : (
              active.slice(0, 5).map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group">
                  <div>
                    <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{p.name}</div>
                    {p.clientName && <div className="text-sm text-gray-500 mt-0.5">{p.clientName}</div>}
                    {p.address && <div className="text-xs text-gray-400 mt-0.5">{p.address}</div>}
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Oznámení</h2>
            {unread.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {unread.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {unread.length === 0 ? (
              <p className="text-sm text-gray-400 px-6 py-8 text-center">Žádná nová oznámení</p>
            ) : (
              unread.slice(0, 5).map((n) => (
                <div key={n.id} className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{n.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Rychlé akce</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/planning',   label: 'Týdenní plán',     bg: 'bg-blue-50',   text: 'text-blue-700',   Icon: CalendarDays },
            { to: '/attendance', label: 'Docházka',          bg: 'bg-green-50',  text: 'text-green-700',  Icon: Clock },
            { to: '/projects',   label: 'Zakázky',           bg: 'bg-amber-50',  text: 'text-amber-700',  Icon: HardHat },
            { to: '/invoices',   label: 'Faktury',           bg: 'bg-violet-50', text: 'text-violet-700', Icon: ArrowRight },
          ].map(({ to, label, bg, text, Icon }) => (
            <Link key={to} to={to}
              className={`${bg} ${text} rounded-2xl p-4 flex items-center gap-3 hover:opacity-80 transition-opacity`}>
              <Icon size={18} />
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
