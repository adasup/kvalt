import { eq, and, gte, lte } from 'drizzle-orm'
import { assignments, projects, teams } from '../db/schema.js'
import type { Db } from '../db/client.js'
import { getWeekDates, formatDate } from '@kvalt/shared'

export type AssignmentRow = typeof assignments.$inferSelect

export interface AssignmentWithDetails extends AssignmentRow {
  projectName: string
  projectAddress: string | null
  teamName: string | null
  teamColor: string | null
}

export interface WeekBoard {
  week: string
  days: string[]
  assignments: AssignmentWithDetails[]
}

export interface CreateAssignmentInput {
  projectId: string
  date: string
  teamId?: string
  userId?: string
  startTime?: string
  endTime?: string
  description?: string
  notes?: string
}

export class PlanningService {
  constructor(private db: Db) {}

  async create(companyId: string, createdById: string, input: CreateAssignmentInput): Promise<AssignmentRow> {
    if (!input.teamId && !input.userId) {
      throw new Error('teamId or userId required')
    }

    const [assignment] = await this.db
      .insert(assignments)
      .values({
        companyId,
        createdById,
        projectId: input.projectId,
        date: input.date,
        teamId: input.teamId,
        userId: input.userId,
        startTime: input.startTime ?? '07:00',
        endTime: input.endTime ?? '16:00',
        description: input.description,
        notes: input.notes,
        status: 'PLANNED',
        notificationSent: false,
      })
      .returning()

    if (!assignment) throw new Error('Failed to create assignment')
    return assignment
  }

  async bulkCreate(
    companyId: string,
    createdById: string,
    input: Omit<CreateAssignmentInput, 'date'> & { dates: string[] },
  ): Promise<AssignmentRow[]> {
    if (input.dates.length === 0) return []

    const rows = await this.db
      .insert(assignments)
      .values(
        input.dates.map((date) => ({
          companyId,
          createdById,
          projectId: input.projectId,
          date,
          teamId: input.teamId,
          userId: input.userId,
          startTime: input.startTime ?? '07:00',
          endTime: input.endTime ?? '16:00',
          description: input.description,
          notes: input.notes,
          status: 'PLANNED' as const,
          notificationSent: false,
        })),
      )
      .returning()

    return rows
  }

  async getWeekBoard(companyId: string, isoWeek: string): Promise<WeekBoard> {
    const dates = getWeekDates(isoWeek)
    const days = dates.map(formatDate)
    const [from, to] = [days[0]!, days[6]!]

    const rows = await this.db
      .select({
        id: assignments.id,
        companyId: assignments.companyId,
        projectId: assignments.projectId,
        date: assignments.date,
        teamId: assignments.teamId,
        userId: assignments.userId,
        status: assignments.status,
        startTime: assignments.startTime,
        endTime: assignments.endTime,
        description: assignments.description,
        notes: assignments.notes,
        notificationSent: assignments.notificationSent,
        createdById: assignments.createdById,
        createdAt: assignments.createdAt,
        updatedAt: assignments.updatedAt,
        projectName: projects.name,
        projectAddress: projects.address,
        teamName: teams.name,
        teamColor: teams.color,
      })
      .from(assignments)
      .leftJoin(projects, eq(assignments.projectId, projects.id))
      .leftJoin(teams, eq(assignments.teamId, teams.id))
      .where(
        and(
          eq(assignments.companyId, companyId),
          gte(assignments.date, from),
          lte(assignments.date, to),
        ),
      )
      .orderBy(assignments.date, assignments.startTime)

    return {
      week: isoWeek,
      days,
      assignments: rows as AssignmentWithDetails[],
    }
  }

  async getMyTomorrow(userId: string, tomorrowDate: string): Promise<AssignmentWithDetails | null> {
    const rows = await this.db
      .select({
        id: assignments.id,
        companyId: assignments.companyId,
        projectId: assignments.projectId,
        date: assignments.date,
        teamId: assignments.teamId,
        userId: assignments.userId,
        status: assignments.status,
        startTime: assignments.startTime,
        endTime: assignments.endTime,
        description: assignments.description,
        notes: assignments.notes,
        notificationSent: assignments.notificationSent,
        createdById: assignments.createdById,
        createdAt: assignments.createdAt,
        updatedAt: assignments.updatedAt,
        projectName: projects.name,
        projectAddress: projects.address,
        teamName: teams.name,
        teamColor: teams.color,
      })
      .from(assignments)
      .leftJoin(projects, eq(assignments.projectId, projects.id))
      .leftJoin(teams, eq(assignments.teamId, teams.id))
      .where(and(eq(assignments.userId, userId), eq(assignments.date, tomorrowDate)))
      .limit(1)

    return (rows[0] as AssignmentWithDetails | undefined) ?? null
  }

  async checkConflict(userId: string, date: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(eq(assignments.userId, userId), eq(assignments.date, date)))
      .limit(1)

    if (excludeId) {
      return rows.some((r) => r.id !== excludeId)
    }
    return rows.length > 0
  }

  async update(companyId: string, id: string, input: Partial<CreateAssignmentInput>): Promise<AssignmentRow> {
    const [updated] = await this.db
      .update(assignments)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(assignments.id, id), eq(assignments.companyId, companyId)))
      .returning()

    if (!updated) throw new Error('Assignment not found')
    return updated
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.db
      .delete(assignments)
      .where(and(eq(assignments.id, id), eq(assignments.companyId, companyId)))
  }

  async markNotificationSent(id: string): Promise<void> {
    await this.db
      .update(assignments)
      .set({ notificationSent: true })
      .where(eq(assignments.id, id))
  }

  async getTomorrowUnsent(companyId: string, tomorrowDate: string): Promise<AssignmentWithDetails[]> {
    const rows = await this.db
      .select({
        id: assignments.id,
        companyId: assignments.companyId,
        projectId: assignments.projectId,
        date: assignments.date,
        teamId: assignments.teamId,
        userId: assignments.userId,
        status: assignments.status,
        startTime: assignments.startTime,
        endTime: assignments.endTime,
        description: assignments.description,
        notes: assignments.notes,
        notificationSent: assignments.notificationSent,
        createdById: assignments.createdById,
        createdAt: assignments.createdAt,
        updatedAt: assignments.updatedAt,
        projectName: projects.name,
        projectAddress: projects.address,
        teamName: teams.name,
        teamColor: teams.color,
      })
      .from(assignments)
      .leftJoin(projects, eq(assignments.projectId, projects.id))
      .leftJoin(teams, eq(assignments.teamId, teams.id))
      .where(
        and(
          eq(assignments.companyId, companyId),
          eq(assignments.date, tomorrowDate),
          eq(assignments.notificationSent, false),
        ),
      )

    return rows as AssignmentWithDetails[]
  }
}
