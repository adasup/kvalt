import { startLogin } from '../lib/auth.js'
import { Building2, ArrowRight } from 'lucide-react'

export function LoginPage() {
  return (
    <div className="min-h-screen flex bg-[#F4F5F7]">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-[#1C1C1E] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Kvalt</span>
        </div>

        <div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Řiďte svou<br />stavební firmu<br />moderně.
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm">
            Zakázky, plánování, docházka, rozpočty a fakturace — vše na jednom místě.
          </p>
        </div>

        <div className="flex gap-8 text-sm">
          {['Zakázky', 'Plánování', 'Docházka', 'Fakturace'].map((label) => (
            <div key={label} className="text-gray-500">{label}</div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Building2 size={15} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900">Kvalt</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Přihlášení</h1>
          <p className="text-gray-500 text-sm mb-8">Přihlaste se ke svému účtu</p>

          <button
            onClick={() => void startLogin()}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm text-sm"
          >
            Přihlásit se
            <ArrowRight size={16} />
          </button>

          <p className="text-xs text-gray-400 text-center mt-6">
            Přihlašujete se přes zabezpečenou Zitadel autentizaci
          </p>
        </div>
      </div>
    </div>
  )
}
