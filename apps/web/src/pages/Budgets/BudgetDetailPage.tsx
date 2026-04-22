import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import type { BudgetItem } from '@kvalt/shared'
import { Download, Sparkles, ArrowLeft } from 'lucide-react'

interface BudgetDetail {
  id: string; name: string; status: 'DRAFT' | 'DONE'; vatRate: number
  totalWithoutVat: number; items: BudgetItem[]
  transcripts: Array<{ id: string; text: string; wordCount: number }>
}

const MATCH_STYLE: Record<string, string> = {
  MATCHED:   'bg-emerald-100 text-emerald-700',
  ESTIMATED: 'bg-amber-100 text-amber-700',
  MANUAL:    'bg-gray-100 text-gray-600',
}
const MATCH_LABEL: Record<string, string> = { MATCHED: 'Shoda', ESTIMATED: 'Odhad', MANUAL: 'Ruční' }

export function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [budget, setBudget] = useState<BudgetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [transcript, setTranscript] = useState('')

  useEffect(() => {
    if (!id) return
    apiFetch<BudgetDetail>(`/api/budgets/${id}`).then(setBudget).finally(() => setLoading(false))
  }, [id])

  async function handleParse() {
    if (!id || !transcript.trim()) return
    setParsing(true)
    try {
      const items = await apiFetch<BudgetItem[]>(`/api/budgets/${id}/parse`, {
        method: 'POST', body: JSON.stringify({ text: transcript }),
      })
      setBudget((prev) => prev ? {
        ...prev, items: [...prev.items, ...items],
        totalWithoutVat: prev.totalWithoutVat + items.reduce((s, i) => s + i.totalPrice, 0),
      } : prev)
      setTranscript('')
    } finally { setParsing(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Načítám…</div>
  if (!budget) return <div className="p-8 text-sm text-red-500">Rozpočet nenalezen</div>

  const vatAmount = Math.round(budget.totalWithoutVat * (budget.vatRate / 100))
  const totalWithVat = Math.round(budget.totalWithoutVat + vatAmount)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/budgets" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-2 transition-colors">
            <ArrowLeft size={14} /> Rozpočty
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{budget.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {budget.items.length} položek · {Math.round(budget.totalWithoutVat).toLocaleString('cs-CZ')} Kč bez DPH
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/budgets/${id}/export/xlsx`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 bg-white transition-colors">
            <Download size={14} /> XLSX
          </a>
          <a href={`/api/budgets/${id}/export/pdf`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 bg-white transition-colors">
            <Download size={14} /> PDF
          </a>
        </div>
      </div>

      {/* AI input */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-violet-100 rounded-lg flex items-center justify-center">
            <Sparkles size={13} className="text-violet-600" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Nadiktovat položky</p>
          <span className="text-xs text-gray-400 ml-1">AI zpracuje automaticky</span>
        </div>
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
          placeholder="např. 'obklady do koupelny 25 m2, záchod, umyvadlo, baterie'"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <div className="flex justify-end">
          <button onClick={() => void handleParse()} disabled={parsing || !transcript.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-xl font-medium disabled:opacity-50 transition-colors">
            <Sparkles size={14} />
            {parsing ? 'Zpracovávám…' : 'Zpracovat AI'}
          </button>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['#', 'Název', 'MJ', 'Množství', 'Cena/MJ', 'Celkem', 'Shoda'].map((h, i) => (
                <th key={h} className={`px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {budget.items.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center text-sm text-gray-400">
                Žádné položky — nadiktujte text výše
              </td></tr>
            ) : budget.items.map((item, i) => (
              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                <td className="px-5 py-3 text-gray-500">{item.unit}</td>
                <td className="px-5 py-3 text-right text-gray-600">{item.quantity}</td>
                <td className="px-5 py-3 text-right text-gray-600">{item.unitPrice.toLocaleString('cs-CZ')}</td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">{item.totalPrice.toLocaleString('cs-CZ')} Kč</td>
                <td className="px-5 py-3 text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${MATCH_STYLE[item.matchType] ?? ''}`}>
                    {MATCH_LABEL[item.matchType] ?? item.matchType}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-100">
            <tr><td colSpan={5} className="px-5 py-2.5 text-right text-xs text-gray-400">Celkem bez DPH</td>
              <td className="px-5 py-2.5 text-right font-medium text-gray-700">{Math.round(budget.totalWithoutVat).toLocaleString('cs-CZ')} Kč</td><td /></tr>
            <tr><td colSpan={5} className="px-5 py-2.5 text-right text-xs text-gray-400">DPH {budget.vatRate} %</td>
              <td className="px-5 py-2.5 text-right font-medium text-gray-700">{vatAmount.toLocaleString('cs-CZ')} Kč</td><td /></tr>
            <tr className="bg-gray-50">
              <td colSpan={5} className="px-5 py-3.5 text-right font-bold text-gray-900">Celkem s DPH</td>
              <td className="px-5 py-3.5 text-right font-bold text-gray-900 text-base">{totalWithVat.toLocaleString('cs-CZ')} Kč</td><td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
