import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import { BookOpen, CloudSun, Users, CheckCircle } from 'lucide-react'

interface DiaryEntry {
  id: string; projectId: string; date: string; weather: string | null
  temperature: number | null; description: string; workersPresent: number; createdAt: string
}
interface ExtraWork {
  id: string; description: string; scope: string | null
  estimatedPrice: number | null; approvedByClient: boolean
}

const inputCls = 'border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

export function DiaryPage() {
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [extraWorks, setExtraWorks] = useState<ExtraWork[]>([])
  const [selected, setSelected] = useState<DiaryEntry | null>(null)
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { void apiFetch<{ id: string; name: string }[]>('/api/projects').then(setProjects) }, [])

  useEffect(() => {
    if (!projectId) return
    void apiFetch<DiaryEntry[]>(`/api/diary/${projectId}`).then(setEntries)
    void apiFetch<ExtraWork[]>(`/api/diary/${projectId}/extra-works`).then(setExtraWorks)
  }, [projectId])

  async function createEntry() {
    if (!projectId || !newDesc.trim()) return
    setSaving(true)
    try {
      const entry = await apiFetch<DiaryEntry>(`/api/diary/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), description: newDesc, structureWithAI: true }),
      })
      setEntries((es) => [entry, ...es])
      setNewDesc('')
    } finally { setSaving(false) }
  }

  async function approveExtraWork(workId: string) {
    await apiFetch(`/api/diary/${projectId}/extra-works/${workId}/approve`, { method: 'PATCH' })
    setExtraWorks((ws) => ws.map((w) => w.id === workId ? { ...w, approvedByClient: true } : w))
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stavební deník</h1>
          <p className="text-sm text-gray-500 mt-0.5">Záznamy průběhu prací</p>
        </div>
        <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setSelected(null) }} className={inputCls}>
          <option value="">— Vyberte zakázku —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!projectId ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center gap-2">
          <BookOpen size={32} className="text-gray-200" />
          <p className="text-sm text-gray-400">Vyberte zakázku pro zobrazení deníku</p>
        </div>
      ) : (
        <>
          {/* New entry */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen size={13} className="text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Nový zápis</p>
              <span className="text-xs text-gray-400 ml-1">AI strukturuje automaticky</span>
            </div>
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3}
              placeholder="Popište dnešní práci…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <div className="flex justify-end">
              <button onClick={() => void createEntry()} disabled={saving || !newDesc.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-medium disabled:opacity-50 transition-colors">
                {saving ? 'Ukládám…' : 'Uložit zápis'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Entry list */}
            <div className="lg:col-span-3 space-y-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Záznamy ({entries.length})</h2>
              {entries.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-10 text-center">
                  <p className="text-sm text-gray-400">Žádné záznamy</p>
                </div>
              ) : entries.map((e) => (
                <button key={e.id} onClick={() => setSelected(selected?.id === e.id ? null : e)}
                  className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 transition-all ${selected?.id === e.id ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-semibold text-sm text-gray-900">{e.date}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {e.workersPresent > 0 && <span className="flex items-center gap-1"><Users size={11} />{e.workersPresent}</span>}
                      {e.weather && <span className="flex items-center gap-1"><CloudSun size={11} />{e.weather}{e.temperature !== null ? ` ${e.temperature}°C` : ''}</span>}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{e.description}</p>
                </button>
              ))}
            </div>

            {/* Detail + extra works */}
            <div className="lg:col-span-2 space-y-4">
              {selected && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{selected.date}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.description}</p>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900 text-sm">Vícepráce</h2>
                </div>
                {extraWorks.length === 0 ? (
                  <p className="text-sm text-gray-400 px-5 py-8 text-center">Žádné vícepráce</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {extraWorks.map((w) => (
                      <div key={w.id} className="px-5 py-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{w.description}</p>
                          {w.scope && <p className="text-xs text-gray-500 mt-0.5">{w.scope}</p>}
                          {w.estimatedPrice !== null && (
                            <p className="text-xs text-gray-500 mt-0.5">{w.estimatedPrice.toLocaleString('cs-CZ')} Kč</p>
                          )}
                        </div>
                        {w.approvedByClient ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold shrink-0">
                            <CheckCircle size={12} />Schváleno
                          </span>
                        ) : (
                          <button onClick={() => void approveExtraWork(w.id)}
                            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 shrink-0 transition-colors">
                            Schválit
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
