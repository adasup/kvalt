import { describe, it, expect, vi } from 'vitest'
import { DiaryService } from './diary.service.js'
import type { Db } from '../db/client.js'

// ─── DB mock helpers ──────────────────────────────────────────────────────────

function returning(rows: unknown[]) {
  return { returning: vi.fn().mockResolvedValue(rows) }
}

function selectChain(rows: unknown[]) {
  const p = Promise.resolve(rows)
  const node: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  node.limit = vi.fn().mockResolvedValue(rows)
  node.orderBy = vi.fn().mockReturnValue(node)
  node.where = vi.fn().mockReturnValue(node)
  node.innerJoin = vi.fn().mockReturnValue(node)
  node.leftJoin = vi.fn().mockReturnValue(node)
  return { from: vi.fn().mockReturnValue(node) }
}

function updateChain(returned: unknown[] = []) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(returned) }),
    }),
  }
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

const mockEntry = {
  id: 'entry-1',
  projectId: 'project-1',
  authorId: 'user-1',
  date: '2026-04-21',
  weather: 'Slunečno',
  temperature: 18,
  description: 'Proběhlo bourání příček v 1. NP.',
  workersPresent: 4,
  createdAt: new Date(),
}

const mockPhoto = {
  id: 'photo-1',
  diaryEntryId: 'entry-1',
  storagePath: 'diary/entry-1/photo-1.jpg',
  caption: 'Stav po bourání',
}

const mockExtraWork = {
  id: 'extra-1',
  projectId: 'project-1',
  description: 'Dodatečné vybourání dveřního otvoru',
  scope: '1 ks',
  estimatedPrice: 5000,
  approvedByClient: false,
  createdAt: new Date(),
}

// ─── Tests: DiaryService.create ───────────────────────────────────────────────

describe('DiaryService.create', () => {
  it('inserts a diary entry and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockEntry])) } as never)
    const service = new DiaryService(db)

    const result = await service.create({
      projectId: 'project-1',
      authorId: 'user-1',
      date: '2026-04-21',
      description: 'Proběhlo bourání příček v 1. NP.',
      weather: 'Slunečno',
      temperature: 18,
      workersPresent: 4,
    })

    expect(result.projectId).toBe('project-1')
    expect(result.description).toBe('Proběhlo bourání příček v 1. NP.')
  })

  it('throws if insert returns nothing', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([])) } as never)
    const service = new DiaryService(db)

    await expect(
      service.create({ projectId: 'p', authorId: 'u', date: '2026-04-21', description: 'test' }),
    ).rejects.toThrow('Failed to create')
  })
})

// ─── Tests: DiaryService.list ─────────────────────────────────────────────────

describe('DiaryService.list', () => {
  it('returns entries for a project ordered by date desc', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockEntry]) as never)
    const service = new DiaryService(db)

    const result = await service.list('project-1')
    expect(result).toHaveLength(1)
    expect(result[0]?.projectId).toBe('project-1')
  })
})

// ─── Tests: DiaryService.getById ─────────────────────────────────────────────

describe('DiaryService.getById', () => {
  it('returns entry with photos', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockEntry]) as never)
      .mockReturnValueOnce(selectChain([mockPhoto]) as never)
    const service = new DiaryService(db)

    const result = await service.getById('entry-1', 'project-1')
    expect(result).not.toBeNull()
    expect(result?.entry.id).toBe('entry-1')
    expect(result?.photos).toHaveLength(1)
  })

  it('returns null when not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new DiaryService(db)

    const result = await service.getById('missing', 'project-1')
    expect(result).toBeNull()
  })
})

// ─── Tests: DiaryService.update ───────────────────────────────────────────────

describe('DiaryService.update', () => {
  it('updates description and returns updated entry', async () => {
    const db = makeDb()
    const updated = { ...mockEntry, description: 'Updated text' }
    vi.mocked(db.update).mockReturnValue(updateChain([updated]) as never)
    const service = new DiaryService(db)

    const result = await service.update('entry-1', { description: 'Updated text' })
    expect(result.description).toBe('Updated text')
  })

  it('throws when entry not found', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain([]) as never)
    const service = new DiaryService(db)

    await expect(service.update('missing', { description: 'x' })).rejects.toThrow('not found')
  })
})

// ─── Tests: DiaryService.delete ───────────────────────────────────────────────

describe('DiaryService.delete', () => {
  it('deletes an entry', async () => {
    const db = makeDb()
    vi.mocked(db.delete).mockReturnValue(deleteChain() as never)
    const service = new DiaryService(db)

    await expect(service.delete('entry-1')).resolves.toBeUndefined()
    expect(db.delete).toHaveBeenCalled()
  })
})

// ─── Tests: DiaryService.addPhoto ────────────────────────────────────────────

describe('DiaryService.addPhoto', () => {
  it('inserts a photo record and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockPhoto])) } as never)
    const service = new DiaryService(db)

    const result = await service.addPhoto('entry-1', 'diary/entry-1/photo-1.jpg', 'Stav po bourání')
    expect(result.storagePath).toBe('diary/entry-1/photo-1.jpg')
    expect(result.caption).toBe('Stav po bourání')
  })
})

// ─── Tests: DiaryService.deletePhoto ─────────────────────────────────────────

describe('DiaryService.deletePhoto', () => {
  it('removes photo and returns its storagePath for R2 deletion', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockPhoto]) as never)
    vi.mocked(db.delete).mockReturnValue(deleteChain() as never)
    const service = new DiaryService(db)

    const path = await service.deletePhoto('photo-1')
    expect(path).toBe('diary/entry-1/photo-1.jpg')
  })

  it('throws when photo not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new DiaryService(db)

    await expect(service.deletePhoto('missing')).rejects.toThrow('not found')
  })
})

// ─── Tests: DiaryService.addExtraWork ────────────────────────────────────────

describe('DiaryService.addExtraWork', () => {
  it('inserts an extra work record', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockExtraWork])) } as never)
    const service = new DiaryService(db)

    const result = await service.addExtraWork({
      projectId: 'project-1',
      description: 'Dodatečné vybourání dveřního otvoru',
      scope: '1 ks',
      estimatedPrice: 5000,
    })
    expect(result.description).toContain('dveřního')
    expect(result.approvedByClient).toBe(false)
  })
})

// ─── Tests: DiaryService.listExtraWorks ──────────────────────────────────────

describe('DiaryService.listExtraWorks', () => {
  it('returns extra works for a project', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockExtraWork]) as never)
    const service = new DiaryService(db)

    const result = await service.listExtraWorks('project-1')
    expect(result).toHaveLength(1)
    expect(result[0]?.projectId).toBe('project-1')
  })
})

// ─── Tests: DiaryService.approveExtraWork ────────────────────────────────────

describe('DiaryService.approveExtraWork', () => {
  it('sets approvedByClient=true', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain([]) as never)
    const service = new DiaryService(db)

    await service.approveExtraWork('extra-1')
    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg?.approvedByClient).toBe(true)
  })
})

// ─── Tests: DiaryService.structureWithAI ─────────────────────────────────────

describe('DiaryService.structureWithAI', () => {
  it('calls claudeFn and returns structured text', async () => {
    const db = makeDb()
    const service = new DiaryService(db)
    const mockClaudeFn = vi.fn().mockResolvedValue('Structured: installed windows on 2nd floor.')

    const result = await service.structureWithAI('Dávali jsme okna ve druhém patře.', mockClaudeFn)
    expect(mockClaudeFn).toHaveBeenCalledOnce()
    expect(result).toContain('Structured')
  })

  it('returns original text when claudeFn throws', async () => {
    const db = makeDb()
    const service = new DiaryService(db)
    const mockClaudeFn = vi.fn().mockRejectedValue(new Error('API down'))

    const result = await service.structureWithAI('Raw text', mockClaudeFn)
    expect(result).toBe('Raw text')
  })
})
