import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectsService, VALID_TRANSITIONS } from './projects.service.js'
import type { Db } from '../db/client.js'

// ─── DB mock helpers ──────────────────────────────────────────────────────────

function returning(rows: unknown[]) {
  return { returning: vi.fn().mockResolvedValue(rows) }
}

function selectChain(rows: unknown[]) {
  const p = Promise.resolve(rows)
  const end: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  end.offset = vi.fn().mockResolvedValue(rows)
  end.limit = vi.fn().mockReturnValue(end)
  end.orderBy = vi.fn().mockReturnValue(end)
  end.where = vi.fn().mockReturnValue(end)
  const fromChain = {
    where: vi.fn().mockReturnValue(end),
    orderBy: vi.fn().mockReturnValue(end),
    leftJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(end) }),
  }
  return { from: vi.fn().mockReturnValue(fromChain) }
}

function updateChain(rows: unknown[]) {
  const whereMock = vi.fn().mockReturnValue(returning(rows))
  const setMock = vi.fn().mockReturnValue({ where: whereMock })
  return { set: setMock }
}

function deleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) }
}

function makeDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as Db
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-1'
const PROJECT_ID = 'project-1'
const USER_ID = 'user-1'

const mockProject = {
  id: PROJECT_ID,
  companyId: COMPANY_ID,
  name: 'Rekonstrukce Novákovi',
  clientName: 'Jan Novák',
  clientEmail: 'novak@example.cz',
  clientPhone: '777123456',
  clientIco: null,
  address: 'Hlavní 1, Praha',
  status: 'OFFER' as const,
  plannedStart: '2026-05-01',
  plannedEnd: '2026-06-30',
  actualStart: null,
  actualEnd: null,
  notes: null,
  createdAt: new Date('2026-04-21'),
  updatedAt: new Date('2026-04-21'),
}

const mockPhoto = {
  id: 'photo-1',
  projectId: PROJECT_ID,
  storagePath: 'projects/project-1/photos/photo-1.jpg',
  caption: 'Před rekonstrukcí',
  createdAt: new Date('2026-04-21'),
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectsService.create', () => {
  it('inserts a project and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockProject])) } as never)
    const service = new ProjectsService(db)

    const result = await service.create(COMPANY_ID, { name: 'Rekonstrukce Novákovi' })

    expect(db.insert).toHaveBeenCalled()
    expect(result.name).toBe('Rekonstrukce Novákovi')
    expect(result.status).toBe('OFFER')
  })

  it('sets status to OFFER by default', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockProject])) } as never)
    const service = new ProjectsService(db)

    const result = await service.create(COMPANY_ID, { name: 'Test' })
    expect(result.status).toBe('OFFER')
  })

  it('throws if insert returns nothing', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([])) } as never)
    const service = new ProjectsService(db)

    await expect(service.create(COMPANY_ID, { name: 'Test' })).rejects.toThrow()
  })
})

describe('ProjectsService.list', () => {
  it('returns projects filtered by companyId', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockProject]) as never)
    const service = new ProjectsService(db)

    const result = await service.list(COMPANY_ID)
    expect(result).toHaveLength(1)
    expect(result[0]?.companyId).toBe(COMPANY_ID)
  })

  it('filters by status when provided', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockProject]) as never)
    const service = new ProjectsService(db)

    const result = await service.list(COMPANY_ID, { status: 'OFFER' })
    expect(db.select).toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })

  it('returns empty array when no projects', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new ProjectsService(db)

    expect(await service.list(COMPANY_ID)).toEqual([])
  })
})

describe('ProjectsService.getById', () => {
  it('returns project with photos and budget summary', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockProject]) as never)
      .mockReturnValueOnce(selectChain([mockPhoto]) as never)
      .mockReturnValueOnce(selectChain([{ id: 'b1', name: 'Rozpočet', totalWithoutVat: 50000, status: 'DRAFT' }]) as never)
    const service = new ProjectsService(db)

    const result = await service.getById(COMPANY_ID, PROJECT_ID)

    expect(result).not.toBeNull()
    expect(result?.id).toBe(PROJECT_ID)
    expect(result?.photos).toHaveLength(1)
    expect(result?.budgets).toHaveLength(1)
  })

  it('returns null when not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new ProjectsService(db)

    expect(await service.getById(COMPANY_ID, 'none')).toBeNull()
  })

  it('does not return projects from other companies', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new ProjectsService(db)

    expect(await service.getById('other-company', PROJECT_ID)).toBeNull()
  })
})

describe('ProjectsService.updateStatus', () => {
  it('allows valid transition OFFER → APPROVED', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockProject]) as never)
    vi.mocked(db.update).mockReturnValue(updateChain([{ ...mockProject, status: 'APPROVED' }]) as never)
    const service = new ProjectsService(db)

    const result = await service.updateStatus(COMPANY_ID, PROJECT_ID, 'APPROVED')
    expect(result.status).toBe('APPROVED')
  })

  it('allows valid transition OFFER → CANCELLED', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockProject]) as never)
    vi.mocked(db.update).mockReturnValue(updateChain([{ ...mockProject, status: 'CANCELLED' }]) as never)
    const service = new ProjectsService(db)

    const result = await service.updateStatus(COMPANY_ID, PROJECT_ID, 'CANCELLED')
    expect(result.status).toBe('CANCELLED')
  })

  it('rejects invalid transition OFFER → PAID', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockProject]) as never)
    const service = new ProjectsService(db)

    await expect(service.updateStatus(COMPANY_ID, PROJECT_ID, 'PAID')).rejects.toThrow('Invalid status transition')
  })

  it('rejects transition from terminal state PAID', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([{ ...mockProject, status: 'PAID' }]) as never)
    const service = new ProjectsService(db)

    await expect(service.updateStatus(COMPANY_ID, PROJECT_ID, 'CANCELLED')).rejects.toThrow('Invalid status transition')
  })

  it('sets actualStart when transitioning to IN_PROGRESS', async () => {
    const approvedProject = { ...mockProject, status: 'APPROVED' as const }
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([approvedProject]) as never)
    vi.mocked(db.update).mockReturnValue(updateChain([{ ...approvedProject, status: 'IN_PROGRESS', actualStart: '2026-05-01' }]) as never)
    const service = new ProjectsService(db)

    const result = await service.updateStatus(COMPANY_ID, PROJECT_ID, 'IN_PROGRESS')
    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg).toHaveProperty('actualStart')
    expect(result.status).toBe('IN_PROGRESS')
  })

  it('sets actualEnd when transitioning to HANDOVER', async () => {
    const inProgressProject = { ...mockProject, status: 'IN_PROGRESS' as const }
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([inProgressProject]) as never)
    vi.mocked(db.update).mockReturnValue(updateChain([{ ...inProgressProject, status: 'HANDOVER', actualEnd: '2026-06-30' }]) as never)
    const service = new ProjectsService(db)

    const result = await service.updateStatus(COMPANY_ID, PROJECT_ID, 'HANDOVER')
    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg).toHaveProperty('actualEnd')
    expect(result.status).toBe('HANDOVER')
  })
})

describe('VALID_TRANSITIONS', () => {
  it('covers all non-terminal statuses', () => {
    expect(VALID_TRANSITIONS).toHaveProperty('OFFER')
    expect(VALID_TRANSITIONS).toHaveProperty('APPROVED')
    expect(VALID_TRANSITIONS).toHaveProperty('IN_PROGRESS')
    expect(VALID_TRANSITIONS).toHaveProperty('HANDOVER')
    expect(VALID_TRANSITIONS).toHaveProperty('INVOICED')
  })

  it('PAID and CANCELLED have no valid transitions', () => {
    expect(VALID_TRANSITIONS['PAID']).toBeUndefined()
    expect(VALID_TRANSITIONS['CANCELLED']).toBeUndefined()
  })
})

describe('ProjectsService.addPhoto', () => {
  it('inserts a photo record and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockPhoto])) } as never)
    const service = new ProjectsService(db)

    const result = await service.addPhoto(PROJECT_ID, 'projects/project-1/photos/photo-1.jpg', 'Před rekonstrukcí')
    expect(result.storagePath).toBe('projects/project-1/photos/photo-1.jpg')
    expect(result.caption).toBe('Před rekonstrukcí')
  })

  it('inserts photo without caption', async () => {
    const db = makeDb()
    const photoNoCaption = { ...mockPhoto, storagePath: 'projects/project-1/photos/photo-2.jpg', caption: null }
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([photoNoCaption])) } as never)
    const service = new ProjectsService(db)

    const result = await service.addPhoto(PROJECT_ID, 'projects/project-1/photos/photo-2.jpg')
    expect(result.storagePath).toContain('photo-2.jpg')
  })
})

describe('ProjectsService.linkBudget', () => {
  it('sets projectId on a budget', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain([{ id: 'b1', projectId: PROJECT_ID }]) as never)
    const service = new ProjectsService(db)

    await service.linkBudget(COMPANY_ID, PROJECT_ID, 'b1')
    expect(db.update).toHaveBeenCalled()
  })
})
