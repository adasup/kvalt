import { eq, and } from 'drizzle-orm'
import { teams, teamMembers, users } from '../db/schema.js'
import type { Db } from '../db/client.js'

export type TeamRow = typeof teams.$inferSelect
export type TeamMemberRow = typeof teamMembers.$inferSelect

export interface TeamDetail extends TeamRow {
  members: Array<{
    userId: string
    fullName: string
    role: string
    email: string
    phone: string | null
  }>
}

export interface CreateTeamInput {
  name: string
  leaderId?: string
  color?: string
}

export class TeamsService {
  constructor(private db: Db) {}

  async create(companyId: string, input: CreateTeamInput): Promise<TeamRow> {
    const [team] = await this.db
      .insert(teams)
      .values({ companyId, ...input })
      .returning()

    if (!team) throw new Error('Failed to create team')
    return team
  }

  async list(companyId: string, opts?: { leaderId?: string }): Promise<TeamRow[]> {
    const rows = await this.db
      .select()
      .from(teams)
      .where(eq(teams.companyId, companyId))
      .orderBy(teams.name)

    if (opts?.leaderId) {
      return rows.filter((t) => t.leaderId === opts.leaderId)
    }
    return rows
  }

  async getById(companyId: string, id: string): Promise<TeamDetail | null> {
    const [team] = await this.db
      .select()
      .from(teams)
      .where(and(eq(teams.id, id), eq(teams.companyId, companyId)))
      .limit(1)

    if (!team) return null

    const members = await this.db
      .select({
        userId: teamMembers.userId,
        fullName: users.fullName,
        role: users.role,
        email: users.email,
        phone: users.phone,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, id))

    return { ...team, members }
  }

  async update(companyId: string, id: string, input: Partial<CreateTeamInput>): Promise<TeamRow> {
    const [updated] = await this.db
      .update(teams)
      .set(input)
      .where(and(eq(teams.id, id), eq(teams.companyId, companyId)))
      .returning()

    if (!updated) throw new Error('Team not found')
    return updated
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.db
      .delete(teams)
      .where(and(eq(teams.id, id), eq(teams.companyId, companyId)))
  }

  async addMember(teamId: string, userId: string): Promise<TeamMemberRow> {
    const [member] = await this.db
      .insert(teamMembers)
      .values({ teamId, userId })
      .returning()

    if (!member) throw new Error('Failed to add member')
    return member
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
  }

  async isLeader(companyId: string, teamId: string, userId: string): Promise<boolean> {
    const [team] = await this.db
      .select({ leaderId: teams.leaderId })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.companyId, companyId)))
      .limit(1)

    return team?.leaderId === userId
  }

  async getMemberTeam(companyId: string, userId: string): Promise<TeamRow | null> {
    const rows = await this.db
      .select({
        id: teams.id,
        companyId: teams.companyId,
        name: teams.name,
        leaderId: teams.leaderId,
        color: teams.color,
        createdAt: teams.createdAt,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(eq(teamMembers.userId, userId), eq(teams.companyId, companyId)))
      .limit(1)

    return rows[0] ?? null
  }
}
