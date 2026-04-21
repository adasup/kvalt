import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanningService } from './planning.service.js'
import type { Db } from '../db/client.js'

// ─── DB mock helpers ──────────────────────────────────────────────────────────

function returning(rows: unknown[]) {
  return { returning: vi.fn().mockResolvedValue(rows) }
}

function selectChain(rows: unknown[]) {
  const p = Promise.resolve(rows)
  // A chainable node that supports all Drizzle query builder methods
  const node: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  const self = () => node
  node.limit = vi.fn().mockResolvedValue(rows)
  node.orderBy = vi.fn().mockReturnValue(node)
  node.where = vi.fn().mockReturnValue(node)
  node.innerJoin = vi.fn().mockReturnValue(node)
  node.leftJoin = vi.fn().mockReturnValue(node)
  node.from = vi.fn().mockReturnValue(node)
  return { from: vi.fn().mockReturnValue(node) }
}

function updateChain(rows: unknown[]) {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(returning(rows)) }) }
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
const TEAM_ID = 'team-1'
const USER_ID = 'user-1'
const CREATOR_ID = 'creator-1'

const mockAssignment = {
  id: 'assign-1',
  companyId: COMPANY_ID,
  projectId: PROJECT_ID,
  date: '2026-04-22',
  teamId: TEAM_ID,
  userId: null,
  status: 'PLANNED' as const,
  startTime: '07:00',
  endTime: '16:00',
  description: 'Bourání příček',
  notes: null,
  notificationSent: false,
  createdById: CREATOR_ID,
  createdAt: new Date('2026-04-21'),
  updatedAt: new Date('2026-04-21'),
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanningService.create', () => {
  it('creates an assignment for a team', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockAssignment])) } as never)
    const service = new PlanningService(db)

    const result = await service.create(COMPANY_ID, CREATOR_ID, {
      projectId: PROJECT_ID,
      date: '2026-04-22',
      teamId: TEAM_ID,
      startTime: '07:00',
      endTime: '16:00',
    })

    expect(result.teamId).toBe(TEAM_ID)
    expect(result.date).toBe('2026-04-22')
    expect(result.status).toBe('PLANNED')
  })

  it('creates an assignment for an individual user', async () => {
    const userAssignment = { ...mockAssignment, teamId: null, userId: USER_ID }
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([userAssignment])) } as never)
    const service = new PlanningService(db)

    const result = await service.create(COMPANY_ID, CREATOR_ID, {
      projectId: PROJECT_ID,
      date: '2026-04-22',
      userId: USER_ID,
    })

    expect(result.userId).toBe(USER_ID)
    expect(result.teamId).toBeNull()
  })

  it('throws when neither teamId nor userId is provided', async () => {
    const db = makeDb()
    const service = new PlanningService(db)

    await expect(
      service.create(COMPANY_ID, CREATOR_ID, { projectId: PROJECT_ID, date: '2026-04-22' }),
    ).rejects.toThrow('teamId or userId required')
  })

  it('throws if insert returns nothing', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([])) } as never)
    const service = new PlanningService(db)

    await expect(
      service.create(COMPANY_ID, CREATOR_ID, { projectId: PROJECT_ID, date: '2026-04-22', teamId: TEAM_ID }),
    ).rejects.toThrow()
  })
})

describe('PlanningService.bulkCreate', () => {
  it('creates one assignment per date in a single bulk insert', async () => {
    const db = makeDb()
    const mockAssignment2 = { ...mockAssignment, id: 'assign-2', date: '2026-04-23' }
    const mockAssignment3 = { ...mockAssignment, id: 'assign-3', date: '2026-04-24' }
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue(returning([mockAssignment, mockAssignment2, mockAssignment3])),
    } as never)
    const service = new PlanningService(db)

    const results = await service.bulkCreate(COMPANY_ID, CREATOR_ID, {
      projectId: PROJECT_ID,
      teamId: TEAM_ID,
      dates: ['2026-04-22', '2026-04-23', '2026-04-24'],
    })

    expect(results).toHaveLength(3)
    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  it('returns empty array for empty dates', async () => {
    const db = makeDb()
    const service = new PlanningService(db)

    const results = await service.bulkCreate(COMPANY_ID, CREATOR_ID, {
      projectId: PROJECT_ID,
      teamId: TEAM_ID,
      dates: [],
    })

    expect(results).toEqual([])
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('PlanningService.getWeekBoard', () => {
  it('returns assignments grouped by team for the week', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([
      {
        ...mockAssignment,
        projectName: 'Novákovi',
        projectAddress: 'Hlavní 1',
        teamName: 'Parťák Novotný',
        teamColor: '#2563EB',
      },
    ]) as never)
    const service = new PlanningService(db)

    const result = await service.getWeekBoard(COMPANY_ID, '2026-W17')

    expect(result.week).toBe('2026-W17')
    expect(result.days).toHaveLength(7)
    expect(result.assignments).toHaveLength(1)
  })

  it('returns correct 7 days for week 2026-W17', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new PlanningService(db)

    const result = await service.getWeekBoard(COMPANY_ID, '2026-W17')

    expect(result.days[0]).toBe('2026-04-20') // Monday
    expect(result.days[6]).toBe('2026-04-26') // Sunday
  })

  it('throws on invalid week format', async () => {
    const db = makeDb()
    const service = new PlanningService(db)

    await expect(service.getWeekBoard(COMPANY_ID, '2026-17')).rejects.toThrow()
  })
})

describe('PlanningService.getMyTomorrow', () => {
  it('returns tomorrow assignment for a user', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(
      selectChain([{
        ...mockAssignment,
        date: tomorrowStr,
        projectName: 'Novákovi',
        projectAddress: 'Hlavní 1, Praha',
        userId: USER_ID,
        teamId: null,
      }]) as never,
    )
    const service = new PlanningService(db)

    const result = await service.getMyTomorrow(USER_ID, tomorrowStr)

    expect(result).not.toBeNull()
    expect(result?.date).toBe(tomorrowStr)
  })

  it('returns null when no assignment tomorrow', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new PlanningService(db)

    expect(await service.getMyTomorrow(USER_ID, '2026-04-22')).toBeNull()
  })
})

describe('PlanningService.checkConflict', () => {
  it('returns true when user is already assigned on that date', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockAssignment]) as never)
    const service = new PlanningService(db)

    expect(await service.checkConflict(USER_ID, '2026-04-22')).toBe(true)
  })

  it('returns false when user has no assignment that day', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new PlanningService(db)

    expect(await service.checkConflict(USER_ID, '2026-04-22')).toBe(false)
  })
})

describe('PlanningService.update', () => {
  it('updates assignment fields', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain([{ ...mockAssignment, description: 'Nový popis' }]) as never)
    const service = new PlanningService(db)

    const result = await service.update(COMPANY_ID, 'assign-1', { description: 'Nový popis' })
    expect(result.description).toBe('Nový popis')
  })

  it('throws when assignment not found', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain([]) as never)
    const service = new PlanningService(db)

    await expect(service.update(COMPANY_ID, 'none', {})).rejects.toThrow('Assignment not found')
  })
})

describe('PlanningService.delete', () => {
  it('deletes an assignment', async () => {
    const db = makeDb()
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never)
    const service = new PlanningService(db)

    await service.delete(COMPANY_ID, 'assign-1')
    expect(db.delete).toHaveBeenCalled()
  })
})

describe('PlanningService.markNotificationSent', () => {
  it('sets notificationSent to true', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain([{ ...mockAssignment, notificationSent: true }]) as never)
    const service = new PlanningService(db)

    await service.markNotificationSent('assign-1')
    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg?.notificationSent).toBe(true)
  })
})
