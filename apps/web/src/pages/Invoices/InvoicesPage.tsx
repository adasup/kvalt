import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import { Plus, CheckCircle, Send } from 'lucide-react'

interface Invoice {
  id: string; invoiceNumber: string; type: string; clientName: string
  dateIssued: string; dateDue: string; totalWithVat: number; status: string
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:   'bg-gray-100 text-gray-600',
  ISSUED:  'bg-blue-100 text-blue-700',
  PAID:    'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Koncept', ISSUED: 'Vydaná', PAID: 'Zaplacena', OVERDUE: 'Po splatnosti',
}
const TYPE_LABEL: Record<string, string> = { ADVANCE: 'Záloha', FINAL: 'Konečná' }

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void apiFetch<Invoice[]>('/api/invoices').then(setInvoices).finally(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: string) {
    const updated = await apiFetch<Invoice>(`/api/invoices/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    })
    setInvoices((ivs) => ivs.map((i) => i.id === id ? updated : i))
  }

  const total = invoices.reduce((s, i) => s + (i.status !== 'DRAFT' ? i.totalWithVat : 0), 0)
  const paid = invoices.reduce((s, i) => s + (i.status === 'PAID' ? i.totalWithVat : 0), 0)
  const overdue = invoices.filter((i) => i.status === 'OVERDUE').length

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faktury</h1>
          <p className="text-sm text-gray-500 mt-0.5">{invoices.length} faktur celkem</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
          <Plus size={16} /> Nová faktura
        </button>
      </div>

      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Celkem vydáno', value: `${Math.round(total).toLocaleString('cs-CZ')} Kč`, color: 'bg-blue-500' },
            { label: 'Zaplaceno', value: `${Math.round(paid).toLocaleString('cs-CZ')} Kč`, color: 'bg-emerald-500' },
            { label: 'Po splatnosti', value: String(overdue), color: overdue > 0 ? 'bg-red-500' : 'bg-gray-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className={`w-2 h-2 rounded-full ${color} mb-3`} />
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Načítám…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Číslo', 'Klient', 'Typ', 'Vydáno', 'Splatnost', 'Celkem s DPH', 'Stav', ''].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-sm text-gray-400">Žádné faktury</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-700">{inv.clientName}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-medium">{TYPE_LABEL[inv.type] ?? inv.type}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{inv.dateIssued}</td>
                  <td className="px-5 py-3.5 text-gray-500">{inv.dateDue}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{inv.totalWithVat.toLocaleString('cs-CZ')} Kč</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${STATUS_STYLE[inv.status] ?? ''}`}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {inv.status === 'DRAFT' && (
                      <button onClick={() => void updateStatus(inv.id, 'ISSUED')}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        <Send size={11} /> Vydat
                      </button>
                    )}
                    {inv.status === 'ISSUED' && (
                      <button onClick={() => void updateStatus(inv.id, 'PAID')}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
                        <CheckCircle size={11} /> Zaplacena
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
