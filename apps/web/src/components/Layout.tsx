import { Link, useLocation } from 'react-router-dom'
import { logout } from '../lib/auth.js'
import {
  LayoutDashboard, HardHat, CalendarDays, Clock, Calculator,
  BookOpen, FileText, BarChart3, Users, LogOut, Building2,
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',   Icon: LayoutDashboard },
  { to: '/projects',   label: 'Zakázky',      Icon: HardHat },
  { to: '/planning',   label: 'Plánování',    Icon: CalendarDays },
  { to: '/attendance', label: 'Docházka',     Icon: Clock },
  { to: '/budgets',    label: 'Rozpočty',     Icon: Calculator },
  { to: '/diary',      label: 'Deník',        Icon: BookOpen },
  { to: '/invoices',   label: 'Faktury',      Icon: FileText },
  { to: '/reports',    label: 'Reporty',      Icon: BarChart3 },
  { to: '/teams',      label: 'Týmy',         Icon: Users },
]

interface Props { children: React.ReactNode }

export function Layout({ children }: Props) {
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen bg-[#F4F5F7]">
      <aside className="w-60 bg-[#1C1C1E] flex flex-col shrink-0">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white text-sm font-semibold leading-none">Kvalt</div>
            <div className="text-gray-500 text-xs mt-0.5">Správa firmy</div>
          </div>
        </div>

        <div className="h-px bg-white/5 mx-4 mb-2" />

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => {
            const active = pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Icon size={16} className={active ? 'text-blue-400' : ''} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="h-px bg-white/5 mx-4" />
        <button
          onClick={logout}
          className="mx-3 my-3 flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-all"
        >
          <LogOut size={16} />
          Odhlásit se
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
