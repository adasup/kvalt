import { z } from 'zod'

export const createBudgetSchema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string().uuid().optional(),
  vatRate: z.number().min(0).max(100).default(21),
})

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  clientIco: z.string().optional(),
  address: z.string().optional(),
  plannedStart: z.string().date().optional(),
  plannedEnd: z.string().date().optional(),
  notes: z.string().optional(),
})

export const createAssignmentSchema = z.object({
  projectId: z.string().uuid(),
  date: z.string().date(),
  teamId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default('07:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default('16:00'),
  description: z.string().optional(),
  notes: z.string().optional(),
})

export const bulkAssignmentSchema = z.object({
  projectId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  dates: z.array(z.string().date()).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default('07:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default('16:00'),
  description: z.string().optional(),
})

export const checkInSchema = z.object({
  projectId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkIn: z.string().regex(/^\d{2}:\d{2}$/),
  type: z.enum(['REGULAR', 'OVERTIME', 'WEEKEND', 'HOLIDAY', 'TRAVEL']).optional(),
  assignmentId: z.string().uuid().optional(),
  notes: z.string().optional(),
})

export const checkOutSchema = z.object({
  checkOut: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().int().min(0).max(480).optional(),
  notes: z.string().optional(),
})

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  leaderId: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>
export type BulkAssignmentInput = z.infer<typeof bulkAssignmentSchema>
export type CheckInInput = z.infer<typeof checkInSchema>
export type CheckOutInput = z.infer<typeof checkOutSchema>
export type CreateTeamInput = z.infer<typeof createTeamSchema>
