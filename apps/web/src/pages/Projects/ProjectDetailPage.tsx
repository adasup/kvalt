import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import type { ProjectStatus } from '@kvalt/shared'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  OFFER: 'Nabídka', APPROVED: 'Schváleno', IN_PROGRESS: 'Probíhá',
  HANDOVER: 'Předání', INVOICED: 'Fakturováno', PAID: 'Zaplaceno', CANCELLED: 'Zrušeno',
}

const NEXT_STATUSES: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  OFFER: ['APPROVED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['HANDOVER', 'CANCELLED'],
  HANDOVER: ['INVOICED', 'IN_PROGRESS'],
  INVOICED: ['PAID'],
}

interface ProjectDetail {
  id: string
  name: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  address?: string
  status: ProjectStatus
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  notes?: string
  photos: Array<{ id: string; storagePath: string; caption?: string }>
  budgets: Array<{ id: string; name: string; totalWithoutVat: number; status: string }>
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    apiFetch<ProjectDetail>(`/api/projects/${id}`)
      .then(setProject)
      .finally(() => setLoading(false))
  }, [id])

  async function handleStatusChange(newStatus: ProjectStatus) {
    if (!id) return
    setUpdatingStatus(true)
    try {
      const updated = await apiFetch<ProjectDetail>(`/api/projects/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setProject(updated)
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id || !e.target.files?.[0]) return
    const file = e.target.files[0]
    const form = new FormData()
    form.append('file', file)
    const photo = await apiFetch<{ id: string; storagePath: string }>(`/api/projects/${id}/photos`, {
      method: 'POST',
      headers: {},
      body: form,
    })
    setProject((prev) => prev ? { ...prev, photos: [...prev.photos, photo] } : prev)
    e.target.value = ''
  }

  if (loading) return <div className="p-8 text-gray-500">Načítám…</div>
  if (!project) return <div className="p-8 text-red-500">Zakázka nenalezena</div>

  const nextStatuses = NEXT_STATUSES[project.status] ?? []

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.clientName && <p className="text-gray-500 mt-1">{project.clientName}</p>}
          {project.address && <p className="text-xs text-gray-400">{project.address}</p>}
        </div>
        <span className="text-sm font-medium px-3 py-1 rounded-full bg-blue-100 text-blue-700">
          {STATUS_LABEL[project.status]}
        </span>
      </div>

      {/* Status transitions */}
      {nextStatuses.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-500 self-center">Přejít na:</span>
          {nextStatuses.map((s) => (
            <button
              key={s}
              disabled={updatingStatus}
              onClick={() => void handleStatusChange(s)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              → {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {project.plannedStart && (
          <div>
            <dt className="text-gray-400">Plánovaný start</dt>
            <dd className="font-medium">{project.plannedStart}</dd>
          </div>
        )}
        {project.plannedEnd && (
          <div>
            <dt className="text-gray-400">Plánovaný konec</dt>
            <dd className="font-medium">{project.plannedEnd}</dd>
          </div>
        )}
        {project.actualStart && (
          <div>
            <dt className="text-gray-400">Skutečný start</dt>
            <dd className="font-medium">{project.actualStart}</dd>
          </div>
        )}
        {project.actualEnd && (
          <div>
            <dt className="text-gray-400">Skutečný konec</dt>
            <dd className="font-medium">{project.actualEnd}</dd>
          </div>
        )}
        {project.clientPhone && (
          <div>
            <dt className="text-gray-400">Telefon klienta</dt>
            <dd className="font-medium">{project.clientPhone}</dd>
          </div>
        )}
        {project.clientEmail && (
          <div>
            <dt className="text-gray-400">Email klienta</dt>
            <dd className="font-medium">{project.clientEmail}</dd>
          </div>
        )}
      </div>

      {/* Linked budgets */}
      {project.budgets.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Rozpočty</h2>
          <div className="space-y-1">
            {project.budgets.map((b) => (
              <Link
                key={b.id}
                to={`/budgets/${b.id}`}
                className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400"
              >
                <span className="text-sm font-medium">{b.name}</span>
                <span className="text-sm text-gray-500">{b.totalWithoutVat.toLocaleString('cs-CZ')} Kč</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Fotky</h2>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Přidat fotku
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handlePhotoUpload(e)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {project.photos.map((photo) => (
            <div key={photo.id} className="relative rounded-lg overflow-hidden bg-gray-100 aspect-square">
              <img
                src={`/api/projects/${project.id}/photos/${photo.id}`}
                alt={photo.caption ?? ''}
                className="w-full h-full object-cover"
              />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
          {project.photos.length === 0 && (
            <p className="col-span-3 text-gray-400 text-sm text-center py-8">Žádné fotky</p>
          )}
        </div>
      </div>
    </div>
  )
}
