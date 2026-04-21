import { Link, useLocation } from 'react-router-dom'
import { logout } from '../lib/auth.js'

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',    icon: '⊞' },
  { to: '/projects',   label: 'Zakázky',       icon: '🏗' },
  { to: '/planning',   label: 'Plánování',     icon: '📅' },
  { to: '/attendance', label: 'Docházka',      icon: '⏱' },
  { to: '/budgets',    label: 'Rozpočty',      icon: '🧮' },
  { to: '/diary',      label: 'Deník',         icon: '📓' },
  { to: '/invoices',   label: 'Faktury',       icon: '🧾' },
  { to: '/reports',    label: 'Reporty',       icon: '📊' },
  { to: '/teams',      label: 'Týmy',          icon: '👥' },
]

interface Props { children: React.ReactNode }

export function Layout({ children }: Props) {
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="text-lg font-bold text-gray-900">Kvalt</span>
          <span className="text-xs text-gray-400 ml-2">stavební firma</span>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon }) => {
            const active = pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={logout}
          className="mx-3 mb-4 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 text-left"
        >
          Odhlásit se
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
