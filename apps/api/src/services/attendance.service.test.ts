import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AttendanceService,
  calculateHoursWorked,
  calculateEarnings,
} from './attendance.service.js'
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

function updateChain(returned?: unknown[]) {
  const whereResult = returned
    ? { returning: vi.fn().mockResolvedValue(returned) }
    : { returning: vi.fn().mockResolvedValue([]) }
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(whereResult) }) }
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

const mockUser = {
  id: 'user-1',
  fullName: 'Karel Dvořák',
  hourlyRate: 200,
  overtimeRatePercent: 25,
  weekendRatePercent: 10,
  holidayRatePercent: 100,
  companyId: 'company-1',
}

const mockAttendance = {
  id: 'att-1',
  userId: 'user-1',
  projectId: 'project-1',
  assignmentId: null,
  date: '2026-04-21',
  checkIn: '07:00',
  checkOut: null,
  type: 'REGULAR' as const,
  breakMinutes: 0,
  hoursWorked: null,
  earnings: null,
  approved: false,
  approvedById: null,
  notes: null,
  offlineCreated: false,
  createdAt: new Date(),
}

const mockAttendanceClosed = {
  ...mockAttendance,
  checkOut: '16:00',
  hoursWorked: 9,
  earnings: 1800,
}

// ─── Tests: calculateHoursWorked ─────────────────────────────────────────────

describe('calculateHoursWorked', () => {
  it('returns hours between check-in and check-out with auto 30-min break enforced', () => {
    // 07:00-16:00 = 9h raw; >6h → enforce 30-min minimum break → 8.5h
    expect(calculateHoursWorked('07:00', '16:00', 0)).toBeCloseTo(8.5)
  })

  it('uses explicit break when it meets the 30-min minimum', () => {
    // 9h raw, 30-min explicit break (meets minimum) → 8.5h
    expect(calculateHoursWorked('07:00', '16:00', 30)).toBeCloseTo(8.5)
  })

  it('uses larger explicit break when it exceeds 30-min minimum', () => {
    // 9h raw, 60-min explicit break → 8h
    expect(calculateHoursWorked('07:00', '16:00', 60)).toBeCloseTo(8)
  })

  it('auto-adds 30-min break when raw hours exceed 6', () => {
    // 7:00 → 14:00 = 7h raw → auto break → 6.5h
    expect(calculateHoursWorked('07:00', '14:00', 0)).toBeCloseTo(6.5)
  })

  it('does not auto-add break when hours are exactly 6', () => {
    expect(calculateHoursWorked('07:00', '13:00', 0)).toBeCloseTo(6)
  })

  it('returns 0 for same check-in and check-out', () => {
    expect(calculateHoursWorked('08:00', '08:00', 0)).toBe(0)
  })
})

// ─── Tests: calculateEarnings ────────────────────────────────────────────────

describe('calculateEarnings', () => {
  const rates = { overtimeRatePercent: 25, weekendRatePercent: 10, holidayRatePercent: 100 }

  it('calculates regular earnings (1× rate)', () => {
    expect(calculateEarnings(8, 200, 'REGULAR', rates)).toBeCloseTo(1600)
  })

  it('calculates overtime earnings (1.25× rate)', () => {
    expect(calculateEarnings(8, 200, 'OVERTIME', rates)).toBeCloseTo(2000)
  })

  it('calculates weekend earnings (1.10× rate)', () => {
    expect(calculateEarnings(8, 200, 'WEEKEND', rates)).toBeCloseTo(1760)
  })

  it('calculates holiday earnings (2× rate)', () => {
    expect(calculateEarnings(8, 200, 'HOLIDAY', rates)).toBeCloseTo(3200)
  })

  it('calculates travel earnings (same as regular)', () => {
    expect(calculateEarnings(8, 200, 'TRAVEL', rates)).toBeCloseTo(1600)
  })

  it('returns 0 for 0 hours', () => {
    expect(calculateEarnings(0, 200, 'REGULAR', rates)).toBe(0)
  })
})

// ─── Tests: AttendanceService.checkIn ────────────────────────────────────────

describe('AttendanceService.checkIn', () => {
  it('inserts attendance record and returns it', async () => {
    const db = makeDb()
    // No existing open attendance
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockAttendance])) } as never)
    const service = new AttendanceService(db)

    const result = await service.checkIn({
      userId: 'user-1',
      projectId: 'project-1',
      date: '2026-04-21',
      checkIn: '07:00',
      type: 'REGULAR',
    })

    expect(result.userId).toBe('user-1')
    expect(result.checkOut).toBeNull()
  })

  it('throws when user already has open attendance today', async () => {
    const db = makeDb()
    // Existing open attendance (no checkOut)
    vi.mocked(db.select).mockReturnValue(selectChain([mockAttendance]) as never)
    const service = new AttendanceService(db)

    await expect(
      service.checkIn({ userId: 'user-1', projectId: 'project-1', date: '2026-04-21', checkIn: '07:00', type: 'REGULAR' }),
    ).rejects.toThrow('already checked in')
  })
})

// ─── Tests: AttendanceService.checkOut ───────────────────────────────────────

describe('AttendanceService.checkOut', () => {
  it('computes hoursWorked and earnings, then updates record', async () => {
    const db = makeDb()
    // First select: get open attendance record
    // Second select: get user rates
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockAttendance]) as never)
      .mockReturnValueOnce(selectChain([mockUser]) as never)

    const updatedRecord = { ...mockAttendance, checkOut: '16:00', hoursWorked: 8.5, earnings: 1700 }
    vi.mocked(db.update).mockReturnValue(updateChain([updatedRecord]) as never)
    const service = new AttendanceService(db)

    const result = await service.checkOut('att-1', 'user-1', '16:00')

    expect(result.checkOut).toBe('16:00')
    expect(result.hoursWorked).toBeGreaterThan(0)
    expect(result.earnings).toBeGreaterThan(0)
  })

  it('throws when attendance record not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new AttendanceService(db)

    await expect(service.checkOut('att-999', 'user-1', '16:00')).rejects.toThrow('not found')
  })

  it('throws when user not found', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockAttendance]) as never)
      .mockReturnValueOnce(selectChain([]) as never)
    const service = new AttendanceService(db)

    await expect(service.checkOut('att-1', 'user-1', '16:00')).rejects.toThrow('User not found')
  })
})

// ─── Tests: AttendanceService.listForUser ────────────────────────────────────

describe('AttendanceService.listForUser', () => {
  it('returns attendance records for a user in date range', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockAttendanceClosed]) as never)
    const service = new AttendanceService(db)

    const result = await service.listForUser('user-1', '2026-04-01', '2026-04-30')
    expect(result).toHaveLength(1)
    expect(result[0]?.userId).toBe('user-1')
  })
})

// ─── Tests: AttendanceService.getEarnings ────────────────────────────────────

describe('AttendanceService.getEarnings', () => {
  it('sums earnings for a user in date range', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(
      selectChain([{ total: 3600 }]) as never,
    )
    const service = new AttendanceService(db)

    const total = await service.getEarnings('user-1', '2026-04-01', '2026-04-30')
    expect(total).toBe(3600)
  })

  it('returns 0 when no earnings in range', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([{ total: null }]) as never)
    const service = new AttendanceService(db)

    const total = await service.getEarnings('user-1', '2026-04-01', '2026-04-30')
    expect(total).toBe(0)
  })
})

// ─── Tests: AttendanceService.approve ────────────────────────────────────────

describe('AttendanceService.approve', () => {
  it('sets approved=true and approvedById', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([{ id: 'att-1' }]) as never)
    vi.mocked(db.update).mockReturnValue(updateChain([]) as never)
    const service = new AttendanceService(db)

    await service.approve('att-1', 'approver-1', 'company-1')

    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg?.approved).toBe(true)
    expect(setArg?.approvedById).toBe('approver-1')
  })

  it('throws when attendance record not found or not in company', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new AttendanceService(db)

    await expect(service.approve('att-999', 'approver-1', 'company-1')).rejects.toThrow('not found')
  })
})

// ─── Tests: AttendanceService.exportMonthCsv ─────────────────────────────────

describe('AttendanceService.exportMonthCsv', () => {
  it('returns CSV string with header row', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(
      selectChain([
        {
          date: '2026-04-21',
          fullName: 'Karel Dvořák',
          projectName: 'Novákovi',
          checkIn: '07:00',
          checkOut: '16:00',
          hoursWorked: 8.5,
          earnings: 1700,
          type: 'REGULAR',
          approved: true,
        },
      ]) as never,
    )
    const service = new AttendanceService(db)

    const csv = await service.exportMonthCsv('company-1', '2026-04')
    expect(csv).toContain('datum')
    expect(csv).toContain('Karel Dvořák')
    expect(csv).toContain('Novákovi')
  })

  it('returns CSV with just header when no records', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new AttendanceService(db)

    const csv = await service.exportMonthCsv('company-1', '2026-04')
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(1) // header only
  })
})
