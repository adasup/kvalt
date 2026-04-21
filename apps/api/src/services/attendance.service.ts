import { eq, and, gte, lte, isNull, sum } from 'drizzle-orm'
import { attendance, users, projects } from '../db/schema.js'
import type { Db } from '../db/client.js'

export type AttendanceRow = typeof attendance.$inferSelect
export type AttendanceType = AttendanceRow['type']

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function calculateHoursWorked(
  checkIn: string,
  checkOut: string,
  breakMinutes: number,
): number {
  const [inH, inM] = checkIn.split(':').map(Number) as [number, number]
  const [outH, outM] = checkOut.split(':').map(Number) as [number, number]
  const rawMinutes = (outH * 60 + outM) - (inH * 60 + inM)
  if (rawMinutes <= 0) return 0

  // Enforce minimum 30-min break when working more than 6h
  const effectiveBreak = rawMinutes > 360 && breakMinutes < 30 ? 30 : breakMinutes
  const netMinutes = rawMinutes - effectiveBreak
  return Math.max(0, netMinutes) / 60
}

export function calculateEarnings(
  hoursWorked: number,
  hourlyRate: number,
  type: AttendanceType,
  rates: { overtimeRatePercent: number; weekendRatePercent: number; holidayRatePercent: number },
): number {
  const multiplierMap: Record<AttendanceType, number> = {
    REGULAR: 1,
    TRAVEL: 1,
    OVERTIME: 1 + rates.overtimeRatePercent / 100,
    WEEKEND: 1 + rates.weekendRatePercent / 100,
    HOLIDAY: 1 + rates.holidayRatePercent / 100,
  }
  return hoursWorked * hourlyRate * (multiplierMap[type] ?? 1)
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AttendanceService {
  constructor(private db: Db) {}

  async checkIn(input: {
    userId: string
    projectId: string
    date: string
    checkIn: string
    type?: AttendanceType
    assignmentId?: string
    notes?: string
  }): Promise<AttendanceRow> {
    // Block if user already has an open attendance record today
    const [existing] = await this.db
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(eq(attendance.userId, input.userId), eq(attendance.date, input.date), isNull(attendance.checkOut)))
      .limit(1)

    if (existing) throw new Error('User is already checked in for this date')

    const [record] = await this.db
      .insert(attendance)
      .values({
        userId: input.userId,
        projectId: input.projectId,
        date: input.date,
        checkIn: input.checkIn,
        type: input.type ?? 'REGULAR',
        assignmentId: input.assignmentId,
        notes: input.notes,
      })
      .returning()

    if (!record) throw new Error('Failed to insert attendance')
    return record
  }

  async checkOut(attendanceId: string, userId: string, checkOut: string, breakMinutes = 0): Promise<AttendanceRow> {
    const [record] = await this.db
      .select()
      .from(attendance)
      .where(and(eq(attendance.id, attendanceId), eq(attendance.userId, userId)))
      .limit(1)

    if (!record) throw new Error('Attendance record not found')

    const [user] = await this.db
      .select({
        hourlyRate: users.hourlyRate,
        overtimeRatePercent: users.overtimeRatePercent,
        weekendRatePercent: users.weekendRatePercent,
        holidayRatePercent: users.holidayRatePercent,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) throw new Error('User not found')

    const hoursWorked = calculateHoursWorked(record.checkIn, checkOut, breakMinutes)
    const earnings = calculateEarnings(hoursWorked, user.hourlyRate, record.type, user)

    const [updated] = await this.db
      .update(attendance)
      .set({ checkOut, hoursWorked, earnings, breakMinutes })
      .where(eq(attendance.id, attendanceId))
      .returning()

    if (!updated) throw new Error('Failed to update attendance')
    return updated
  }

  async listForUser(userId: string, from: string, to: string): Promise<AttendanceRow[]> {
    return this.db
      .select()
      .from(attendance)
      .where(and(eq(attendance.userId, userId), gte(attendance.date, from), lte(attendance.date, to)))
      .orderBy(attendance.date)
  }

  async listForProject(companyId: string, projectId: string, from: string, to: string): Promise<AttendanceRow[]> {
    return this.db
      .select({ attendance })
      .from(attendance)
      .innerJoin(users, eq(attendance.userId, users.id))
      .where(and(eq(attendance.projectId, projectId), eq(users.companyId, companyId), gte(attendance.date, from), lte(attendance.date, to)))
      .orderBy(attendance.date) as unknown as AttendanceRow[]
  }

  async getEarnings(userId: string, from: string, to: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(attendance.earnings) })
      .from(attendance)
      .where(and(eq(attendance.userId, userId), gte(attendance.date, from), lte(attendance.date, to)))

    return Number(row?.total ?? 0)
  }

  async approve(attendanceId: string, approverId: string, companyId: string): Promise<void> {
    // Verify the attendance record belongs to a user in the company
    const [record] = await this.db
      .select({ id: attendance.id })
      .from(attendance)
      .innerJoin(users, eq(attendance.userId, users.id))
      .where(and(eq(attendance.id, attendanceId), eq(users.companyId, companyId)))
      .limit(1)

    if (!record) throw new Error('Attendance record not found or access denied')

    await this.db
      .update(attendance)
      .set({ approved: true, approvedById: approverId })
      .where(eq(attendance.id, attendanceId))
  }

  async exportMonthCsv(companyId: string, yearMonth: string): Promise<string> {
    const rows = await this.db
      .select({
        date: attendance.date,
        fullName: users.fullName,
        projectName: projects.name,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        hoursWorked: attendance.hoursWorked,
        earnings: attendance.earnings,
        type: attendance.type,
        approved: attendance.approved,
      })
      .from(attendance)
      .innerJoin(users, eq(attendance.userId, users.id))
      .innerJoin(projects, eq(attendance.projectId, projects.id))
      .where(and(eq(users.companyId, companyId), gte(attendance.date, `${yearMonth}-01`), lte(attendance.date, `${yearMonth}-31`)))
      .orderBy(users.fullName, attendance.date)

    const header = 'datum;jméno;zakázka;příchod;odchod;hodiny;výdělek;typ;schváleno'
    const lines = rows.map((r) =>
      [
        r.date,
        r.fullName,
        r.projectName,
        r.checkIn,
        r.checkOut ?? '',
        r.hoursWorked?.toFixed(2) ?? '',
        r.earnings?.toFixed(2) ?? '',
        r.type,
        r.approved ? 'ano' : 'ne',
      ].join(';'),
    )

    return [header, ...lines].join('\n')
  }
}
