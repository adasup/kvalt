import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TeamsService } from './teams.service.js'
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
  end.limit = vi.fn().mockResolvedValue(rows)
  end.orderBy = vi.fn().mockReturnValue(end)
  end.where = vi.fn().mockReturnValue(end)
  end.innerJoin = vi.fn().mockReturnValue(end)
  const fromChain = {
    where: vi.fn().mockReturnValue(end),
    orderBy: vi.fn().mockReturnValue(end),
    innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(end) }),
    leftJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(end) }),
  }
  return { from: vi.fn().mockReturnValue(fromChain) }
}

function updateChain(rows: unknown[]) {
  const whereMock = vi.fn().mockReturnValue(returning(rows))
  return { set: vi.fn().mockReturnValue({ where: whereMock }) }
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
const TEAM_ID = 'team-1'
const LEADER_ID = 'user-leader'
const WORKER_ID = 'user-worker'

const mockTeam = {
  id: TEAM_ID,
  companyId: COMPANY_ID,
  name: 'Parťák Novotný',
  leaderId: LEADER_ID,
  color: '#2563EB',
  createdAt: new Date('2026-04-21'),
}

const mockMember = {
  teamId: TEAM_ID,
  userId: WORKER_ID,
}

const mockUser = {
  id: WORKER_ID,
  fullName: 'Karel Dvořák',
  role: 'WORKER',
  email: 'dvorak@example.cz',
  phone: null,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TeamsService.create', () => {
  it('inserts a team and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockTeam])) } as never)
    const service = new TeamsService(db)

    const result = await service.create(COMPANY_ID, { name: 'Parťák Novotný', leaderId: LEADER_ID })
    expect(result.name).toBe('Parťák Novotný')
    expect(result.companyId).toBe(COMPANY_ID)
  })

  it('throws if insert returns nothing', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([])) } as never)
    const service = new TeamsService(db)

    await expect(service.create(COMPANY_ID, { name: 'Test' })).rejects.toThrow()
  })
})

describe('TeamsService.list', () => {
  it('returns all teams for company', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockTeam]) as never)
    const service = new TeamsService(db)

    const result = await service.list(COMPANY_ID)
    expect(result).toHaveLength(1)
    expect(result[0]?.companyId).toBe(COMPANY_ID)
  })

  it('filters to only the team where userId is leader', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockTeam]) as never)
    const service = new TeamsService(db)

    const result = await service.list(COMPANY_ID, { leaderId: LEADER_ID })
    expect(db.select).toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })
})

describe('TeamsService.getById', () => {
  it('returns team with members', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockTeam]) as never)
      .mockReturnValueOnce(selectChain([{ ...mockMember, ...mockUser }]) as never)
    const service = new TeamsService(db)

    const result = await service.getById(COMPANY_ID, TEAM_ID)
    expect(result).not.toBeNull()
    expect(result?.members).toHaveLength(1)
    expect(result?.members[0]?.userId).toBe(WORKER_ID)
  })

  it('returns null when not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new TeamsService(db)

    expect(await service.getById(COMPANY_ID, 'nonexistent')).toBeNull()
  })

  it('does not return teams from other companies', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new TeamsService(db)

    expect(await service.getById('other-company', TEAM_ID)).toBeNull()
  })
})

describe('TeamsService.update', () => {
  it('updates team name and returns updated row', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain([{ ...mockTeam, name: 'Nové jméno' }]) as never)
    const service = new TeamsService(db)

    const result = await service.update(COMPANY_ID, TEAM_ID, { name: 'Nové jméno' })
    expect(result.name).toBe('Nové jméno')
  })

  it('throws when team not found', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain([]) as never)
    const service = new TeamsService(db)

    await expect(service.update(COMPANY_ID, 'none', { name: 'X' })).rejects.toThrow('Team not found')
  })
})

describe('TeamsService.addMember', () => {
  it('inserts team member and returns pair', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockMember])) } as never)
    const service = new TeamsService(db)

    const result = await service.addMember(TEAM_ID, WORKER_ID)
    expect(result.teamId).toBe(TEAM_ID)
    expect(result.userId).toBe(WORKER_ID)
  })

  it('throws if insert fails', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([])) } as never)
    const service = new TeamsService(db)

    await expect(service.addMember(TEAM_ID, WORKER_ID)).rejects.toThrow()
  })
})

describe('TeamsService.removeMember', () => {
  it('deletes team member', async () => {
    const db = makeDb()
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never)
    const service = new TeamsService(db)

    await service.removeMember(TEAM_ID, WORKER_ID)
    expect(db.delete).toHaveBeenCalled()
  })
})

describe('TeamsService.isLeader', () => {
  it('returns true when user is team leader', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockTeam]) as never)
    const service = new TeamsService(db)

    expect(await service.isLeader(COMPANY_ID, TEAM_ID, LEADER_ID)).toBe(true)
  })

  it('returns false when user is not team leader', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([{ ...mockTeam, leaderId: 'someone-else' }]) as never)
    const service = new TeamsService(db)

    expect(await service.isLeader(COMPANY_ID, TEAM_ID, WORKER_ID)).toBe(false)
  })

  it('returns false when team not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new TeamsService(db)

    expect(await service.isLeader(COMPANY_ID, 'none', LEADER_ID)).toBe(false)
  })
})

describe('TeamsService.getMemberTeam', () => {
  it('returns the team a user belongs to', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([{ teamId: TEAM_ID, ...mockTeam }]) as never)
    const service = new TeamsService(db)

    const result = await service.getMemberTeam(COMPANY_ID, WORKER_ID)
    expect(result?.id).toBe(TEAM_ID)
  })

  it('returns null when user is not in any team', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new TeamsService(db)

    expect(await service.getMemberTeam(COMPANY_ID, WORKER_ID)).toBeNull()
  })
})
