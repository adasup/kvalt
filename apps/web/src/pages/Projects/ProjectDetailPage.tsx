import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import type { ProjectStatus } from '@kvalt/shared'
import { ArrowLeft, Phone, Mail, MapPin, Camera, ArrowRight, Calendar } from 'lucide-react'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  OFFER: 'Nabídka', APPROVED: 'Schváleno', IN_PROGRESS: 'Probíhá',
  HANDOVER: 'Předání', INVOICED: 'Fakturováno', PAID: 'Zaplaceno', CANCELLED: 'Zrušeno',
}
const STATUS_COLOR: Record<ProjectStatus, string> = {
  OFFER: 'bg-gray-100 text-gray-600', APPROVED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700', HANDOVER: 'bg-orange-100 text-orange-700',
  INVOICED: 'bg-violet-100 text-violet-700', PAID: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-600',
}
const NEXT_STATUSES: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  OFFER: ['APPROVED', 'CANCELLED'], APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['HANDOVER', 'CANCELLED'], HANDOVER: ['INVOICED', 'IN_PROGRESS'], INVOICED: ['PAID'],
}

interface ProjectDetail {
  id: string; name: string; clientName?: string; clientEmail?: string; clientPhone?: string
  address?: string; status: ProjectStatus; plannedStart?: string; plannedEnd?: string
  actualStart?: string; actualEnd?: string; notes?: string
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
    apiFetch<ProjectDetail>(`/api/projects/${id}`).then(setProject).finally(() => setLoading(false))
  }, [id])

  async function handleStatusChange(newStatus: ProjectStatus) {
    if (!id) return
    setUpdatingStatus(true)
    try {
      const updated = await apiFetch<ProjectDetail>(`/api/projects/${id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status: newStatus }),
      })
      setProject(updated)
    } finally { setUpdatingStatus(false) }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id || !e.target.files?.[0]) return
    const form = new FormData()
    form.append('file', e.target.files[0])
    const photo = await apiFetch<{ id: string; storagePath: string }>(`/api/projects/${id}/photos`, {
      method: 'POST', headers: {}, body: form,
    })
    setProject((prev) => prev ? { ...prev, photos: [...prev.photos, photo] } : prev)
    e.target.value = ''
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Načítám…</div>
  if (!project) return <div className="p-8 text-sm text-red-500">Zakázka nenalezena</div>

  const nextStatuses = NEXT_STATUSES[project.status] ?? []

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to="/projects" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-2 transition-colors">
          <ArrowLeft size={14} /> Zakázky
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.clientName && (
              <p className="text-gray-500 mt-0.5 flex items-center gap-1.5"><span>{project.clientName}</span></p>
            )}
            {project.address && (
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={12} />{project.address}</p>
            )}
          </div>
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl shrink-0 ${STATUS_COLOR[project.status]}`}>
            {STATUS_LABEL[project.status]}
          </span>
        </div>
      </div>

      {/* Status transitions */}
      {nextStatuses.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-400 font-medium">Přejít na:</span>
          {nextStatuses.map((s) => (
            <button key={s} disabled={updatingStatus} onClick={() => void handleStatusChange(s)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl border transition-all disabled:opacity-50 ${
                s === 'CANCELLED'
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 bg-white'
              }`}>
              <ArrowRight size={13} /> {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Info card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4 text-sm">Informace o zakázce</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                { label: 'Plánovaný start', value: project.plannedStart },
                { label: 'Plánovaný konec', value: project.plannedEnd },
                { label: 'Skutečný start', value: project.actualStart },
                { label: 'Skutečný konec', value: project.actualEnd },
              ].filter((f) => f.value).map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-gray-400 mb-0.5 flex items-center gap-1"><Calendar size={10} />{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
            {project.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Poznámky</p>
                <p className="text-sm text-gray-700">{project.notes}</p>
              </div>
            )}
          </div>

          {/* Photos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 text-sm">Fotky ({project.photos.length})</h2>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                <Camera size={12} /> Přidat
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handlePhotoUpload(e)} />
            </div>
            {project.photos.length === 0 ? (
              <div className="border-2 border-dashed border-gray-100 rounded-xl py-10 text-center">
                <Camera size={24} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Žádné fotky</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {project.photos.map((photo) => (
                  <div key={photo.id} className="relative rounded-xl overflow-hidden bg-gray-100 aspect-square">
                    <img src={`/api/projects/${project.id}/photos/${photo.id}`} alt={photo.caption ?? ''}
                      className="w-full h-full object-cover" />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs">
                        {photo.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client contact */}
          {(project.clientPhone || project.clientEmail) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Kontakt</h2>
              <div className="space-y-2">
                {project.clientPhone && (
                  <a href={`tel:${project.clientPhone}`}
                    className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                    <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Phone size={13} className="text-gray-500" />
                    </div>
                    {project.clientPhone}
                  </a>
                )}
                {project.clientEmail && (
                  <a href={`mailto:${project.clientEmail}`}
                    className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                    <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Mail size={13} className="text-gray-500" />
                    </div>
                    {project.clientEmail}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Linked budgets */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Rozpočty</h2>
            {project.budgets.length === 0 ? (
              <p className="text-sm text-gray-400">Žádné napojené rozpočty</p>
            ) : (
              <div className="space-y-2">
                {project.budgets.map((b) => (
                  <Link key={b.id} to={`/budgets/${b.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                    <div>
                      <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{b.name}</div>
                      <div className="text-xs text-gray-400">{Math.round(b.totalWithoutVat).toLocaleString('cs-CZ')} Kč</div>
                    </div>
                    <ArrowRight size={13} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
