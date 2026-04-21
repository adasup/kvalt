import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'

interface Invoice {
  id: string
  invoiceNumber: string
  type: string
  clientName: string
  dateIssued: string
  dateDue: string
  totalWithVat: number
  status: string
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Koncept', ISSUED: 'Vydaná', PAID: 'Zaplacena', OVERDUE: 'Po splatnosti',
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void apiFetch<Invoice[]>('/api/invoices').then(setInvoices).finally(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: string) {
    const updated = await apiFetch<Invoice>(`/api/invoices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    setInvoices((ivs) => ivs.map((i) => (i.id === id ? updated : i)))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Faktury</h1>
        <Link
          to="/invoices/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          + Nová faktura
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Načítám…</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Číslo</th>
                <th className="px-4 py-3 text-left">Klient</th>
                <th className="px-4 py-3 text-left">Vydáno</th>
                <th className="px-4 py-3 text-left">Splatnost</th>
                <th className="px-4 py-3 text-right">Celkem s DPH</th>
                <th className="px-4 py-3 text-left">Stav</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Žádné faktury</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">
                      <Link to={`/invoices/${inv.id}`} className="hover:text-blue-600">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{inv.clientName}</td>
                    <td className="px-4 py-3">{inv.dateIssued}</td>
                    <td className="px-4 py-3">{inv.dateDue}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {inv.totalWithVat.toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_STYLE[inv.status] ?? ''}`}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.status === 'DRAFT' && (
                        <button
                          onClick={() => void updateStatus(inv.id, 'ISSUED')}
                          className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Vydat
                        </button>
                      )}
                      {inv.status === 'ISSUED' && (
                        <button
                          onClick={() => void updateStatus(inv.id, 'PAID')}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Zaplacena
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
