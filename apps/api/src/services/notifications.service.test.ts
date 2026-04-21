import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationsService, buildPushMessage, type PushPayload } from './notifications.service.js'
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

function updateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }
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

const mockAssignment = {
  id: 'assign-1',
  companyId: COMPANY_ID,
  projectId: 'project-1',
  date: '2026-04-22',
  teamId: null,
  userId: 'user-1',
  status: 'PLANNED',
  startTime: '07:00',
  endTime: '16:00',
  description: 'Bourání příček',
  notes: null,
  notificationSent: false,
  createdById: 'creator-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  projectName: 'Novákovi',
  projectAddress: 'Hlavní 1, Praha',
  teamName: null,
  teamColor: null,
}

const mockTeamAssignment = {
  ...mockAssignment,
  id: 'assign-2',
  teamId: 'team-1',
  userId: null,
  teamName: 'Parťák Novotný',
  teamColor: '#2563EB',
}

const mockUser = {
  id: 'user-1',
  fullName: 'Karel Dvořák',
  pushToken: 'ExponentPushToken[abc123]',
}

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'tomorrow_assignment' as const,
  title: 'Zítra: Novákovi',
  body: 'v 07:00 · Hlavní 1, Praha',
  data: null,
  read: false,
  sentAt: new Date(),
}

// ─── Tests: buildPushMessage ───────────────────────────────────────────────────

describe('buildPushMessage', () => {
  it('generates correct title from project name', () => {
    const msg = buildPushMessage(mockAssignment, mockUser.fullName)
    expect(msg.title).toBe('Zítra: Novákovi')
  })

  it('includes start time in body', () => {
    const msg = buildPushMessage(mockAssignment, mockUser.fullName)
    expect(msg.body).toContain('07:00')
  })

  it('includes address when available', () => {
    const msg = buildPushMessage(mockAssignment, mockUser.fullName)
    expect(msg.body).toContain('Hlavní 1, Praha')
  })

  it('includes description when available', () => {
    const msg = buildPushMessage(mockAssignment, mockUser.fullName)
    expect(msg.body).toContain('Bourání příček')
  })

  it('omits address line when not available', () => {
    const noAddr = { ...mockAssignment, projectAddress: null }
    const msg = buildPushMessage(noAddr, mockUser.fullName)
    expect(msg.body).not.toContain('null')
  })

  it('includes team name for team assignment', () => {
    const msg = buildPushMessage(mockTeamAssignment, mockUser.fullName)
    expect(msg.body).toContain('Parťák Novotný')
  })
})

// ─── Tests: NotificationsService ─────────────────────────────────────────────

describe('NotificationsService.getUsersForAssignment', () => {
  it('returns single user for user-based assignment', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockUser]) as never)
    const service = new NotificationsService(db)

    const users = await service.getUsersForAssignment(mockAssignment)
    expect(users).toHaveLength(1)
    expect(users[0]?.id).toBe('user-1')
  })

  it('returns team members for team-based assignment', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(
      selectChain([mockUser, { id: 'user-2', fullName: 'Jan Novák', pushToken: 'ExponentPushToken[def456]' }]) as never,
    )
    const service = new NotificationsService(db)

    const users = await service.getUsersForAssignment(mockTeamAssignment)
    expect(users).toHaveLength(2)
  })

  it('returns empty array when no userId and no teamId', async () => {
    const db = makeDb()
    const service = new NotificationsService(db)

    const users = await service.getUsersForAssignment({ ...mockAssignment, userId: null, teamId: null })
    expect(users).toEqual([])
  })
})

describe('NotificationsService.saveNotification', () => {
  it('inserts a notification record and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockNotification])) } as never)
    const service = new NotificationsService(db)

    const result = await service.saveNotification({
      userId: 'user-1',
      type: 'tomorrow_assignment',
      title: 'Zítra: Novákovi',
      body: 'v 07:00',
    })
    expect(result.userId).toBe('user-1')
    expect(result.type).toBe('tomorrow_assignment')
  })
})

describe('NotificationsService.listForUser', () => {
  it('returns notifications for user ordered by date', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockNotification]) as never)
    const service = new NotificationsService(db)

    const result = await service.listForUser('user-1')
    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('tomorrow_assignment')
  })
})

describe('NotificationsService.markRead', () => {
  it('sets read=true on notification', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain() as never)
    const service = new NotificationsService(db)

    await service.markRead('notif-1', 'user-1')
    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg?.read).toBe(true)
  })
})

describe('NotificationsService.sendTomorrowNotifications', () => {
  it('calls push once with array of payloads for users with token', async () => {
    const db = makeDb()
    // getUsersForAssignment → user with push token
    vi.mocked(db.select).mockReturnValue(selectChain([mockUser]) as never)
    // bulk insert notifications
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue([mockNotification]) } as never)
    // bulk update assignments
    vi.mocked(db.update).mockReturnValue(updateChain() as never)

    const mockSendPush = vi.fn().mockResolvedValue(undefined)
    const service = new NotificationsService(db)

    await service.sendTomorrowNotifications([mockAssignment as never], mockSendPush)

    expect(mockSendPush).toHaveBeenCalledOnce()
    const payloads = mockSendPush.mock.calls[0]?.[0] as PushPayload[]
    expect(Array.isArray(payloads)).toBe(true)
    expect(payloads[0]?.to).toBe(mockUser.pushToken)
    expect(payloads[0]?.title).toContain('Novákovi')
  })

  it('skips users without push token but still saves notification in DB', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([{ ...mockUser, pushToken: null }]) as never)
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue([mockNotification]) } as never)
    vi.mocked(db.update).mockReturnValue(updateChain() as never)

    const mockSendPush = vi.fn().mockResolvedValue(undefined)
    const service = new NotificationsService(db)

    await service.sendTomorrowNotifications([mockAssignment as never], mockSendPush)

    // Push called once with empty array (no tokens)
    expect(mockSendPush).toHaveBeenCalledOnce()
    const payloads = mockSendPush.mock.calls[0]?.[0] as PushPayload[]
    expect(payloads).toHaveLength(0)
  })

  it('marks all assignments as notificationSent=true after processing', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockUser]) as never)
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue([mockNotification]) } as never)
    vi.mocked(db.update).mockReturnValue(updateChain() as never)

    const service = new NotificationsService(db)
    await service.sendTomorrowNotifications([mockAssignment as never], vi.fn().mockResolvedValue(undefined))

    expect(db.update).toHaveBeenCalled()
    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg?.notificationSent).toBe(true)
  })

  it('handles empty assignments list', async () => {
    const db = makeDb()
    const mockSendPush = vi.fn()
    const service = new NotificationsService(db)

    await service.sendTomorrowNotifications([], mockSendPush)
    expect(mockSendPush).not.toHaveBeenCalled()
  })
})

describe('NotificationsService.registerPushToken', () => {
  it('updates user pushToken in DB', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue(updateChain() as never)
    const service = new NotificationsService(db)

    await service.registerPushToken('user-1', 'ExponentPushToken[xyz]')
    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg?.pushToken).toBe('ExponentPushToken[xyz]')
  })
})
