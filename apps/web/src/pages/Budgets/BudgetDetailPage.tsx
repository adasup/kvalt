import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import type { BudgetItem } from '@kvalt/shared'

interface BudgetDetail {
  id: string
  name: string
  status: 'DRAFT' | 'DONE'
  vatRate: number
  totalWithoutVat: number
  items: BudgetItem[]
  transcripts: Array<{ id: string; text: string; wordCount: number }>
}

export function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [budget, setBudget] = useState<BudgetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dictating, setDictating] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!id) return
    apiFetch<BudgetDetail>(`/api/budgets/${id}`)
      .then(setBudget)
      .finally(() => setLoading(false))
  }, [id])

  async function handleParse() {
    if (!id || !transcript.trim()) return
    setParsing(true)
    try {
      const items = await apiFetch<BudgetItem[]>(`/api/budgets/${id}/parse`, {
        method: 'POST',
        body: JSON.stringify({ text: transcript }),
      })
      setBudget((prev) => prev ? {
        ...prev,
        items: [...prev.items, ...items],
        totalWithoutVat: prev.totalWithoutVat + items.reduce((s, i) => s + i.totalPrice, 0),
      } : prev)
      setTranscript('')
    } finally {
      setParsing(false)
    }
  }

  function handleExportXlsx() {
    window.open(`/api/budgets/${id}/export/xlsx`, '_blank')
  }

  function handleExportPdf() {
    window.open(`/api/budgets/${id}/export/pdf`, '_blank')
  }

  if (loading) return <div className="p-8 text-gray-500">Načítám...</div>
  if (!budget) return <div className="p-8 text-red-500">Rozpočet nenalezen</div>

  const vatAmount = Math.round(budget.totalWithoutVat * (budget.vatRate / 100))
  const totalWithVat = Math.round(budget.totalWithoutVat + vatAmount)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{budget.name}</h1>
        <div className="flex gap-2">
          <button onClick={handleExportXlsx} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Export XLSX
          </button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Export PDF
          </button>
        </div>
      </div>

      {/* Diktát */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
        <label className="block text-sm font-medium mb-2">Nadiktovat položky</label>
        <textarea
          ref={textareaRef}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Napište nebo nadiktujte text… např. 'obklady do koupelny 25 m2, záchod, umyvadlo'"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => void handleParse()}
            disabled={parsing || !transcript.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {parsing ? 'Parsování AI…' : 'Zpracovat AI'}
          </button>
        </div>
      </div>

      {/* Položky */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Název</th>
              <th className="px-4 py-3 text-left">MJ</th>
              <th className="px-4 py-3 text-right">Množství</th>
              <th className="px-4 py-3 text-right">Cena/MJ</th>
              <th className="px-4 py-3 text-right">Celkem</th>
              <th className="px-4 py-3 text-center">Shoda</th>
            </tr>
          </thead>
          <tbody>
            {budget.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Žádné položky — nadiktujte text výše
                </td>
              </tr>
            ) : (
              budget.items.map((item, i) => (
                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="px-4 py-2 text-gray-500">{item.unit}</td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-right">{item.unitPrice.toLocaleString('cs-CZ')}</td>
                  <td className="px-4 py-2 text-right font-medium">{item.totalPrice.toLocaleString('cs-CZ')}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${item.matchType === 'MATCHED' ? 'bg-green-100 text-green-700' : item.matchType === 'ESTIMATED' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                      {item.matchType === 'MATCHED' ? '✓' : item.matchType === 'ESTIMATED' ? '~' : 'M'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200 font-medium">
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-gray-500 text-xs">Celkem bez DPH</td>
              <td className="px-4 py-2 text-right">{budget.totalWithoutVat.toLocaleString('cs-CZ')} Kč</td>
              <td />
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-gray-500 text-xs">DPH {budget.vatRate}%</td>
              <td className="px-4 py-2 text-right">{vatAmount.toLocaleString('cs-CZ')} Kč</td>
              <td />
            </tr>
            <tr className="text-base">
              <td colSpan={5} className="px-4 py-3 text-right font-bold">Celkem s DPH</td>
              <td className="px-4 py-3 text-right font-bold">{totalWithVat.toLocaleString('cs-CZ')} Kč</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
