import { startLogin } from '../lib/auth.js'

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Kvalt</h1>
          <p className="mt-2 text-gray-500">Řízení stavební firmy</p>
        </div>
        <button
          onClick={() => void startLogin()}
          className="w-full flex justify-center py-3 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Přihlásit se
        </button>
      </div>
    </div>
  )
}
