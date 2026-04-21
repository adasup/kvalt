import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'

interface DiaryEntry {
  id: string
  projectId: string
  date: string
  weather: string | null
  temperature: number | null
  description: string
  workersPresent: number
  createdAt: string
}

interface ExtraWork {
  id: string
  description: string
  scope: string | null
  estimatedPrice: number | null
  approvedByClient: boolean
}

export function DiaryPage() {
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [extraWorks, setExtraWorks] = useState<ExtraWork[]>([])
  const [selected, setSelected] = useState<DiaryEntry | null>(null)
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void apiFetch<{ id: string; name: string }[]>('/api/projects').then(setProjects)
  }, [])

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
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          description: newDesc,
          structureWithAI: true,
        }),
      })
      setEntries((es) => [entry, ...es])
      setNewDesc('')
    } finally {
      setSaving(false)
    }
  }

  async function approveExtraWork(workId: string) {
    await apiFetch(`/api/diary/${projectId}/extra-works/${workId}/approve`, { method: 'PATCH' })
    setExtraWorks((ws) => ws.map((w) => (w.id === workId ? { ...w, approvedByClient: true } : w)))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Stavební deník</h1>
        <select
          value={projectId}
          onChange={(e) => { setProjectId(e.target.value); setSelected(null) }}
          className="ml-auto border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">— Vyberte zakázku —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {projectId && (
        <>
          {/* New entry */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Nový zápis (AI strukturuje automaticky)</p>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
              placeholder="Popište dnešní práci…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={() => void createEntry()}
              disabled={saving || !newDesc.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Ukládám…' : 'Uložit zápis'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Entry list */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Záznamy</h2>
              {entries.length === 0 ? (
                <p className="text-sm text-gray-400">Žádné záznamy</p>
              ) : (
                entries.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setSelected(selected?.id === e.id ? null : e)}
                    className={`w-full text-left bg-white rounded-xl border p-4 transition-colors ${selected?.id === e.id ? 'border-blue-400' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{e.date}</span>
                      <span className="text-xs text-gray-400">
                        {e.workersPresent} prac. {e.weather ? `· ${e.weather}` : ''}{e.temperature !== null ? ` ${e.temperature}°C` : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{e.description}</p>
                  </button>
                ))
              )}
            </section>

            {/* Selected entry detail + extra works */}
            <section className="space-y-4">
              {selected && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{selected.date}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}

              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Vícepráce</h2>
                {extraWorks.length === 0 ? (
                  <p className="text-sm text-gray-400">Žádné vícepráce</p>
                ) : (
                  extraWorks.map((w) => (
                    <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{w.description}</p>
                        {w.scope && <p className="text-xs text-gray-500">{w.scope}</p>}
                        {w.estimatedPrice !== null && (
                          <p className="text-xs text-gray-500">{w.estimatedPrice.toLocaleString('cs-CZ')} Kč</p>
                        )}
                      </div>
                      {w.approvedByClient ? (
                        <span className="text-xs text-green-600 font-semibold">✓ Schváleno</span>
                      ) : (
                        <button
                          onClick={() => void approveExtraWork(w.id)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Schválit
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {!projectId && (
        <p className="text-gray-400 text-sm pt-4">Vyberte zakázku pro zobrazení deníku.</p>
      )}
    </div>
  )
}
