import { eq, and, inArray } from 'drizzle-orm'
import { notifications, users, teamMembers, assignments } from '../db/schema.js'
import type { Db } from '../db/client.js'
import type { AssignmentWithDetails } from './planning.service.js'

export type NotificationRow = typeof notifications.$inferSelect

export interface PushPayload {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  badge?: number
}

export type SendPushFn = (payloads: PushPayload[]) => Promise<void>

interface UserForPush {
  id: string
  fullName: string
  pushToken: string | null
}

// ─── Pure helper ──────────────────────────────────────────────────────────────

export function buildPushMessage(
  assignment: Pick<
    AssignmentWithDetails,
    'startTime' | 'projectName' | 'projectAddress' | 'description' | 'teamName'
  >,
  recipientName: string,
): { title: string; body: string } {
  const title = `Zítra: ${assignment.projectName}`

  const lines: string[] = [`v ${assignment.startTime}`]
  if (assignment.projectAddress) lines.push(assignment.projectAddress)
  if (assignment.teamName) lines.push(`Tým: ${assignment.teamName}`)
  if (assignment.description) lines.push(assignment.description)

  return { title, body: lines.join(' · ') }
}

// ─── Expo Push sender ─────────────────────────────────────────────────────────

export function createExpoPushSender(fetchFn: typeof fetch = fetch): SendPushFn {
  return async (payloads) => {
    if (payloads.length === 0) return
    // Expo accepts arrays of up to 100 messages
    const res = await fetchFn('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payloads),
    })
    if (!res.ok) {
      console.error('Expo push failed:', res.status, await res.text())
    }
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class NotificationsService {
  constructor(private db: Db) {}

  async getUsersForAssignment(
    assignment: Pick<AssignmentWithDetails, 'userId' | 'teamId'>,
  ): Promise<UserForPush[]> {
    if (!assignment.userId && !assignment.teamId) return []

    if (assignment.userId) {
      return this.db
        .select({ id: users.id, fullName: users.fullName, pushToken: users.pushToken })
        .from(users)
        .where(eq(users.id, assignment.userId))
    }

    // Team assignment — get all members
    return this.db
      .select({ id: users.id, fullName: users.fullName, pushToken: users.pushToken })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, assignment.teamId!))
  }

  async saveNotification(input: {
    userId: string
    type: 'tomorrow_assignment' | 'attendance_reminder' | 'approval_needed'
    title: string
    body: string
    data?: Record<string, unknown>
  }): Promise<NotificationRow> {
    const [notif] = await this.db
      .insert(notifications)
      .values(input)
      .returning()

    if (!notif) throw new Error('Failed to save notification')
    return notif
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationRow[]> {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(notifications.sentAt)
      .limit(limit)
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
  }

  async registerPushToken(userId: string, pushToken: string): Promise<void> {
    await this.db
      .update(users)
      .set({ pushToken })
      .where(eq(users.id, userId))
  }

  async sendTomorrowNotifications(
    todayAssignments: AssignmentWithDetails[],
    sendPush: SendPushFn,
  ): Promise<void> {
    if (todayAssignments.length === 0) return

    const notificationsToInsert: Array<{
      userId: string
      type: 'tomorrow_assignment'
      title: string
      body: string
      data: Record<string, unknown>
    }> = []
    const pushPayloads: PushPayload[] = []
    const assignmentIds: string[] = []

    for (const assignment of todayAssignments) {
      const recipients = await this.getUsersForAssignment(assignment)
      for (const user of recipients) {
        const { title, body } = buildPushMessage(assignment, user.fullName)
        notificationsToInsert.push({
          userId: user.id,
          type: 'tomorrow_assignment',
          title,
          body,
          data: { assignmentId: assignment.id, date: assignment.date },
        })
        if (user.pushToken) {
          pushPayloads.push({ to: user.pushToken, title, body, sound: 'default' })
        }
      }
      assignmentIds.push(assignment.id)
    }

    // Bulk insert all notifications in one query
    if (notificationsToInsert.length > 0) {
      await this.db.insert(notifications).values(notificationsToInsert)
    }

    // One batched push call
    await sendPush(pushPayloads)

    // Bulk mark all assignments as sent
    if (assignmentIds.length > 0) {
      await this.db
        .update(assignments)
        .set({ notificationSent: true })
        .where(inArray(assignments.id, assignmentIds))
    }
  }
}
